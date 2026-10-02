import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import {
  type Agent,
  CSRF,
  USERS,
  closeTestResources,
  agencyBySlug,
  expectDenied,
  fileByName,
  loginAs,
  projectByName,
  taskByTitle,
  userByEmail,
} from './helpers';

describe('Agency tenant isolation', () => {
  let brightwave: Agent;
  let northstarAgencyId: string;

  beforeAll(async () => {
    brightwave = await loginAs(USERS.brightwaveAdmin);
    northstarAgencyId = (await agencyBySlug('northstar-creative')).id;
  });

  afterAll(closeTestResources);

  it('lists only the caller agency data', async () => {
    const [projects, clients, tasks, team, activity, files, meetings, feedback] = await Promise.all(
      [
        '/api/projects',
        '/api/clients',
        '/api/tasks?pageSize=100',
        '/api/team',
        '/api/activity?pageSize=100',
        '/api/files?pageSize=100',
        '/api/meetings?pageSize=100',
        '/api/feedback?pageSize=100',
      ].map((url) => brightwave.get(url)),
    );
    const names = projects.body.data.items.map((project: { name: string }) => project.name);
    expect(names).toContain('Website Redesign');
    expect(names).not.toContain('Brand Identity');
    expect(names).not.toContain('Marketing Website');

    const clientNames = clients.body.data.items.map((client: { companyName: string }) => client.companyName);
    expect(clientNames).not.toContain('Globex Industries');

    const serialized = JSON.stringify([tasks.body, team.body, activity.body, files.body, meetings.body, feedback.body]);
    for (const leak of ['NorthStar', 'Globex', 'Initech', 'Daniel Okafor', 'Logo concepts', 'Brand-Concepts']) {
      expect(serialized).not.toContain(leak);
    }
  });

  it('ignores agency filters that point at another tenant', async () => {
    const globex = await prisma.client.findFirstOrThrow({ where: { companyName: 'Globex Industries' } });
    const res = await brightwave.get(`/api/projects?clientId=${globex.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('cannot read another agency client, milestone, meeting, feedback or file', async () => {
    const globex = await prisma.client.findFirstOrThrow({ where: { companyName: 'Globex Industries' } });
    const brandIdentity = await projectByName('Brand Identity');
    const feedback = await prisma.feedback.findFirstOrThrow({ where: { projectId: brandIdentity.id } });
    const file = await fileByName('Globex-Budget-Tracking.csv');

    const responses = await Promise.all([
      brightwave.get(`/api/clients/${globex.id}`),
      brightwave.get(`/api/projects/${brandIdentity.id}/milestones`),
      brightwave.get(`/api/projects/${brandIdentity.id}/meetings`),
      brightwave.get(`/api/projects/${brandIdentity.id}/feedback`),
      brightwave.get(`/api/projects/${brandIdentity.id}/files`),
      brightwave.get(`/api/projects/${brandIdentity.id}/activity`),
      brightwave.get(`/api/feedback/${feedback.id}`),
      brightwave.get(`/api/files/${file.id}`),
    ]);
    responses.forEach((res) => expectDenied(res.status));
  });

  it('cannot write into another agency', async () => {
    const brandIdentity = await projectByName('Brand Identity');
    const milestone = await prisma.milestone.findFirstOrThrow({ where: { projectId: brandIdentity.id } });
    const meeting = await prisma.meeting.findFirstOrThrow({ where: { projectId: brandIdentity.id } });
    const feedback = await prisma.feedback.findFirstOrThrow({ where: { projectId: brandIdentity.id } });
    const task = await taskByTitle('Colour palette');
    const file = await fileByName('Brand-Concepts-Presentation.pdf');

    const attempts = await Promise.all([
      brightwave.post(`/api/projects/${brandIdentity.id}/tasks`).set(CSRF).send({ title: 'Injected task' }),
      brightwave.post(`/api/projects/${brandIdentity.id}/milestones`).set(CSRF).send({ name: 'Injected milestone' }),
      brightwave
        .post(`/api/projects/${brandIdentity.id}/meetings`)
        .set(CSRF)
        .send({ title: 'Injected', meetingDate: new Date().toISOString() }),
      brightwave
        .post(`/api/projects/${brandIdentity.id}/feedback`)
        .set(CSRF)
        .send({ title: 'Injected', description: 'Injected feedback' }),
      brightwave.patch(`/api/tasks/${task.id}`).set(CSRF).send({ status: 'COMPLETED' }),
      brightwave.delete(`/api/tasks/${task.id}`).set(CSRF),
      brightwave.patch(`/api/milestones/${milestone.id}`).set(CSRF).send({ status: 'COMPLETED' }),
      brightwave.patch(`/api/meetings/${meeting.id}`).set(CSRF).send({ clientVisible: true }),
      brightwave.patch(`/api/feedback/${feedback.id}`).set(CSRF).send({ status: 'DECLINED' }),
      brightwave.post(`/api/feedback/${feedback.id}/comments`).set(CSRF).send({ content: 'Injected comment' }),
      brightwave.post(`/api/tasks/${task.id}/comments`).set(CSRF).send({ content: 'Injected comment' }),
      brightwave.patch(`/api/files/${file.id}`).set(CSRF).send({ clientVisible: false }),
      brightwave.delete(`/api/files/${file.id}`).set(CSRF),
    ]);
    attempts.forEach((res) => expectDenied(res.status));

    const injected = await prisma.task.count({ where: { title: 'Injected task' } });
    expect(injected).toBe(0);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe(task.status);
    expect(await prisma.feedbackComment.count({ where: { content: 'Injected comment' } })).toBe(0);
  });

  it('refuses to link a project to another agency client or manager', async () => {
    const globex = await prisma.client.findFirstOrThrow({ where: { companyName: 'Globex Industries' } });
    const acme = await prisma.client.findFirstOrThrow({ where: { companyName: 'Acme Corporation' } });
    const northstarMember = await userByEmail(USERS.northstarMember);

    const foreignClient = await brightwave
      .post('/api/projects')
      .set(CSRF)
      .send({ name: 'Cross-tenant project', clientId: globex.id });
    expect(foreignClient.status).toBe(422);
    expect(foreignClient.body.errors[0].path).toBe('clientId');

    const foreignManager = await brightwave
      .post('/api/projects')
      .set(CSRF)
      .send({ name: 'Cross-tenant project', clientId: acme.id, managerId: northstarMember.id });
    expect(foreignManager.status).toBe(422);
    expect(foreignManager.body.errors[0].path).toBe('managerId');

    expect(await prisma.project.count({ where: { name: 'Cross-tenant project' } })).toBe(0);
  });

  it('refuses to assign tasks to users from another agency', async () => {
    const website = await projectByName('Website Redesign');
    const northstarAdmin = await userByEmail(USERS.northstarAdmin);
    const res = await brightwave
      .post(`/api/projects/${website.id}/tasks`)
      .set(CSRF)
      .send({ title: 'Assign across tenants', assigneeId: northstarAdmin.id });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].path).toBe('assigneeId');
  });

  it('ignores agencyId supplied in the request body', async () => {
    const res = await brightwave
      .post('/api/clients')
      .set(CSRF)
      .send({ companyName: 'Body AgencyId Test Ltd', agencyId: northstarAgencyId });
    expect(res.status).toBe(201);
    const created = await prisma.client.findUniqueOrThrow({ where: { id: res.body.data.id } });
    const brightwaveAgency = await agencyBySlug('brightwave-digital');
    expect(created.agencyId).toBe(brightwaveAgency.id);
  });

  it('prevents a milestone from another project being attached to a task', async () => {
    const website = await projectByName('Website Redesign');
    const seo = await projectByName('SEO Campaign');
    const seoMilestone = await prisma.milestone.findFirstOrThrow({ where: { projectId: seo.id } });
    const res = await brightwave
      .post(`/api/projects/${website.id}/tasks`)
      .set(CSRF)
      .send({ title: 'Wrong milestone', milestoneId: seoMilestone.id });
    expect(res.status).toBe(422);
  });

  it('scopes the client activity timeline to that client only', async () => {
    const acme = await prisma.client.findFirstOrThrow({ where: { companyName: 'Acme Corporation' } });
    const res = await brightwave.get(`/api/clients/${acme.id}/activity?pageSize=100`);
    expect(res.status).toBe(200);

    const items = res.body.data.items as { project: { name: string } | null }[];
    expect(items.length).toBeGreaterThan(0);
    // Every project named in the timeline must be an Acme project.
    const projectNames = [...new Set(items.map((item) => item.project?.name).filter(Boolean))];
    expect(projectNames).toContain('Website Redesign');
    for (const foreign of ['Brand Identity', 'Marketing Website']) {
      expect(projectNames).not.toContain(foreign);
    }

    const serialized = JSON.stringify(res.body);
    for (const leak of ['Globex', 'NorthStar', 'Initech', 'Daniel Okafor']) {
      expect(serialized).not.toContain(leak);
    }
  });

  it('cannot read another agency client activity timeline', async () => {
    const globex = await prisma.client.findFirstOrThrow({ where: { companyName: 'Globex Industries' } });
    const res = await brightwave.get(`/api/clients/${globex.id}/activity`);
    expectDenied(res.status);
  });
});
