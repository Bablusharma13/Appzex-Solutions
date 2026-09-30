import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { type Agent, CSRF, USERS, closeTestResources, agencyBySlug, loginAs, projectByName } from './helpers';

describe('Super admin portal, suspension and support mode', () => {
  let superAdmin: Agent;

  beforeAll(async () => {
    superAdmin = await loginAs(USERS.superAdmin);
  });

  afterAll(async () => {
    // Leave the demo state as seeded: Pixel Harbor suspended.
    const pixel = await agencyBySlug('pixel-harbor-studio');
    await prisma.agency.update({ where: { id: pixel.id }, data: { status: 'SUSPENDED' } });
    await closeTestResources();
  });

  it('calculates platform metrics from the database', async () => {
    const res = await superAdmin.get('/api/super-admin/dashboard');
    expect(res.status).toBe(200);
    const [agencies, active, suspended] = await Promise.all([
      prisma.agency.count(),
      prisma.agency.count({ where: { status: 'ACTIVE' } }),
      prisma.agency.count({ where: { status: 'SUSPENDED' } }),
    ]);
    expect(res.body.data.stats).toMatchObject({
      totalAgencies: agencies,
      activeAgencies: active,
      suspendedAgencies: suspended,
    });
  });

  it('searches, filters and paginates agencies server-side', async () => {
    const search = await superAdmin.get('/api/super-admin/agencies?search=north');
    expect(search.body.data.items.map((agency: { name: string }) => agency.name)).toEqual(['NorthStar Creative']);

    const suspended = await superAdmin.get('/api/super-admin/agencies?status=SUSPENDED');
    expect(suspended.body.data.items.every((agency: { status: string }) => agency.status === 'SUSPENDED')).toBe(true);

    const paged = await superAdmin.get('/api/super-admin/agencies?pageSize=1&page=2&sort=name&order=asc');
    expect(paged.body.data.items).toHaveLength(1);
    expect(paged.body.data.pagination).toMatchObject({ page: 2, pageSize: 1 });
    expect(paged.body.data.items[0].counts).toHaveProperty('projects');
  });

  it('suspending an agency immediately blocks existing sessions of its users', async () => {
    const pixel = await agencyBySlug('pixel-harbor-studio');
    await superAdmin
      .patch(`/api/super-admin/agencies/${pixel.id}/status`)
      .set(CSRF)
      .send({ status: 'ACTIVE' })
      .expect(200);

    const pixelAdmin = await loginAs(USERS.pixelAdmin);
    const pixelClient = await loginAs(USERS.pixelClient);
    expect((await pixelAdmin.get('/api/projects')).status).toBe(200);
    expect((await pixelClient.get('/api/portal/projects')).status).toBe(200);

    const suspend = await superAdmin
      .patch(`/api/super-admin/agencies/${pixel.id}/status`)
      .set(CSRF)
      .send({ status: 'SUSPENDED', reason: 'Automated test' });
    expect(suspend.status).toBe(200);
    expect(suspend.body.data.status).toBe('SUSPENDED');

    const blocked = await pixelAdmin.get('/api/projects');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('AGENCY_SUSPENDED');
    expect((await pixelClient.get('/api/portal/projects')).status).toBe(403);

    const events = await prisma.activityLog.findMany({
      where: { agencyId: pixel.id, eventType: { in: ['agency.suspended', 'agency.activated'] } },
    });
    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(['agency.suspended', 'agency.activated']),
    );
  });

  it('is not an agency user: no workspace access outside support mode', async () => {
    expect((await superAdmin.get('/api/projects')).status).toBe(403);
    expect((await superAdmin.get('/api/portal/dashboard')).status).toBe(403);
  });

  it('support mode: read-only access to exactly one agency, fully audited', async () => {
    const brightwave = await agencyBySlug('brightwave-digital');
    const start = await superAdmin
      .post(`/api/super-admin/agencies/${brightwave.id}/support-session`)
      .set(CSRF)
      .send({ reason: 'Automated support test' });
    expect(start.status).toBe(201);
    const sessionId = start.body.data.session.id;
    expect(start.body.data.profile.supportSession).toMatchObject({ agencyName: 'BrightWave Digital', readOnly: true });

    // Reads inside the agency work
    const projects = await superAdmin.get('/api/projects');
    expect(projects.status).toBe(200);
    expect(projects.body.data.items.map((project: { name: string }) => project.name)).toContain('Website Redesign');

    // Writes are blocked
    const write = await superAdmin.post('/api/clients').set(CSRF).send({ companyName: 'Support Write Test' });
    expect(write.status).toBe(403);
    expect(write.body.code).toBe('SUPPORT_READ_ONLY');

    // Other agencies remain invisible
    const northstarProject = await projectByName('Brand Identity');
    expect((await superAdmin.get(`/api/projects/${northstarProject.id}`)).status).toBe(404);

    // Super admin endpoints keep working
    expect((await superAdmin.get('/api/super-admin/dashboard')).status).toBe(200);

    const end = await superAdmin.post(`/api/super-admin/support-session/${sessionId}/end`).set(CSRF);
    expect(end.status).toBe(200);
    expect(end.body.data.profile.supportSession).toBeNull();
    expect((await superAdmin.get('/api/projects')).status).toBe(403);

    const audit = await prisma.activityLog.findMany({ where: { entityId: sessionId }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((event) => event.eventType)).toEqual(['support.session_started', 'support.session_ended']);
    const session = await prisma.supportSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.endedAt).not.toBeNull();
  });

  it('creates a new agency with its admin in one transaction', async () => {
    const res = await superAdmin.post('/api/super-admin/agencies').set(CSRF).send({
      name: 'Test Harbor Agency',
      contactEmail: 'owner@testharbor-demo.com',
      plan: 'GROWTH',
      adminName: 'Test Owner',
      adminEmail: 'owner@testharbor-demo.com',
      adminPassword: 'Str0ngPass!',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('test-harbor-agency');

    const newAdmin = await loginAs('owner@testharbor-demo.com', 'Str0ngPass!');
    const me = await newAdmin.get('/api/auth/me');
    expect(me.body.data.agency.name).toBe('Test Harbor Agency');
    const projects = await newAdmin.get('/api/projects');
    expect(projects.body.data.items).toHaveLength(0);

    const events = await prisma.activityLog.findMany({ where: { agencyId: res.body.data.id } });
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining(['agency.created', 'user.created']));
  });
});
