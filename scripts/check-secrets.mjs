#!/usr/bin/env node
// Refuses keys, passwords, tokens, and secret files in git — in ANY file, including commented-out lines.
//
//   node scripts/check-secrets.mjs --staged   lines being committed (the pre-commit hook runs this)
//   node scripts/check-secrets.mjs --all      every file git tracks (CI runs this)
//
//   node scripts/check-secrets.mjs --all also covers new files that git does not ignore.
//
// Exit code 1 lists each finding as file:line with the value masked. Secrets belong in .env files on the
// server (git-ignored) or in CI secrets. A test-only value that is not a real secret can be allowed by adding
// it, exactly, to .secrets-allowlist (one per line); every addition is reviewed like code.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

// ── Files that must never be committed, whatever they contain ──
const SAFE_ENV_SUFFIX = /\.(example|sample|template)$/i;
export const FORBIDDEN_FILES = [
  { name: '.env file', test: path => /(^|\/)\.env(\.[^/]*)?$/i.test(path) && !SAFE_ENV_SUFFIX.test(path) },
  { name: 'private key file', test: path => /\.(pem|key|p12|pfx|jks|keystore|ppk)$/i.test(path) || /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/.test(path) },
  { name: 'database dump', test: path => /\.(dump|sql\.gz|bak)$/i.test(path) },
  { name: 'credentials file', test: path => /(^|\/)(credentials|\.npmrc|\.pypirc|\.netrc|service-account[^/]*\.json)$/i.test(path) },
];

// ── Secret values inside any line ──
export const CONTENT_RULES = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/ },
  { name: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { name: 'OpenAI or Anthropic key', pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Stripe live key', pattern: /\b(?:sk|rk)_live_[0-9A-Za-z]{16,}\b/ },
  { name: 'JSON Web Token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  // scheme://user:password@host — the password part is checked for placeholders below.
  { name: 'password in a connection string', pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@'"`]+:([^\s@'"`]+)@/i, valueGroup: 1 },
  // KEY=value in env or shell style, also when commented out:  # JWT_SECRET=<the value>
  { name: 'secret setting', pattern: /^\s*(?:#|\/\/|;|--)?\s*(?:export\s+)?[A-Z0-9_]*(?:SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|APIKEY|PRIVATE_KEY|ACCESS_KEY|CLIENT_SECRET)[A-Z0-9_]*\s*[=:]\s*['"]?([^'"\s#]+)/, valueGroup: 1 },
  // A quoted literal given to a secret-sounding name in code, config, or docs:  password: '<the value>'
  // Backticks are left out on purpose: in Markdown they mark code, not values.
  { name: 'secret value', pattern: /\b[\w-]*(?:secret|password|passwd|token|api[_-]?key|apikey|private[_-]?key|access[_-]?key)[\w-]*['"]?\s*[:=]\s*['"]([^'"\s]{6,})['"]/i, valueGroup: 1 },
];

// Values that are clearly not real secrets.
const PLACEHOLDER = /^(?:\$\{?[\w.:-]*\}?|<[^>]*>?|\[[^\]]*\]|%\w+%|\{\{.*\}\}|.*(?:change[_-]?me|your[_-]|example|placeholder|dummy|redacted|not[_-]?for[_-]?servers|do[_-]?not[_-]?use|xxx|\*\*\*|•••).*|(.)\1+|password|secret|token|null|undefined|true|false|none|required)$/i;

function isPlaceholder(value) {
  const clean = value.replace(/[),;]+$/, '');
  return clean.length < 6
    || PLACEHOLDER.test(clean)
    // Read from somewhere else at runtime: ${VAR}, $VAR, process.env.X, secrets.X
    || /\$\{|^\$[A-Z_]/.test(clean)
    || /^(?:process\.env|env\.|import\.meta\.env|os\.environ|secrets\.)/.test(clean)
    // Code, not a value: z.string().min(16), config.jwtSecret, randomBytes(32)
    || /\(/.test(clean)
    || /^[A-Za-z_$][\w$]*(?:\.[\w$]+)+$/.test(clean)
    // Package version ranges (e.g. "jsonwebtoken": "^9.0.2")
    || /^[~^<>=]*\d+\.\d+/.test(clean);
}

function loadAllowlist() {
  const file = join(ROOT, '.secrets-allowlist');
  if (!existsSync(file)) return new Set();
  return new Set(readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')));
}

export function mask(value) {
  return value.length <= 6 ? '******' : `${value.slice(0, 3)}…${'*'.repeat(6)}`;
}

/** Findings for one line of text. */
export function scanLine(line, allowlist = new Set()) {
  const findings = [];
  for (const rule of CONTENT_RULES) {
    const match = rule.pattern.exec(line);
    if (!match) continue;
    const value = rule.valueGroup ? match[rule.valueGroup] : match[0];
    if (rule.valueGroup && isPlaceholder(value)) continue;
    if ([...allowlist].some(allowed => line.includes(allowed))) continue;
    findings.push({ rule: rule.name, value: mask(value) });
  }
  return findings;
}

export function forbiddenFile(path) {
  return FORBIDDEN_FILES.find(rule => rule.test(path))?.name;
}

// Generated or vendored content that is not ours to scan.
const SKIP_PATHS = /(^|\/)(node_modules|\.next|dist|coverage|package-lock\.json)(\/|$)|\.(png|jpe?g|gif|ico|webp|woff2?|ttf|eot|pdf|zip|gz|docx?|xlsx?|drawio)$/i;

function stagedChanges() {
  const files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const diff = execFileSync('git', ['diff', '--cached', '-U0', '--no-color', '--diff-filter=ACMR'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const lines = [];
  let file = '';
  let lineNumber = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ b/')) { file = raw.slice(6); continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) { lineNumber = Number(hunk[1]); continue; }
    if (raw.startsWith('+') && !raw.startsWith('+++')) { lines.push({ file, line: lineNumber, text: raw.slice(1) }); lineNumber += 1; }
  }
  return { files, lines };
}

function trackedFiles() {
  // Tracked files plus new files that are not git-ignored (they are one `git add` away from a commit).
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
  const lines = [];
  for (const file of files) {
    if (SKIP_PATHS.test(file) || !existsSync(join(ROOT, file))) continue;
    const buffer = readFileSync(join(ROOT, file));
    if (buffer.includes(0)) continue; // binary
    buffer.toString('utf8').split('\n').forEach((text, index) => lines.push({ file, line: index + 1, text }));
  }
  return { files, lines };
}

function main() {
  const mode = process.argv.includes('--all') ? 'all' : 'staged';
  const allowlist = loadAllowlist();
  const { files, lines } = mode === 'all' ? trackedFiles() : stagedChanges();
  const problems = [];
  for (const file of files) {
    const kind = forbiddenFile(file);
    if (kind) problems.push(`${file}  ${kind}: never commit this file (keep it on the server or in CI secrets)`);
  }
  for (const { file, line, text } of lines) {
    if (SKIP_PATHS.test(file) || basename(file) === '.secrets-allowlist') continue;
    for (const finding of scanLine(text, allowlist)) problems.push(`${file}:${line}  ${finding.rule}: ${finding.value}`);
  }
  if (problems.length) {
    console.error(`✗ Secret check failed (${problems.length}). Keys and passwords must not be committed, not even in comments:`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('\nMove the value to a git-ignored .env file or a CI secret, and use a placeholder (e.g. CHANGE_ME) in examples.');
    console.error('If a key was ever committed, treat it as leaked: rotate it, even after removing it.');
    process.exit(1);
  }
  console.log(`✓ Secret check passed (${mode === 'all' ? `${files.length} files` : `${lines.length} staged lines`}).`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
