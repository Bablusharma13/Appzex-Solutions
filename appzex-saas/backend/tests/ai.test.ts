import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AIProvider, getAIProvider } from '../src/services/ai/aiProvider';
import { type Agent, CSRF, USERS, closeTestResources, loginAs, projectByName } from './helpers';

// The real provider is replaced so tests never call OpenAI.
vi.mock('../src/services/ai/aiProvider', () => ({ getAIProvider: vi.fn() }));

const mockedGetProvider = vi.mocked(getAIProvider);

function providerReturning(impl: AIProvider['completeJson']) {
  const completeJson = vi.fn(impl);
  mockedGetProvider.mockReturnValue({ model: 'test-model', completeJson });
  return completeJson;
}

describe('AI Project Health Assistant', () => {
  let brightwave: Agent;
  let websiteId: string;

  beforeAll(async () => {
    brightwave = await loginAs(USERS.brightwaveAdmin);
    websiteId = (await projectByName('Website Redesign')).id;
  });

  beforeEach(() => mockedGetProvider.mockReset());
  afterAll(closeTestResources);

  it('explains how to enable AI when OPENAI_API_KEY is missing', async () => {
    mockedGetProvider.mockReturnValue(null);
    const res = await brightwave.post('/api/ai/project-health').set(CSRF).send({ projectId: websiteId });
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('AI service is not configured. Add OPENAI_API_KEY to enable this feature.');
  });

  it('never sends another tenant project to the AI provider', async () => {
    const completeJson = providerReturning(async () => '{}');
    const northstarProject = await projectByName('Brand Identity');

    const res = await brightwave.post('/api/ai/project-health').set(CSRF).send({ projectId: northstarProject.id });
    expect(res.status).toBe(404);
    expect(completeJson).not.toHaveBeenCalled();

    const summary = await brightwave
      .post('/api/ai/meeting-summary')
      .set(CSRF)
      .send({ projectId: northstarProject.id, notes: 'These notes should never reach the model for this tenant.' });
    expect(summary.status).toBe(404);
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('sends only the authorized project facts and validates the model output', async () => {
    const completeJson = providerReturning(async () =>
      JSON.stringify({
        health: 'AT_RISK',
        summary: 'Development is behind: two tasks are overdue.',
        risks: ['CMS integration overdue'],
        overdueWork: ['Build responsive homepage'],
        recommendedActions: ['Reassign product listing pages'],
        clientUpdate: 'Development is progressing; we are prioritising the CMS integration this week.',
      }),
    );

    const res = await brightwave.post('/api/ai/project-health').set(CSRF).send({ projectId: websiteId });
    expect(res.status).toBe(200);
    expect(res.body.data.parsedFromModel).toBe(true);
    expect(res.body.data.insights.health).toBe('AT_RISK');
    expect(res.body.data.facts.metrics).toMatchObject({ totalTasks: 10, completedTasks: 5, completionPercentage: 50 });

    const sentPayload = JSON.parse(completeJson.mock.calls[0][0].user);
    expect(sentPayload.project.name).toBe('Website Redesign');
    const serialized = JSON.stringify(sentPayload);
    // Data minimisation: no other tenants, no contact details or credentials
    expect(serialized).not.toContain('NorthStar');
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('passwordHash');
  });

  it('falls back to a readable response when the model returns invalid JSON', async () => {
    providerReturning(async () => 'Sorry, here is some prose instead of JSON.');
    const res = await brightwave.post('/api/ai/project-health').set(CSRF).send({ projectId: websiteId });
    expect(res.status).toBe(200);
    expect(res.body.data.parsedFromModel).toBe(false);
    expect(res.body.data.insights.summary).toContain('prose');
    expect(['ON_TRACK', 'AT_RISK', 'CRITICAL']).toContain(res.body.data.insights.health);
  });

  it('returns a friendly error when the provider fails', async () => {
    providerReturning(async () => {
      throw new Error('upstream timeout');
    });
    const res = await brightwave.post('/api/ai/project-health').set(CSRF).send({ projectId: websiteId });
    expect(res.status).toBe(502);
    expect(res.body.message).toBe('Unable to generate AI insights right now. Please try again.');
    expect(JSON.stringify(res.body)).not.toContain('upstream timeout');
  });

  it('summarizes meeting notes into reviewable structured output', async () => {
    providerReturning(async () =>
      JSON.stringify({
        summary: 'Agreed to launch in March.',
        keyDecisions: ['Launch date set'],
        actionItems: [
          { title: 'Send launch checklist', owner: 'Leo', dueDate: '2026-03-01' },
          { title: 'Book photographer', owner: null, dueDate: 'next week' },
        ],
        deadlines: ['Launch in March'],
      }),
    );
    const res = await brightwave
      .post('/api/ai/meeting-summary')
      .set(CSRF)
      .send({ projectId: websiteId, notes: 'We agreed to launch in March. Leo sends the checklist by 1 March.' });
    expect(res.status).toBe(200);
    expect(res.body.data.result.actionItems).toEqual([
      { title: 'Send launch checklist', owner: 'Leo', dueDate: '2026-03-01' },
      { title: 'Book photographer', owner: null, dueDate: null },
    ]);
  });

  it('is unavailable to clients', async () => {
    const client = await loginAs(USERS.acmeClient);
    const res = await client.post('/api/ai/project-health').set(CSRF).send({ projectId: websiteId });
    expect(res.status).toBe(403);
  });
});
