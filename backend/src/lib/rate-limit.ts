// In-memory fixed-window rate limiter.
//
// PLAN.md §5 calls for a Redis-backed limiter on auth routes; this app runs a
// single instance today and Redis is only wired into the BullMQ queues, so an
// in-memory limiter is the pragmatic choice for the forgot-password endpoint
// (the one public endpoint that can be abused to spam an inbox). Swapping to a
// Redis-backed implementation later is a contained change: same check() API.
export class InMemoryRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number
  ) {}

  /**
   * Record an attempt for `key`. Returns whether the request is allowed and,
   * when denied, how many seconds until the window resets.
   */
  check(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      const oldest = recent[0];
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)),
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(): void {
    this.hits.clear();
  }
}

// Forgot-password abuse protection: 5 requests per email and 20 per IP, per
// 15-minute window. Both keys are always counted (existing and unknown emails
// alike) so the limit itself never reveals whether an email is registered.
export const passwordResetEmailLimiter = new InMemoryRateLimiter(15 * 60 * 1000, 5);
export const passwordResetIpLimiter = new InMemoryRateLimiter(15 * 60 * 1000, 20);