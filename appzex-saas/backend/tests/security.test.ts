/**
 * The ten required authorization / tenant-isolation checks from the brief.
 * Each test logs in as a real seeded user and calls the real HTTP API
 * against a real MySQL database.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { issueToken } from '../src/services/authService';
import { SESSION_COOKIE } from '../src/utils/cookies';
import {
  type Agent,
  CSRF,
  USERS,
  closeTestResources,
  app,
  expectDenied,
  fileByName,
  loginAs,
  projectByName,
  taskByTitle,
  userByEmail,
} from './helpers';

describe('Required security tests', () => {
  let brightwaveAdmin: Agent;
  let acmeClient: Agent;

  beforeAll(async () => {
    brightwaveAdmin = await loginAs(USERS.brightwaveAdmin);
    acmeClient = await loginAs(USERS.acmeClient);
  });

  afterAll(closeTestResources);

  it('TEST 1: Agency A cannot access an Agency B project', async () => {
    const northstarProject = await projectByName('Brand Identity');
    const res = await brightwaveAdmin.get(`/api/projects/${northstarProject.id}`);
    expectDenied(res.status);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('Brand Identity');
  });

  it('TEST 2: Agency A cannot access an Agency B task', async () => {
    const northstarTask = await taskByTitle('Logo concepts (3 routes)');
    const res = await brightwaveAdmin.get(`/api/tasks/${northstarTask.id}`);
    expectDenied(res.status);

    const comments = await brightwaveAdmin.get(`/api/tasks/${northstarTask.id}/comments`);
    expectDenied(comments.status);
  });

  it('TEST 3: Agency A cannot modify an Agency B project', async () => {
    const northstarProject = await projectByName('Brand Identity');

    const patch = await brightwaveAdmin
      .patch(`/api/projects/${northstarProject.id}`)
      .set(CSRF)
      .send({ name: 'Hijacked', status: 'COMPLETED' });
    expectDenied(patch.status);

    const del = await brightwaveAdmin.delete(`/api/projects/${northstarProject.id}`).set(CSRF);
    expectDenied(del.status);

    const unchanged = await prisma.project.findUniqueOrThrow({ where: { id: northstarProject.id } });
    expect(unchanged.name).toBe('Brand Identity');
    expect(unchanged.status).toBe(northstarProject.status);
    expect(unchanged.deletedAt).toBeNull();
  });

  it("TEST 4: Client 1 cannot access Client 2's project", async () => {
    // Same agency, different client company
    const umbrellaProject = await projectByName('Patient Portal UX Audit');
    const sameAgency = await acmeClient.get(`/api/portal/projects/${umbrellaProject.id}`);
    expectDenied(sameAgency.status);
    expect(JSON.stringify(sameAgency.body)).not.toContain('Patient Portal');

    // Different agency altogether
    const globexProject = await projectByName('Brand Identity');
    const otherAgency = await acmeClient.get(`/api/portal/projects/${globexProject.id}`);
    expectDenied(otherAgency.status);
  });

  it('TEST 5: Client cannot call internal agency APIs', async () => {
    const acmeProject = await projectByName('Website Redesign');
    const internalEndpoints = [
      '/api/dashboard',
      '/api/projects',
      `/api/projects/${acmeProject.id}`,
      `/api/projects/${acmeProject.id}/tasks`,
      '/api/clients',
      '/api/tasks',
      '/api/team',
      '/api/activity',
      '/api/files',
    ];
    for (const endpoint of internalEndpoints) {
      const res = await acmeClient.get(endpoint);
      expect(res.status, endpoint).toBe(403);
    }
    const write = await acmeClient.post('/api/clients').set(CSRF).send({ companyName: 'Sneaky Co' });
    expect(write.status).toBe(403);
  });

  it("TEST 6: Client cannot download another client's file", async () => {
    const umbrellaFile = await fileByName('Usability-Findings-Summary.pdf'); // same agency, other client
    const globexFile = await fileByName('Brand-Concepts-Presentation.pdf'); // other agency

    for (const file of [umbrellaFile, globexFile]) {
      const res = await acmeClient.get(`/api/files/${file.id}`);
      expectDenied(res.status);
      expect(res.headers['content-disposition']).toBeUndefined();
    }
  });

  it('TEST 7: Agency users cannot access Super Admin endpoints', async () => {
    const member = await loginAs(USERS.brightwaveMember);
    for (const agent of [brightwaveAdmin, member, acmeClient]) {
      expect((await agent.get('/api/super-admin/dashboard')).status).toBe(403);
      expect((await agent.get('/api/super-admin/agencies')).status).toBe(403);
    }
    const northstar = await prisma.agency.findUniqueOrThrow({ where: { slug: 'northstar-creative' } });
    const suspendAttempt = await brightwaveAdmin
      .patch(`/api/super-admin/agencies/${northstar.id}/status`)
      .set(CSRF)
      .send({ status: 'SUSPENDED' });
    expect(suspendAttempt.status).toBe(403);
  });

  it('TEST 8: A suspended agency cannot call the API', async () => {
    // Pixel Harbor Studio is seeded as SUSPENDED. Simulate a session token that
    // was issued before the suspension: the API must still reject it.
    const pixelAdmin = await userByEmail(USERS.pixelAdmin);
    const membership = await prisma.agencyMember.findUniqueOrThrow({ where: { userId: pixelAdmin.id } });
    const token = issueToken(pixelAdmin, membership.agencyId);

    const res = await request(app).get('/api/projects').set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Your agency account is currently suspended. Please contact support.');

    // Its client users are blocked as well
    const pixelClient = await userByEmail(USERS.pixelClient);
    const clientToken = issueToken(pixelClient, membership.agencyId);
    const clientRes = await request(app).get('/api/portal/dashboard').set('Cookie', `${SESSION_COOKIE}=${clientToken}`);
    expect(clientRes.status).toBe(403);

    // And login is refused
    const login = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: USERS.pixelAdmin, password: 'Demo@12345' });
    expect(login.status).toBe(403);
  });

  it('TEST 9: Unauthenticated requests to protected APIs return 401', async () => {
    const endpoints = [
      '/api/auth/me',
      '/api/projects',
      '/api/dashboard',
      '/api/portal/dashboard',
      '/api/super-admin/dashboard',
    ];
    for (const endpoint of endpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status, endpoint).toBe(401);
    }
    const tampered = await request(app).get('/api/projects').set('Cookie', `${SESSION_COOKIE}=not-a-real-token`);
    expect(tampered.status).toBe(401);
  });

  it('TEST 10: Wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: USERS.brightwaveAdmin, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
    expect(res.headers['set-cookie']).toBeUndefined();

    // Unknown emails get the identical response (no account enumeration)
    const unknown = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: 'nobody@example.com', password: 'x' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(res.body.message);
  });
});
