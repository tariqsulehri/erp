import { createServer } from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './db/prisma.js';

const app = createApp();
const server = createServer(app);

async function bootstrap() {
  await connectDatabase();

  server.listen(env.PORT, () => {
    console.log(`ERP backend listening on http://localhost:${env.PORT}`);
  });
}

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down backend`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

bootstrap().catch(async (error) => {
  console.error('Failed to start backend', error);
  await disconnectDatabase();
  process.exit(1);
});
