import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { CSRF, DEMO_PASSWORD, USERS, closeTestResources, app, loginAs, userByEmail } from './helpers';

describe('Authentication', () => {
  afterAll(closeTestResources);

  it('sets an HttpOnly session cookie and never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: USERS.brightwaveAdmin, password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('appzex_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect(res.body.data.home).toBe('/app/dashboard');
  });

  it('stores passwords as bcrypt hashes', async () => {
    const user = await userByEmail(USERS.brightwaveAdmin);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(user.passwordHash).not.toContain(DEMO_PASSWORD);
  });

  it.each([
    [USERS.superAdmin, 'SUPER_ADMIN', '/super-admin/dashboard'],
    [USERS.brightwaveAdmin, 'AGENCY_ADMIN', '/app/dashboard'],
    [USERS.brightwaveMember, 'AGENCY_MEMBER', '/app/dashboard'],
    [USERS.acmeClient, 'CLIENT', '/client/dashboard'],
  ])('resolves %s to role %s and home %s', async (email, role, home) => {
    const agent = await loginAs(email);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.role).toBe(role);
    expect(me.body.data.home).toBe(home);
  });

  it('logout revokes the session token server-side', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: USERS.northstarMember, password: DEMO_PASSWORD });
    const cookie = String(login.headers['set-cookie']).split(';')[0];

    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).post('/api/auth/logout').set(CSRF).set('Cookie', cookie)).status).toBe(200);

    // Replaying the old token after logout must fail (tokenVersion was bumped)
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('rejects malformed login payloads with 422 and field errors', async () => {
    const res = await request(app).post('/api/auth/login').set(CSRF).send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors.map((error: { path: string }) => error.path)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USERS.brightwaveAdmin, password: DEMO_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_REJECTED');
  });

  it('rejects requests from origins that are not allow-listed', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .set('Origin', 'https://evil.example')
      .send({ email: USERS.brightwaveAdmin, password: DEMO_PASSWORD });
    expect(res.status).toBe(403);
  });

  it('blocks deactivated users even with a previously valid session', async () => {
    const agent = await loginAs(USERS.northstarMember);
    const user = await userByEmail(USERS.northstarMember);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    try {
      expect((await agent.get('/api/projects')).status).toBe(403);
    } finally {
      await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
    }
  });

  it('returns consistent JSON errors for unknown routes', async () => {
    const res = await request(app).get('/api/super-admin/does-not-exist');
    expect(res.status).toBe(401);
    const admin = await loginAs(USERS.superAdmin);
    const missing = await admin.get('/api/super-admin/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, message: 'Route not found', code: 'NOT_FOUND' });
  });
});
