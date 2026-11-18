/* eslint-disable no-console */
import { config } from './config/env';
import { createApp } from './app';
import { disconnectPrisma } from './lib/prisma';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`CampusPass API listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async (err) => {
    await disconnectPrisma();
    process.exit(err ? 1 : 0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
