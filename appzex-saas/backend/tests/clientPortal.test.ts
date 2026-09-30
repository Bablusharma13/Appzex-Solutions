import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import {
  type Agent,
  CSRF,
  USERS,
  closeTestResources,
  expectDenied,
  fileByName,
  loginAs,
  projectByName,
} from './helpers';

describe('Client portal isolation and workflow', () => {
  let acme: Agent;
  let umbrella: Agent;
  let brightwave: Agent;

  beforeAll(async () => {
    acme = await loginAs(USERS.acmeClient);
    umbrella = await loginAs(USERS.umbrellaClient);
    brightwave = await loginAs(USERS.brightwaveAdmin);
  });

  afterAll(closeTestResources);

  it('shows a client only their own projects', async () => {
    const res = await acme.get('/api/portal/projects');
    expect(res.status).toBe(200);
    const names = res.body.data.map((project: { name: string }) => project.name).sort();
    expect(names).toEqual(['SEO Campaign', 'Website Redesign']);
  });

  it('never exposes internal notes, private meetings, private files or internal activity', async () => {
    const website = await projectByName('Website Redesign');
    const res = await acme.get(`/api/portal/projects/${website.id}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);

    expect(body).not.toContain('Internal sprint sync'); // private meeting
    expect(body).not.toContain('INTERNAL:'); // raw internal notes
    expect(body).not.toContain('Internal-Estimate.csv'); // private file
    expect(body).not.toContain('Implement CMS integration'); // internal task
    expect(body).not.toContain('storageName');
    expect(body).not.toContain('"notes"');

    // Client-visible information is present
    expect(body).toContain('Project kickoff');
    expect(body).toContain('Website-Sitemap-v2.pdf');
    expect(body).toContain('Provide final product copy');
    expect(res.body.data.updates.every((event: { eventType: string }) => !event.eventType.startsWith('ai.'))).toBe(
      true,
    );
  });

  it('computes client-facing progress from all project tasks', async () => {
    const website = await projectByName('Website Redesign');
    const res = await acme.get(`/api/portal/projects/${website.id}`);
    expect(res.body.data.progress).toEqual({ totalTasks: 10, completedTasks: 5, percent: 50 });
  });

  it('allows downloading only client-visible files of own projects', async () => {
    const shared = await fileByName('Website-Sitemap-v2.pdf');
    const privateFile = await fileByName('Internal-Estimate.csv');

    const ok = await acme.get(`/api/files/${shared.id}`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('application/pdf');
    expect(ok.headers['content-disposition']).toContain('attachment');

    expectDenied((await acme.get(`/api/files/${privateFile.id}`)).status);
    expectDenied((await umbrella.get(`/api/files/${shared.id}`)).status);
  });

  it('cannot submit feedback or read feedback on another client project', async () => {
    const umbrellaProject = await projectByName('Patient Portal UX Audit');
    const umbrellaFeedback = await prisma.feedback.findFirstOrThrow({ where: { projectId: umbrellaProject.id } });

    expectDenied(
      (
        await acme
          .post(`/api/portal/projects/${umbrellaProject.id}/feedback`)
          .set(CSRF)
          .send({ title: 'Not mine', description: 'Should be rejected' })
      ).status,
    );
    expectDenied((await acme.get(`/api/portal/feedback/${umbrellaFeedback.id}`)).status);
    expectDenied(
      (await acme.post(`/api/portal/feedback/${umbrellaFeedback.id}/comments`).set(CSRF).send({ content: 'Sneaky' }))
        .status,
    );
  });

  it('feedback loop: client submits, agency responds, client sees the response', async () => {
    const website = await projectByName('Website Redesign');

    const created = await acme
      .post(`/api/portal/projects/${website.id}/feedback`)
      .set(CSRF)
      .send({ title: 'Please enlarge the logo', description: 'The logo in the header looks small on mobile.' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('OPEN');
    const feedbackId = created.body.data.id;

    const inbox = await brightwave.get('/api/feedback?status=OPEN&pageSize=100');
    expect(inbox.body.data.items.map((item: { id: string }) => item.id)).toContain(feedbackId);

    expect(
      (await brightwave.patch(`/api/feedback/${feedbackId}`).set(CSRF).send({ status: 'IN_PROGRESS' })).status,
    ).toBe(200);
    expect(
      (
        await brightwave
          .post(`/api/feedback/${feedbackId}/comments`)
          .set(CSRF)
          .send({ content: 'On it - new logo size in the next build.' })
      ).status,
    ).toBe(201);

    const detail = await acme.get(`/api/portal/feedback/${feedbackId}`);
    expect(detail.body.data.status).toBe('IN_PROGRESS');
    expect(detail.body.data.comments.at(-1).content).toBe('On it - new logo size in the next build.');

    const events = await prisma.activityLog.findMany({
      where: { entityId: feedbackId },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((event) => event.eventType)).toEqual([
      'feedback.submitted',
      'feedback.status_changed',
      'feedback.comment_added',
    ]);
    expect(events.every((event) => event.visibility === 'CLIENT')).toBe(true);
  });

  it('client portal dashboard is scoped to the client company', async () => {
    const res = await umbrella.get('/api/portal/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.client.companyName).toBe('Umbrella Health');
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('Website Redesign');
    expect(body).not.toContain('Acme');
  });
});
