import { mkdir } from 'node:fs/promises';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

async function main() {
  await mkdir(env.uploadDir, { recursive: true });
  await prisma.$connect();

  const server = createApp().listen(env.PORT, () => {
    console.info(`AppZex API listening on port ${env.PORT} (${env.NODE_ENV})`);
    if (!env.aiEnabled) console.info('AI features disabled: OPENAI_API_KEY is not set.');
  });

  const shutdown = (signal: string) => {
    console.info(`${signal} received, shutting down`);
    server.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
