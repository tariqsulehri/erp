import { createServer } from 'node:http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './db/prisma.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = createApp();
const server = createServer(app);

async function bootstrap() {
  await connectDatabase();

  server.listen(env.PORT, () => {
    logger.info('ERP backend listening', { port: env.PORT, nodeEnv: env.NODE_ENV });
  });
}

let shuttingDown = false;
async function shutdown(signal: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down backend', { signal });

  // Keep-alive connections can hold close() open; stop waiting after the timeout.
  const forceExit = setTimeout(() => {
    logger.warn('Shutdown timed out, exiting', { timeoutMs: SHUTDOWN_TIMEOUT_MS });
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(async () => {
    await disconnectDatabase();
    process.exit(exitCode);
  });
  server.closeIdleConnections?.();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', reason => {
  logger.error('Unhandled promise rejection', { error: reason });
});
process.on('uncaughtException', error => {
  logger.error('Uncaught exception', { error });
  void shutdown('uncaughtException', 1);
});

bootstrap().catch(async (error) => {
  logger.error('Failed to start backend', { error });
  await disconnectDatabase();
  process.exit(1);
});
