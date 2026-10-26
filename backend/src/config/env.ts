import 'dotenv/config';
import { z } from 'zod';

const TEST_JWT_SECRET = 'test-only-jwt-secret-not-for-servers';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DEFAULT_COMPANY_ID: z.string().uuid().optional(),
  // Required everywhere except automated tests, so a server left on development mode cannot sign tokens
  // with a public value.
  JWT_SECRET: process.env.NODE_ENV === 'test'
    ? z.string().min(16).default(TEST_JWT_SECRET)
    : z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
}).refine(value => !/^(your_|change|replace|example)/i.test(value.JWT_SECRET), {
  message: 'JWT_SECRET still has a placeholder value. Set a private random value.',
  path: ['JWT_SECRET'],
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid backend environment configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
