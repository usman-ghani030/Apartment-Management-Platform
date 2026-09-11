import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryRateLimiter } from './rate-limit';

describe('InMemoryRateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to `max` requests within the window', () => {
    const limiter = new InMemoryRateLimiter(60_000, 3);

    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(false);
  });

  it('denies beyond the max with a positive retryAfterSeconds', () => {
    vi.useFakeTimers();
    const limiter = new InMemoryRateLimiter(60_000, 2);

    limiter.check('k');
    limiter.check('k');
    const blocked = limiter.check('k');

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks keys independently', () => {
    const limiter = new InMemoryRateLimiter(60_000, 2);

    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(true); // b only has 1 hit so far
    expect(limiter.check('b').allowed).toBe(false);
  });

  it('resets the window when time advances past it', () => {
    vi.useFakeTimers();
    const limiter = new InMemoryRateLimiter(60_000, 2);

    limiter.check('k');
    limiter.check('k');
    expect(limiter.check('k').allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(limiter.check('k').allowed).toBe(true);
  });

  it('reset() clears all recorded hits', () => {
    const limiter = new InMemoryRateLimiter(60_000, 1);

    limiter.check('k');
    expect(limiter.check('k').allowed).toBe(false);

    limiter.reset();
    expect(limiter.check('k').allowed).toBe(true);
  });
});