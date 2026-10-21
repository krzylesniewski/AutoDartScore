import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { buildFrequentHits } from './frequent-hits.js';

const S = (segment: Hit['segment']): Hit => ({ segment, multiplier: 1 });
const D = (segment: Hit['segment']): Hit => ({ segment, multiplier: 2 });
const T = (segment: Hit['segment']): Hit => ({ segment, multiplier: 3 });
const MISS: Hit = { segment: 0, multiplier: 0 };

describe('buildFrequentHits', () => {
  it('gives no hits without darts', () => {
    expect(buildFrequentHits([])).toEqual([]);
  });

  it('orders the hits by count, most frequent first', () => {
    expect(buildFrequentHits([S(5), S(1), S(20), S(1), S(20), S(20)])).toEqual([
      { segment: 20, multiplier: 1, count: 3 },
      { segment: 1, multiplier: 1, count: 2 },
      { segment: 5, multiplier: 1, count: 1 },
    ]);
  });

  it('puts the hit worth more points first at an equal count', () => {
    expect(buildFrequentHits([T(1), S(20), T(1), S(20)])).toEqual([
      { segment: 20, multiplier: 1, count: 2 },
      { segment: 1, multiplier: 3, count: 2 },
    ]);
  });

  it('puts the lower segment first at equal count and points', () => {
    expect(buildFrequentHits([S(6), D(3), T(2)])).toEqual([
      { segment: 2, multiplier: 3, count: 1 },
      { segment: 3, multiplier: 2, count: 1 },
      { segment: 6, multiplier: 1, count: 1 },
    ]);
  });

  it('drops Miss', () => {
    expect(buildFrequentHits([MISS, MISS, S(20), MISS])).toEqual([{ segment: 20, multiplier: 1, count: 1 }]);
    expect(buildFrequentHits([MISS])).toEqual([]);
  });

  it('keeps the 6 most frequent hits', () => {
    const darts = [S(1), S(2), S(3), S(4), S(5), S(6), S(7), S(7), D(25), S(25)];
    expect(buildFrequentHits(darts)).toEqual([
      { segment: 7, multiplier: 1, count: 2 },
      { segment: 25, multiplier: 2, count: 1 },
      { segment: 25, multiplier: 1, count: 1 },
      { segment: 6, multiplier: 1, count: 1 },
      { segment: 5, multiplier: 1, count: 1 },
      { segment: 4, multiplier: 1, count: 1 },
    ]);
  });
});
