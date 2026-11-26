import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStatsPeriod, STATS_PERIOD_STORAGE_KEY, writeStatsPeriod } from './stats-period';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('readStatsPeriod', () => {
  it('gives all time without an entry', () => {
    expect(readStatsPeriod()).toBe('all');
  });

  it.each(['7d', '30d', 'all'] as const)('gives the stored %s', (period) => {
    localStorage.setItem(STATS_PERIOD_STORAGE_KEY, period);
    expect(readStatsPeriod()).toBe(period);
  });

  it.each(['90d', 'quarter', ''])('gives all time for %j', (value) => {
    localStorage.setItem(STATS_PERIOD_STORAGE_KEY, value);
    expect(readStatsPeriod()).toBe('all');
  });

  it('gives all time when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStatsPeriod()).toBe('all');
  });
});

describe('writeStatsPeriod', () => {
  it('stores the period under autoscore.statsPeriod', () => {
    writeStatsPeriod('30d');
    expect(localStorage.getItem('autoscore.statsPeriod')).toBe('30d');
    writeStatsPeriod('7d');
    expect(localStorage.getItem('autoscore.statsPeriod')).toBe('7d');
  });

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeStatsPeriod('30d')).not.toThrow();
  });
});
