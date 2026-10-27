// Tests for scripts/check-secrets.mjs. Run: node --test scripts/
// Fake keys are assembled at run time so this file never contains a key itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forbiddenFile, mask, scanLine } from './check-secrets.mjs';

const repeat = (text, times) => text.repeat(times);
const found = line => scanLine(line).map(finding => finding.rule);

test('finds provider keys and tokens anywhere in a line', () => {
  assert.deepEqual(found(`const key = '${'AKIA'}${repeat('Q', 16)}';`), ['AWS access key']);
  assert.ok(found(`token: ${'gh'}p_${repeat('a1B2', 9)}`).includes('GitHub token'));
  assert.ok(found(`OPENAI=${'s'}k-proj-${repeat('x9Y8', 8)}`).includes('OpenAI or Anthropic key'));
  assert.ok(found(`${'xo'}xb-${repeat('12345-', 4)}`).includes('Slack token'));
  assert.ok(found(`${'AI'}za${repeat('S', 35)}`).includes('Google API key'));
  assert.ok(found(`stripe ${'s'}k_live_${repeat('a', 24)}`).includes('Stripe live key'));
  assert.ok(found(`Authorization: Bearer ${'ey'}J${repeat('a', 12)}.${'ey'}J${repeat('b', 12)}.${repeat('c', 12)}`).includes('JSON Web Token'));
  assert.ok(found(`${'-----BEGIN'} RSA PRIVATE KEY-----`).includes('private key'));
});

test('finds secrets in commented-out lines too', () => {
  assert.ok(found(`# JWT_SECRET=${'k'}9f2h4j6l8n0p2r4t6v8x`).includes('secret setting'));
  assert.ok(found(`// DB_PASSWORD: ${'S'}uperS3cretValue`).includes('secret setting'));
  assert.ok(found(`-- export API_KEY='${'a'}bc123def456'`).includes('secret setting'));
  assert.ok(found(`/* password: '${'H'}unter2Hunter2' */`).includes('secret value'));
});

test('finds a password inside a connection string', () => {
  assert.ok(found(`DATABASE_URL=postgresql://app:${'R'}ealPass123@db:5432/erp`).includes('password in a connection string'));
  assert.ok(found(`mongodb+srv://admin:${'p'}4ssW0rd!x@cluster0.example.net`).includes('password in a connection string'));
});

test('ignores placeholders, variables, and code', () => {
  for (const line of [
    'DATABASE_URL=postgresql://erp_app:CHANGE_ME@db-host:5432/erp',
    'JWT_SECRET=',
    'JWT_SECRET=<generate with openssl rand -hex 32>',
    'POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}',
    'DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/erp',
    "const secret = process.env.JWT_SECRET;",
    'JWT_SECRET: z.string().min(32),',
    '"@types/jsonwebtoken": "^9.0.10",',
    'password: input.password,',
    'NEXTAUTH_SECRET=your-secret-here',
    "password: '********',",
    'Use the `--z-modal` token for dialogs.',
  ]) {
    assert.deepEqual(found(line), [], line);
  }
});

test('an allowlisted test value is skipped, everything else on other lines is not', () => {
  const fixture = ['Throwaway', 'Test', 'Pass', '1'].join('-');
  const allow = new Set([fixture]);
  assert.deepEqual(scanLine(`const PASSWORD = '${fixture}';`, allow), []);
  assert.ok(scanLine(`const PASSWORD = '${'R'}eal-Prod-Pass-9';`, allow).length > 0);
});

test('blocks secret files, allows example files', () => {
  assert.equal(forbiddenFile('backend/.env'), '.env file');
  assert.equal(forbiddenFile('frontend/.env.local'), '.env file');
  assert.equal(forbiddenFile('deployment/.env.backend'), '.env file');
  assert.equal(forbiddenFile('deployment/.env.backend.example'), undefined);
  assert.equal(forbiddenFile('certs/server.pem'), 'private key file');
  assert.equal(forbiddenFile('keys/id_ed25519'), 'private key file');
  assert.equal(forbiddenFile('keys/id_ed25519.pub'), undefined);
  assert.equal(forbiddenFile('backups/erp-2026.dump'), 'database dump');
  assert.equal(forbiddenFile('.npmrc'), 'credentials file');
  assert.equal(forbiddenFile('src/env.ts'), undefined);
});

test('masks values in the report', () => {
  assert.equal(mask('abc'), '******');
  assert.equal(mask('SuperSecretValue'), 'Sup…******');
});
