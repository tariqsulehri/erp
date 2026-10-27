import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

function buildDatasourceUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '50');
      parsed.searchParams.set('pool_timeout', '10');
      parsed.searchParams.set('connect_timeout', '5');
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(url: string): PrismaClient {
  return new PrismaClient({
    datasourceUrl: url,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn', 'error'],
  });
}

// Global singleton instance to prevent connection pool leaks across reloads
export const prisma = globalThis.__prisma ?? createPrismaClient(buildDatasourceUrl(env.DATABASE_URL));

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export async function connectDatabase() {
  await prisma.$connect();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
