import { describe, expect, it } from 'vitest';
import { PUBLIC_REQUESTS_PER_MINUTE, createPublicRateLimiter } from './rate-limiter.js';

const client = '10.0.0.1';

function limiterWithClock() {
  const clock = { now: 1_000_000 };
  return { clock, limiter: createPublicRateLimiter(() => clock.now) };
}

function takeMany(limiter: ReturnType<typeof createPublicRateLimiter>, count: number, from = client): void {
  for (let i = 0; i < count; i++) {
    expect(limiter.take(from)).toBeNull();
  }
}

describe('createPublicRateLimiter', () => {
  it('lets the limit through and refuses the next request until the window ends', () => {
    const { clock, limiter } = limiterWithClock();
    takeMany(limiter, PUBLIC_REQUESTS_PER_MINUTE);
    expect(limiter.take(client)).toBe(60_000);
    clock.now += 59_999;
    expect(limiter.take(client)).toBe(1);
    clock.now += 1;
    expect(limiter.take(client)).toBeNull();
  });

  it('starts the window at the first request of the client', () => {
    const { clock, limiter } = limiterWithClock();
    expect(limiter.take(client)).toBeNull();
    clock.now += 20_000;
    takeMany(limiter, PUBLIC_REQUESTS_PER_MINUTE - 1);
    expect(limiter.take(client)).toBe(40_000);
  });

  it('limits each client on its own', () => {
    const { limiter } = limiterWithClock();
    takeMany(limiter, PUBLIC_REQUESTS_PER_MINUTE);
    expect(limiter.take(client)).not.toBeNull();
    expect(limiter.take('10.0.0.2')).toBeNull();
  });

  it('drops clients whose window has passed', () => {
    const { clock, limiter } = limiterWithClock();
    limiter.take('10.0.0.1');
    clock.now += 30_000;
    limiter.take('10.0.0.2');
    expect(limiter.clientCount()).toBe(2);
    clock.now += 30_000;
    limiter.take('10.0.0.3');
    expect(limiter.clientCount()).toBe(2);
    clock.now += 60_000;
    limiter.take('10.0.0.3');
    expect(limiter.clientCount()).toBe(1);
  });
});
