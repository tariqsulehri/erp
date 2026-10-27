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
  // eslint-disable-next-line no-var
  var __prismaRo: PrismaClient | undefined;
}

const primaryDatasourceUrl = buildDatasourceUrl(env.DATABASE_URL);
const readOnlyDatasourceUrl = buildDatasourceUrl(process.env.DATABASE_RO_URL || env.DATABASE_URL);

function createPrismaClient(url: string): PrismaClient {
  return new PrismaClient({
    datasourceUrl: url,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn', 'error'],
  });
}

// Global singleton instances to prevent connection pool leaks across reloads
export const prisma = globalThis.__prisma ?? createPrismaClient(primaryDatasourceUrl);
export const prismaRo = globalThis.__prismaRo ?? createPrismaClient(readOnlyDatasourceUrl);

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
  globalThis.__prismaRo = prismaRo;
}

export async function connectDatabase() {
  await prisma.$connect();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  if (globalThis.__prismaRo) {
    await prismaRo.$disconnect();
  }
}
