import { describe, expect, it } from 'vitest';
import { spokenNumber } from './index.js';

describe('spokenNumber', () => {
  it.each([
    [0, 'zero'],
    [11, 'jedenaście'],
    [19, 'dziewiętnaście'],
    [45, 'czterdzieści pięć'],
    [60, 'sześćdziesiąt'],
    [90, 'dziewięćdziesiąt'],
    [100, 'sto'],
    [121, 'sto dwadzieścia jeden'],
    [140, 'sto czterdzieści'],
    [180, 'sto osiemdziesiąt'],
  ])('reads %i as %s', (value, words) => {
    expect(spokenNumber(value)).toBe(words);
  });

  it('reads every turn total from 0 to 180 as words', () => {
    for (let value = 0; value <= 180; value++) {
      const words = spokenNumber(value);
      expect(words).not.toBe('');
      expect(words).not.toMatch(/\d/);
      expect(words).not.toMatch(/^ | $| {2}/);
    }
  });

  it.each([-1, 181, 2.5])('throws RangeError for %d', (value) => {
    expect(() => spokenNumber(value)).toThrow(RangeError);
  });
});
