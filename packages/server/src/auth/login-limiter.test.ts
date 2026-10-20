import { describe, expect, it } from 'vitest';
import { createLoginLimiter } from './login-limiter.js';

function limiterWithClock() {
  const clock = { now: 1_000_000 };
  return { clock, limiter: createLoginLimiter(() => clock.now) };
}

describe('createLoginLimiter', () => {
  it('allows attempts until the tenth failure', () => {
    const { limiter } = limiterWithClock();
    for (let i = 0; i < 9; i++) {
      limiter.recordFailure();
      expect(limiter.retryAfterMs()).toBeNull();
    }
    limiter.recordFailure();
    expect(limiter.retryAfterMs()).toBe(60_000);
  });

  it('waits until the oldest failure leaves the window', () => {
    const { clock, limiter } = limiterWithClock();
    limiter.recordFailure();
    clock.now += 10_000;
    for (let i = 0; i < 9; i++) {
      limiter.recordFailure();
    }
    clock.now += 5_000;
    expect(limiter.retryAfterMs()).toBe(45_000);

    clock.now += 44_999;
    expect(limiter.retryAfterMs()).toBe(1);
    clock.now += 1;
    expect(limiter.retryAfterMs()).toBeNull();
  });

  it('forgets failures older than a minute', () => {
    const { clock, limiter } = limiterWithClock();
    for (let i = 0; i < 9; i++) {
      limiter.recordFailure();
    }
    clock.now += 60_000;
    limiter.recordFailure();
    expect(limiter.retryAfterMs()).toBeNull();
    for (let i = 0; i < 8; i++) {
      limiter.recordFailure();
    }
    expect(limiter.retryAfterMs()).toBeNull();
    limiter.recordFailure();
    expect(limiter.retryAfterMs()).toBe(60_000);
  });
});
