import { describe, expect, it } from 'vitest';
import { MAX_FAILURES_GLOBAL, MAX_FAILURES_PER_CLIENT, createLoginLimiter } from './login-limiter.js';

const client = '10.0.0.1';

function limiterWithClock() {
  const clock = { now: 1_000_000 };
  return { clock, limiter: createLoginLimiter(() => clock.now) };
}

describe('createLoginLimiter', () => {
  it('allows attempts until the tenth failure', () => {
    const { limiter } = limiterWithClock();
    for (let i = 0; i < 9; i++) {
      limiter.recordFailure(client);
      expect(limiter.retryAfterMs(client)).toBeNull();
    }
    limiter.recordFailure(client);
    expect(limiter.retryAfterMs(client)).toBe(60_000);
  });

  it('waits until the oldest failure leaves the window', () => {
    const { clock, limiter } = limiterWithClock();
    limiter.recordFailure(client);
    clock.now += 10_000;
    for (let i = 0; i < 9; i++) {
      limiter.recordFailure(client);
    }
    clock.now += 5_000;
    expect(limiter.retryAfterMs(client)).toBe(45_000);

    clock.now += 44_999;
    expect(limiter.retryAfterMs(client)).toBe(1);
    clock.now += 1;
    expect(limiter.retryAfterMs(client)).toBeNull();
  });

  it('forgets failures older than a minute', () => {
    const { clock, limiter } = limiterWithClock();
    for (let i = 0; i < 9; i++) {
      limiter.recordFailure(client);
    }
    clock.now += 60_000;
    limiter.recordFailure(client);
    expect(limiter.retryAfterMs(client)).toBeNull();
    for (let i = 0; i < 8; i++) {
      limiter.recordFailure(client);
    }
    expect(limiter.retryAfterMs(client)).toBeNull();
    limiter.recordFailure(client);
    expect(limiter.retryAfterMs(client)).toBe(60_000);
  });

  it('blocks only the client that reached its limit', () => {
    const { limiter } = limiterWithClock();
    for (let i = 0; i < MAX_FAILURES_PER_CLIENT; i++) {
      limiter.recordFailure(client);
    }
    expect(limiter.retryAfterMs(client)).toBe(60_000);
    expect(limiter.retryAfterMs('10.0.0.2')).toBeNull();
  });

  it('blocks a fresh client once failures spread over many clients reach the global limit', () => {
    const { clock, limiter } = limiterWithClock();
    const perClient = MAX_FAILURES_PER_CLIENT - 1;
    for (let i = 0; i < MAX_FAILURES_GLOBAL; i++) {
      if (i > 0) {
        clock.now += 100;
      }
      const sender = `10.1.0.${Math.floor(i / perClient)}`;
      expect(limiter.retryAfterMs(sender), `attempt ${i + 1}`).toBeNull();
      limiter.recordFailure(sender);
    }
    const oldestLeavesInMs = 60_000 - (MAX_FAILURES_GLOBAL - 1) * 100;
    expect(limiter.retryAfterMs('10.2.0.1')).toBe(oldestLeavesInMs);

    clock.now += oldestLeavesInMs - 1;
    expect(limiter.retryAfterMs('10.2.0.1')).toBe(1);
    clock.now += 1;
    expect(limiter.retryAfterMs('10.2.0.1')).toBeNull();
  });

  it('returns the longest wait when both limits are reached', () => {
    const { clock, limiter } = limiterWithClock();
    for (let i = 0; i < MAX_FAILURES_GLOBAL - MAX_FAILURES_PER_CLIENT; i++) {
      limiter.recordFailure(`10.1.0.${i % 50}`);
    }
    clock.now += 20_000;
    for (let i = 0; i < MAX_FAILURES_PER_CLIENT; i++) {
      limiter.recordFailure(client);
    }
    expect(limiter.retryAfterMs('10.2.0.1')).toBe(40_000);
    expect(limiter.retryAfterMs(client)).toBe(60_000);
  });
});
