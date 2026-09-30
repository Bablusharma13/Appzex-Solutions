import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { type Agent, CSRF, USERS, closeTestResources, loginAs, userByEmail } from './helpers';

describe('Agency project workflow', () => {
  let admin: Agent;
  let member: Agent;

  beforeAll(async () => {
    admin = await loginAs(USERS.brightwaveAdmin);
    member = await loginAs(USERS.brightwaveMember);
  });

  afterAll(closeTestResources);

  it('client -> project -> milestones -> tasks, with progress derived from tasks', async () => {
    const client = await admin.post('/api/clients').set(CSRF).send({
      companyName: 'Workflow Test Co',
      contactName: 'Pat Doe',
      email: 'pat@workflow-demo.com',
    });
    expect(client.status).toBe(201);

    const leo = await userByEmail(USERS.brightwaveMember);
    const project = await admin.post('/api/projects').set(CSRF).send({
      name: 'Workflow Launch',
      clientId: client.body.data.id,
      managerId: leo.id,
      startDate: '2026-01-01',
      dueDate: '2026-03-01',
      priority: 'HIGH',
      createDefaultMilestones: true,
    });
    expect(project.status).toBe(201);
    const projectId = project.body.data.id;

    const milestones = await admin.get(`/api/projects/${projectId}/milestones`);
    expect(milestones.body.data.map((m: { name: string }) => m.name)).toEqual([
      'Planning',
      'Design',
      'Development',
      'Testing',
      'Client Review',
      'Launch',
    ]);

    const detail = await admin.get(`/api/projects/${projectId}`);
    expect(detail.body.data.progress).toEqual({ totalTasks: 0, completedTasks: 0, percent: 0 });

    const taskIds: string[] = [];
    for (const title of ['Task one', 'Task two', 'Task three', 'Task four']) {
      const res = await member
        .post(`/api/projects/${projectId}/tasks`)
        .set(CSRF)
        .send({ title, milestoneId: milestones.body.data[0].id });
      expect(res.status).toBe(201);
      taskIds.push(res.body.data.task.id);
    }

    const first = await member.patch(`/api/tasks/${taskIds[0]}`).set(CSRF).send({ status: 'COMPLETED' });
    expect(first.body.data.projectProgress).toEqual({ totalTasks: 4, completedTasks: 1, percent: 25 });

    await member.patch(`/api/tasks/${taskIds[1]}`).set(CSRF).send({ status: 'COMPLETED' });
    const reopened = await member.patch(`/api/tasks/${taskIds[0]}`).set(CSRF).send({ status: 'TODO' });
    expect(reopened.body.data.projectProgress.percent).toBe(25);

    const events = await prisma.activityLog.findMany({ where: { projectId }, select: { eventType: true } });
    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(['project.created', 'task.created', 'task.completed', 'task.reopened']),
    );

    // Progress is never accepted from input
    const tamper = await admin.patch(`/api/projects/${projectId}`).set(CSRF).send({ progress: 100 });
    expect(tamper.status).toBe(200);
    expect((await admin.get(`/api/projects/${projectId}`)).body.data.progress.percent).toBe(25);
  });

  it('validates project input on the server', async () => {
    const missing = await admin.post('/api/projects').set(CSRF).send({ description: 'no name or client' });
    expect(missing.status).toBe(422);
    const paths = missing.body.errors.map((error: { path: string }) => error.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'clientId']));

    const acme = await prisma.client.findFirstOrThrow({ where: { companyName: 'Acme Corporation' } });
    const badDates = await admin
      .post('/api/projects')
      .set(CSRF)
      .send({ name: 'Bad dates', clientId: acme.id, startDate: '2026-05-01', dueDate: '2026-04-01' });
    expect(badDates.status).toBe(422);
    expect(badDates.body.errors[0].path).toBe('dueDate');
  });

  it('enforces admin-only actions for agency members', async () => {
    expect((await member.post('/api/clients').set(CSRF).send({ companyName: 'Member Client' })).status).toBe(403);
    expect(
      (await member.post('/api/team').set(CSRF).send({ name: 'X', email: 'x@y.com', password: 'Passw0rd!' })).status,
    ).toBe(403);

    const project = await prisma.project.findFirstOrThrow({ where: { name: 'Workflow Launch' } });
    expect((await member.delete(`/api/projects/${project.id}`).set(CSRF)).status).toBe(403);
  });

  it('soft-deletes projects and hides their tasks', async () => {
    const project = await prisma.project.findFirstOrThrow({ where: { name: 'Workflow Launch' } });
    expect((await admin.delete(`/api/projects/${project.id}`).set(CSRF)).status).toBe(200);
    expect((await admin.get(`/api/projects/${project.id}`)).status).toBe(404);

    const tasks = await admin.get(`/api/tasks?projectId=${project.id}`);
    expect(tasks.body.data.items).toHaveLength(0);

    const stored = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(stored.deletedAt).not.toBeNull();
  });

  it('will not delete a client that still has projects', async () => {
    const acme = await prisma.client.findFirstOrThrow({ where: { companyName: 'Acme Corporation' } });
    const res = await admin.delete(`/api/clients/${acme.id}`).set(CSRF);
    expect(res.status).toBe(409);
  });

  it('task due-date buckets are computed server-side', async () => {
    const summary = await admin.get('/api/tasks/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.data.overdue).toBeGreaterThan(0);

    const overdue = await admin.get('/api/tasks?due=overdue&pageSize=100');
    const today = new Date().toISOString().slice(0, 10);
    for (const task of overdue.body.data.items) {
      expect(task.status).not.toBe('COMPLETED');
      expect(task.dueDate.slice(0, 10) < today).toBe(true);
    }
  });
});
