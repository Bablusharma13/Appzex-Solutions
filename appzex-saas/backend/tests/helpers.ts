import http from 'node:http';
import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

export const app = createApp();
export const DEMO_PASSWORD = 'Demo@12345';

// Agents share one listening server (supertest would otherwise re-listen per request).
const server = http.createServer(app);
const serverReady = new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

export async function closeTestResources() {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
}

export const USERS = {
  superAdmin: 'superadmin@appzex-demo.com',
  brightwaveAdmin: 'agencyadmin@brightwave-demo.com',
  brightwaveMember: 'team@brightwave-demo.com',
  acmeClient: 'client@acme-demo.com',
  umbrellaClient: 'client@umbrella-demo.com',
  northstarAdmin: 'agencyadmin@northstar-demo.com',
  northstarMember: 'team@northstar-demo.com',
  globexClient: 'client@globex-demo.com',
  pixelAdmin: 'agencyadmin@pixelharbor-demo.com',
  pixelClient: 'client@harborcoffee-demo.com',
} as const;

/** Header required on state-changing requests (CSRF defence). */
export const CSRF = { 'X-Requested-With': 'vitest' };

export type Agent = ReturnType<typeof request.agent>;

export async function loginAs(email: string, password = DEMO_PASSWORD): Promise<Agent> {
  await serverReady;
  const agent = request.agent(server);
  const res = await agent.post('/api/auth/login').set(CSRF).send({ email, password });
  expect(res.status, `login failed for ${email}: ${JSON.stringify(res.body)}`).toBe(200);
  return agent;
}

export const projectByName = (name: string) => prisma.project.findFirstOrThrow({ where: { name } });
export const taskByTitle = (title: string) => prisma.task.findFirstOrThrow({ where: { title } });
export const fileByName = (originalName: string) => prisma.projectFile.findFirstOrThrow({ where: { originalName } });
export const userByEmail = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } });
export const agencyBySlug = (slug: string) => prisma.agency.findUniqueOrThrow({ where: { slug } });

export function expectDenied(status: number) {
  expect([403, 404]).toContain(status);
}
