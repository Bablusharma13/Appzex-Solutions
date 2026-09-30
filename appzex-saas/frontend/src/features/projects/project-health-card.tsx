'use client';

import { AlertTriangle, Check, ClipboardList, Copy, ListChecks, MessageSquareQuote, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { HealthBadge } from '@/components/shared/badges';
import { InlineAlert } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { usePermissions } from '@/hooks/use-auth';
import { useAIStatus } from '@/hooks/use-agency';
import { useProjectHealth } from '@/hooks/use-projects';
import { useProjectHealthAI } from '@/hooks/use-work';
import { ApiError } from '@/lib/api';
import type { HealthMetrics } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

function Metric({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold', alert && 'text-red-600')}>{value}</p>
    </div>
  );
}

function MetricsGrid({ metrics }: { metrics: HealthMetrics }) {
  const days = metrics.daysUntilDeadline;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Metric label="Completion" value={`${metrics.completionPercentage}%`} />
      <Metric label="Overdue tasks" value={metrics.overdueTasks} alert={metrics.overdueTasks > 0} />
      <Metric label="Overdue milestones" value={metrics.overdueMilestones} alert={metrics.overdueMilestones > 0} />
      <Metric label="Deadline" value={days === null ? 'Not set' : days < 0 ? `${Math.abs(days)}d late` : `${days}d left`} alert={days !== null && days < 0} />
      <Metric label="Pending feedback" value={metrics.pendingFeedback} />
      <Metric label="Unassigned open tasks" value={metrics.unassignedOpenTasks} />
    </div>
  );
}

function InsightList({ icon: Icon, title, items, empty }: { icon: typeof ListChecks; title: string; items: string[]; empty: string }) {
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden /> {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProjectHealthCard({ projectId }: { projectId: string }) {
  const { readOnly } = usePermissions();
  const { data: facts, isLoading: factsLoading } = useProjectHealth(projectId);
  const { data: aiStatus } = useAIStatus();
  const analyze = useProjectHealthAI();
  const [copied, setCopied] = useState(false);

  const result = analyze.data;
  const error = analyze.error;
  const notConfigured = aiStatus?.enabled === false || (error instanceof ApiError && error.code === 'AI_NOT_CONFIGURED');
  const run = () => analyze.mutate(projectId);

  const copyUpdate = async () => {
    if (!result?.insights.clientUpdate) return;
    await navigator.clipboard.writeText(result.insights.clientUpdate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700" aria-hidden>
              <Sparkles className="size-4" />
            </span>
            AI Project Health Assistant
          </h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            Analyzes this project’s tasks, milestones, deadlines and feedback. Suggestions are advisory — nothing is changed automatically.
          </p>
        </div>
        {!notConfigured && !readOnly && (
          <Button onClick={run} loading={analyze.isPending} variant={result ? 'outline' : 'default'}>
            {!analyze.isPending && (result ? <RefreshCw /> : <Sparkles />)}
            {analyze.isPending ? 'Analyzing project…' : result ? 'Regenerate' : 'Generate AI insights'}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Deterministic facts: always available, and the only data the AI receives */}
        {factsLoading || !facts ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-3 rounded-xl bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Calculated from project data</p>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                Rule-based health <HealthBadge health={facts.ruleBasedHealth} />
              </span>
            </div>
            <MetricsGrid metrics={facts.metrics} />
            <ul className="space-y-1 text-xs text-muted-foreground">
              {facts.ruleBasedReasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          </div>
        )}

        {notConfigured && (
          <InlineAlert tone="info" title="AI insights are unavailable">
            AI service is not configured. Add OPENAI_API_KEY to enable this feature. The calculated metrics above still work without it.
          </InlineAlert>
        )}
        {readOnly && !notConfigured && (
          <InlineAlert tone="info">AI generation is disabled in read-only support mode.</InlineAlert>
        )}

        {analyze.isPending && (
          <div className="space-y-2" role="status" aria-live="polite">
            <p className="text-sm font-medium text-violet-700">Analyzing project…</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
              <div className="animate-progress-indeterminate h-full w-2/5 rounded-full bg-violet-500" />
            </div>
          </div>
        )}

        {error && !notConfigured && !analyze.isPending && (
          <InlineAlert tone="danger" title="Something went wrong">
            <span className="flex flex-wrap items-center gap-2">
              Unable to generate AI insights right now. Please try again.
              <Button size="sm" variant="outline" onClick={run}>
                <RefreshCw /> Retry
              </Button>
            </span>
          </InlineAlert>
        )}

        {result && !analyze.isPending && (
          <div className="space-y-5 rounded-xl border border-violet-200 bg-violet-50/40 p-4" aria-live="polite">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">AI assessment</span>
                <HealthBadge health={result.insights.health} />
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{result.insights.summary}</p>
              {!result.parsedFromModel && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="size-3.5" aria-hidden /> The AI response could not be fully structured; showing a readable fallback.
                </p>
              )}
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <InsightList icon={AlertTriangle} title="Current risks" items={result.insights.risks} empty="No significant risks identified." />
              <InsightList icon={ClipboardList} title="Overdue work" items={result.insights.overdueWork} empty="Nothing is overdue." />
              <InsightList icon={ListChecks} title="Recommended next actions" items={result.insights.recommendedActions} empty="No actions suggested." />
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                    <MessageSquareQuote className="size-4 text-muted-foreground" aria-hidden /> Client update suggestion
                  </h4>
                  {result.insights.clientUpdate && (
                    <Button variant="ghost" size="sm" onClick={copyUpdate}>
                      {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </div>
                {result.insights.clientUpdate ? (
                  <blockquote className="rounded-lg border-l-4 border-violet-300 bg-surface px-3 py-2 text-sm italic leading-relaxed text-slate-700">
                    {result.insights.clientUpdate}
                  </blockquote>
                ) : (
                  <p className="text-sm text-muted-foreground">No suggestion.</p>
                )}
              </section>
            </div>
            <p className="text-xs text-muted-foreground">
              Generated {formatDateTime(result.generatedAt)} with {result.model}. Review before sharing — AI can be wrong.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
