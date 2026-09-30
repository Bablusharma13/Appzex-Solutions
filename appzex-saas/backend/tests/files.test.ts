import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import { type Agent, CSRF, USERS, closeTestResources, expectDenied, loginAs, projectByName } from './helpers';

const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('Secure file handling', () => {
  let brightwave: Agent;
  let northstar: Agent;
  let acme: Agent;
  let websiteId: string;

  beforeAll(async () => {
    brightwave = await loginAs(USERS.brightwaveAdmin);
    northstar = await loginAs(USERS.northstarAdmin);
    acme = await loginAs(USERS.acmeClient);
    websiteId = (await projectByName('Website Redesign')).id;
  });

  afterAll(closeTestResources);

  it('uploads to private storage with a server-generated name and never exposes it', async () => {
    const res = await brightwave
      .post(`/api/projects/${websiteId}/files`)
      .set(CSRF)
      .field('clientVisible', 'false')
      .attach('file', PDF_BYTES, { filename: 'Contract Draft.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.data.originalName).toBe('Contract Draft.pdf');
    expect(res.body.data.mimeType).toBe('application/pdf');
    expect(res.body.data).not.toHaveProperty('storageName');

    const record = await prisma.projectFile.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(record.storageName).toMatch(/^[a-f0-9-]{36}\.pdf$/);
    expect(existsSync(path.join(env.uploadDir, record.storageName))).toBe(true);

    // Download streams the exact bytes back through the authorized endpoint
    const download = await brightwave.get(`/api/files/${record.id}`).buffer(true);
    expect(download.status).toBe(200);
    expect(Buffer.compare(download.body as Buffer, PDF_BYTES)).toBe(0);

    // Other agency and the client (file is internal) are denied
    expectDenied((await northstar.get(`/api/files/${record.id}`)).status);
    expectDenied((await acme.get(`/api/files/${record.id}`)).status);
  });

  it('client visibility is controlled by the agency', async () => {
    const upload = await brightwave
      .post(`/api/projects/${websiteId}/files`)
      .set(CSRF)
      .attach('file', PDF_BYTES, { filename: 'Visibility Test.pdf', contentType: 'application/pdf' });
    const fileId = upload.body.data.id;
    expect(upload.body.data.clientVisible).toBe(false);
    expectDenied((await acme.get(`/api/files/${fileId}`)).status);

    await brightwave.patch(`/api/files/${fileId}`).set(CSRF).send({ clientVisible: true }).expect(200);
    expect((await acme.get(`/api/files/${fileId}`)).status).toBe(200);

    await brightwave.patch(`/api/files/${fileId}`).set(CSRF).send({ clientVisible: false }).expect(200);
    expectDenied((await acme.get(`/api/files/${fileId}`)).status);
  });

  it('rejects disallowed extensions', async () => {
    const res = await brightwave
      .post(`/api/projects/${websiteId}/files`)
      .set(CSRF)
      .attach('file', Buffer.from('MZ fake exe'), { filename: 'malware.exe', contentType: 'application/pdf' });
    expect(res.status).toBe(422);
  });

  it('rejects files whose content does not match the extension (spoofed MIME type)', async () => {
    const res = await brightwave
      .post(`/api/projects/${websiteId}/files`)
      .set(CSRF)
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'image.png', contentType: 'image/png' });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].message).toContain('does not match');
  });

  it('neutralises path traversal in filenames', async () => {
    const res = await brightwave
      .post(`/api/projects/${websiteId}/files`)
      .set(CSRF)
      .attach('file', Buffer.from('plain text'), { filename: '../../../etc/passwd.txt', contentType: 'text/plain' });
    expect(res.status).toBe(201);
    expect(res.body.data.originalName).toBe('passwd.txt');
  });

  it('enforces the maximum file size', async () => {
    const oversized = Buffer.concat([PDF_BYTES, Buffer.alloc(env.maxUploadBytes + 1)]);
    const res = await brightwave
      .post(`/api/projects/${websiteId}/files`)
      .set(CSRF)
      .attach('file', oversized, { filename: 'huge.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(413);
  });

  it('cannot upload into another agency project', async () => {
    const res = await northstar
      .post(`/api/projects/${websiteId}/files`)
      .set(CSRF)
      .attach('file', PDF_BYTES, { filename: 'intrusion.pdf', contentType: 'application/pdf' });
    expectDenied(res.status);
  });

  it('clients can upload to their own projects only, and uploads are shared with them', async () => {
    const own = await acme
      .post(`/api/portal/projects/${websiteId}/files`)
      .set(CSRF)
      .attach('file', Buffer.from('brand assets list'), { filename: 'assets.txt', contentType: 'text/plain' });
    expect(own.status).toBe(201);
    expect((await acme.get(`/api/files/${own.body.data.id}`)).status).toBe(200);

    const umbrellaProject = await projectByName('Patient Portal UX Audit');
    const other = await acme
      .post(`/api/portal/projects/${umbrellaProject.id}/files`)
      .set(CSRF)
      .attach('file', Buffer.from('nope'), { filename: 'nope.txt', contentType: 'text/plain' });
    expectDenied(other.status);
  });

  it('members may only delete their own uploads; admins may delete any', async () => {
    const member = await loginAs(USERS.brightwaveMember);
    const upload = await brightwave
      .post(`/api/projects/${websiteId}/files`)
      .set(CSRF)
      .attach('file', PDF_BYTES, { filename: 'Admin Upload.pdf', contentType: 'application/pdf' });
    expect((await member.delete(`/api/files/${upload.body.data.id}`).set(CSRF)).status).toBe(403);
    expect((await brightwave.delete(`/api/files/${upload.body.data.id}`).set(CSRF)).status).toBe(200);
    expect(await prisma.projectFile.count({ where: { id: upload.body.data.id } })).toBe(0);
  });
});
