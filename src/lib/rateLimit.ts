/**
 * In-process sliding-window rate limiter, keyed by cookie ID.
 *
 * Adequate for a single Node instance with ~5-10 trusted operators. If we ever
 * scale to multiple instances, swap this for Redis/Upstash without changing
 * call sites.
 *
 * Configurable via env vars:
 *   RATE_LIMIT_AUDITS_PER_HOUR  — default 30
 */

const buckets = new Map<string, number[]>();

function getLimit(): number {
  const raw = process.env.RATE_LIMIT_AUDITS_PER_HOUR;
  const n = raw ? parseInt(raw, 10) : 30;
  return Number.isFinite(n) && n > 0 ? n : 30;
}

const WINDOW_MS = 60 * 60 * 1000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkAuditRate(key: string): RateLimitResult {
  const limit = getLimit();
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const stamps = (buckets.get(key) ?? []).filter(t => t > cutoff);
  if (stamps.length >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((stamps[0] + WINDOW_MS - now) / 1000)
    );
    buckets.set(key, stamps);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  stamps.push(now);
  buckets.set(key, stamps);
  return { ok: true, remaining: limit - stamps.length, retryAfterSeconds: 0 };
}

/**
 * For tests only. Drops all rate-limit state.
 */
export function _resetRateLimits(): void {
  buckets.clear();
}
