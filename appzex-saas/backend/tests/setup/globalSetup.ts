import { execSync } from 'node:child_process';
import path from 'node:path';
import { readTestEnv } from './testEnv';

/**
 * Prepares the dedicated test database once per run:
 *   1. `prisma migrate deploy` applies any pending migrations (non-destructive)
 *   2. the demo seed replaces all rows with a known dataset
 * readTestEnv() refuses to run unless DATABASE_URL points at a *test* database.
 */
export default function setup() {
  const env = { ...process.env, ...readTestEnv() };
  const cwd = path.resolve(__dirname, '..', '..');
  const run = (command: string) => execSync(command, { cwd, env, stdio: 'pipe' });

  run('npx prisma migrate deploy');
  run('npx tsx prisma/seed.ts');
}
