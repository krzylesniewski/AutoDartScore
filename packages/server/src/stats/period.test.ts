import { describe, expect, it } from 'vitest';
import { periodStart } from './period.js';

const NOW = Date.UTC(2026, 10, 15, 12, 30, 45, 678);

describe('periodStart', () => {
  it('has no bound for all', () => {
    expect(periodStart('all', NOW)).toBeNull();
  });

  it('goes back exactly 30 days for 30d', () => {
    expect(periodStart('30d', NOW)).toBe('2026-10-16T12:30:45.678Z');
    expect(Date.parse(periodStart('30d', NOW) ?? '')).toBe(NOW - 30 * 86_400_000);
  });

  it('goes back exactly 7 rolling days for 7d', () => {
    expect(periodStart('7d', NOW)).toBe('2026-11-08T12:30:45.678Z');
    expect(Date.parse(periodStart('7d', NOW) ?? '')).toBe(NOW - 7 * 86_400_000);
  });
});
