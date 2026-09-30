import bcrypt from 'bcryptjs';
import { env } from '../config/env';

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Used when the email does not exist so that response time does not reveal
// whether an account is registered.
const DUMMY_HASH = bcrypt.hashSync('appzex-timing-equalizer', 10);

export async function verifyAgainstDummy(plain: string): Promise<false> {
  await bcrypt.compare(plain, DUMMY_HASH);
  return false;
}
