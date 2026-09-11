// In-memory best-effort brute-force mitigation for /api/auth/login. This app
// has no Redis/KV store, so this is a single-instance, per-warm-lambda limit —
// it resets on cold start and isn't shared across concurrent instances. Good
// enough to slow down a naive brute force against this small trusted group's
// login; not a substitute for a real distributed rate limiter.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60_000;

const attempts = new Map<string, { count: number; resetAt: number }>();

export function isLoginRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
