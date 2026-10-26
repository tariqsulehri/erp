// Slows down password guessing. Two limits, both over a 15 minute window:
// - one email from one IP address: 10 failed attempts (so nobody can lock another user out from elsewhere);
// - one IP address across all emails: 30 failed attempts (stops trying one password on many accounts).
// Kept in memory, so it resets on restart and is per backend instance. The client IP comes from
// `x-forwarded-for` set by the frontend proxy, trusted through `app.set('trust proxy', ...)`.
const MAX_FAILED_PER_EMAIL = 10;
const MAX_FAILED_PER_IP = 30;
const BLOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10_000;

const failedAttempts = new Map<string, { count: number; firstFailedAt: number }>();

function emailKey(email: string, ip: string) {
  return `email:${email.trim().toLowerCase()}|ip:${ip}`;
}

function ipKey(ip: string) {
  return `ip:${ip}`;
}

function activeCount(key: string) {
  const entry = failedAttempts.get(key);
  if (!entry) return 0;
  if (Date.now() - entry.firstFailedAt > BLOCK_WINDOW_MS) {
    failedAttempts.delete(key);
    return 0;
  }
  return entry.count;
}

function removeExpired() {
  const now = Date.now();
  for (const [key, entry] of failedAttempts) {
    if (now - entry.firstFailedAt > BLOCK_WINDOW_MS) failedAttempts.delete(key);
  }
}

function addFailure(key: string) {
  if (failedAttempts.size >= MAX_TRACKED_KEYS) removeExpired();
  if (failedAttempts.size >= MAX_TRACKED_KEYS) {
    const oldestKey = failedAttempts.keys().next().value;
    if (oldestKey) failedAttempts.delete(oldestKey);
  }
  const entry = failedAttempts.get(key);
  if (!entry || Date.now() - entry.firstFailedAt > BLOCK_WINDOW_MS) {
    failedAttempts.set(key, { count: 1, firstFailedAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function assertLoginAllowed(email: string, ip = 'unknown') {
  if (activeCount(emailKey(email, ip)) >= MAX_FAILED_PER_EMAIL || activeCount(ipKey(ip)) >= MAX_FAILED_PER_IP) {
    const error = new Error('Too many failed sign-in attempts. Please wait 15 minutes and try again.');
    Object.assign(error, { statusCode: 429 });
    throw error;
  }
}

export function recordFailedLogin(email: string, ip = 'unknown') {
  addFailure(emailKey(email, ip));
  addFailure(ipKey(ip));
}

export function clearFailedLogins(email: string, ip = 'unknown') {
  failedAttempts.delete(emailKey(email, ip));
}
