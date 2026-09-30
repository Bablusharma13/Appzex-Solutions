import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

/**
 * Test configuration comes from `.env.test` (falls back to the committed
 * `.env.test.example`). TEST_DATABASE_URL, if set, overrides the database.
 * The test database is reset and re-seeded before every run.
 */
export function readTestEnv(): Record<string, string> {
  const root = path.resolve(__dirname, '..', '..');
  const file = [path.join(root, '.env.test'), path.join(root, '.env.test.example')].find((candidate) =>
    existsSync(candidate),
  );
  if (!file) throw new Error('Missing .env.test (copy .env.test.example)');

  const values = parse(readFileSync(file));
  if (process.env.TEST_DATABASE_URL) values.DATABASE_URL = process.env.TEST_DATABASE_URL;
  if (!/test/i.test(values.DATABASE_URL ?? '')) {
    throw new Error('Refusing to run tests: DATABASE_URL must point to a dedicated *test* database.');
  }
  return { ...values, NODE_ENV: 'test' };
}
