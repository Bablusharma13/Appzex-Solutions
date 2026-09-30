import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../../config/env';

/**
 * Storage abstraction. The app only ever talks to this interface, so the local
 * disk implementation can be replaced by S3 / R2 / GCS (put/get/delete object)
 * without touching business logic or authorization code.
 */
export interface StorageProvider {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
}

// Storage keys are generated server-side (uuid + known extension). Anything
// else is rejected, which rules out path traversal like "../../etc/passwd".
const SAFE_KEY = /^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/;

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error('Invalid storage key');
    const fullPath = path.resolve(this.root, key);
    if (path.dirname(fullPath) !== path.resolve(this.root)) throw new Error('Invalid storage key');
    return fullPath;
  }

  async save(key: string, data: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.resolve(key), data, { flag: 'wx' });
  }

  async read(key: string): Promise<Readable> {
    const fullPath = this.resolve(key);
    await stat(fullPath); // throws ENOENT before headers are sent
    return createReadStream(fullPath);
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

export const storage: StorageProvider = new LocalStorageProvider(env.uploadDir);
