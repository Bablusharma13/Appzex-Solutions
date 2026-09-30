import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { findAgencyProjectOrThrow } from '../../repositories/tenantRepository';
import type { AgencyContext } from '../../types/auth';
import { AppError } from '../../utils/errors';
import { logActivity, userActor } from '../activityService';
import { getProjectHealthFacts } from '../healthService';
import { getAIProvider, type AIProvider } from './aiProvider';

export const AI_NOT_CONFIGURED_MESSAGE = 'AI service is not configured. Add OPENAI_API_KEY to enable this feature.';
export const AI_FAILED_MESSAGE = 'Unable to generate AI insights right now. Please try again.';

const PROJECT_HEALTH_SYSTEM_PROMPT = `You are a project management assistant for a digital agency.
Analyze ONLY the project data supplied in the user message (JSON). Rules:
- Do not invent facts, people, dates or numbers that are not present in the data.
- Identify risks based on overdue tasks, deadlines, milestones, unassigned work and client feedback.
- The field "ruleBasedHealth" is a deterministic baseline; you may disagree only if the data clearly justifies it.
- Keep every list item to one concise, actionable sentence. Maximum 5 items per list.
- If the data is insufficient (for example there are no tasks), say so explicitly in the summary.
- "clientUpdate" is a short, professional, client-safe status message (3-4 sentences). Do not mention internal team member names, blame, or internal notes.
Respond with one JSON object with exactly these keys:
{"health":"ON_TRACK"|"AT_RISK"|"CRITICAL","summary":string,"risks":string[],"overdueWork":string[],"recommendedActions":string[],"clientUpdate":string}`;

const MEETING_SUMMARY_SYSTEM_PROMPT = `You summarize meeting notes for a digital agency project.
Use ONLY the notes provided. Do not invent decisions, owners or dates.
- "summary": 2-4 sentence overview suitable for sharing with the client.
- "keyDecisions": decisions that were explicitly agreed.
- "actionItems": concrete follow-ups. "owner" only if a person or party is named in the notes, otherwise null. "dueDate" as YYYY-MM-DD only if an exact date is stated, otherwise null.
- "deadlines": any deadlines mentioned, as short phrases.
Respond with one JSON object with exactly these keys:
{"summary":string,"keyDecisions":string[],"actionItems":[{"title":string,"owner":string|null,"dueDate":string|null}],"deadlines":string[]}`;

const stringList = (maxItems: number) =>
  z
    .array(z.string().trim().min(1).max(600))
    .max(maxItems * 2)
    .transform((items) => items.slice(0, maxItems))
    .default([]);

const healthInsightSchema = z.object({
  health: z.enum(['ON_TRACK', 'AT_RISK', 'CRITICAL']),
  summary: z.string().trim().min(1).max(3000),
  risks: stringList(6),
  overdueWork: stringList(10),
  recommendedActions: stringList(6),
  clientUpdate: z.string().trim().max(3000).default(''),
});

const meetingSummarySchema = z.object({
  summary: z.string().trim().min(1).max(3000),
  keyDecisions: stringList(10),
  actionItems: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        owner: z
          .string()
          .trim()
          .max(120)
          .nullable()
          .optional()
          .transform((v) => v || null),
        dueDate: z
          .string()
          .nullable()
          .optional()
          .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
      }),
    )
    .max(20)
    .default([]),
  deadlines: stringList(10),
});

function requireProvider(): AIProvider {
  const provider = getAIProvider();
  if (!provider) throw new AppError(503, AI_NOT_CONFIGURED_MESSAGE, { code: 'AI_NOT_CONFIGURED' });
  return provider;
}

async function callModel(provider: AIProvider, system: string, payload: unknown): Promise<string> {
  try {
    return await provider.completeJson({ system, user: JSON.stringify(payload) });
  } catch (error) {
    // Log the failure server-side only; never forward provider errors to users.
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ai] provider request failed:', message);
    throw new AppError(502, AI_FAILED_MESSAGE, { code: 'AI_UNAVAILABLE' });
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * AI Project Health Assistant.
 *
 * Order matters for tenant safety:
 *   1. authorize the project against the caller's agency (404 otherwise)
 *   2. collect only that project's facts
 *   3. only then call the model
 * The model output is advisory: it is validated, shown to the user for
 * review, and never written back into project data.
 */
export async function generateProjectHealth(ctx: AgencyContext, projectId: string) {
  await findAgencyProjectOrThrow(ctx.agencyId, projectId);
  const provider = requireProvider();
  const facts = await getProjectHealthFacts(ctx.agencyId, projectId);

  const raw = await callModel(provider, PROJECT_HEALTH_SYSTEM_PROMPT, facts);
  const parsed = healthInsightSchema.safeParse(parseJson(raw));

  // Readable fallback if the model returned something we cannot validate.
  const insights = parsed.success
    ? parsed.data
    : {
        health: facts.ruleBasedHealth,
        summary:
          raw.trim().slice(0, 1500) || 'The AI response could not be read. The rule-based assessment is shown instead.',
        risks: facts.ruleBasedReasons,
        overdueWork: facts.overdueTaskList.map((task) => `${task.title} (${task.daysOverdue} day(s) overdue)`),
        recommendedActions: [],
        clientUpdate: '',
      };

  await logActivity(prisma, {
    agencyId: ctx.agencyId,
    projectId,
    actor: userActor(ctx.userId),
    eventType: 'ai.project_health_generated',
    entityType: 'project',
    entityId: projectId,
    metadata: { projectName: facts.project.name, health: insights.health },
  });

  return {
    projectId,
    model: provider.model,
    generatedAt: new Date().toISOString(),
    parsedFromModel: parsed.success,
    insights,
    facts: {
      metrics: facts.metrics,
      ruleBasedHealth: facts.ruleBasedHealth,
      ruleBasedReasons: facts.ruleBasedReasons,
    },
  };
}

export async function generateMeetingSummary(
  ctx: AgencyContext,
  input: { projectId: string; title?: string; notes: string },
) {
  const project = await findAgencyProjectOrThrow(ctx.agencyId, input.projectId);
  const provider = requireProvider();

  // Only the notes the user typed plus minimal context are sent.
  const raw = await callModel(provider, MEETING_SUMMARY_SYSTEM_PROMPT, {
    project: project.name,
    meetingTitle: input.title ?? null,
    notes: input.notes,
  });
  const parsed = meetingSummarySchema.safeParse(parseJson(raw));

  return {
    model: provider.model,
    generatedAt: new Date().toISOString(),
    parsedFromModel: parsed.success,
    result: parsed.success
      ? parsed.data
      : {
          summary: raw.trim().slice(0, 1500) || 'The AI response could not be read.',
          keyDecisions: [],
          actionItems: [],
          deadlines: [],
        },
  };
}
