import { PrismaClient } from '@prisma/client';
import { env } from './env';

// One client per process. In dev, `tsx watch` restarts the whole process so a
// global cache is not needed.
export const prisma = new PrismaClient({
  log: env.isProduction ? ['error'] : ['warn', 'error'],
});

export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
