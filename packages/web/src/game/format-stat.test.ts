import { describe, expect, it } from 'vitest';
import { pl } from '../i18n/pl';
import { formatAverage, formatBestLeg, formatDoubles, formatNumber } from './format-stat';

describe('formatAverage', () => {
  it('renders two decimals with a dot', () => {
    expect(formatAverage(150.5)).toBe('150.50');
    expect(formatAverage(68.33)).toBe('68.33');
    expect(formatAverage(0)).toBe('0.00');
  });

  it('renders null as a dash', () => {
    expect(formatAverage(null)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('renders a number or a dash', () => {
    expect(formatNumber(121)).toBe('121');
    expect(formatNumber(null)).toBe('—');
  });
});

describe('formatDoubles', () => {
  it('renders the percent with hits and attempts', () => {
    expect(formatDoubles({ doublesPercent: 33.3, doublesHit: 1, doubleAttempts: 3 })).toBe('33.3% (1/3)');
    expect(formatDoubles({ doublesPercent: 100, doublesHit: 1, doubleAttempts: 1 })).toBe('100.0% (1/1)');
  });

  it('renders a dash without attempts', () => {
    expect(formatDoubles({ doublesPercent: null, doublesHit: 0, doubleAttempts: 0 })).toBe('—');
  });
});

describe('formatBestLeg', () => {
  it('renders the darts with the plural form', () => {
    expect(formatBestLeg(9)).toBe('9 rzutek');
    expect(formatBestLeg(null)).toBe('—');
  });
});

describe('pl.darts', () => {
  it.each([
    [1, '1 rzutka'],
    [2, '2 rzutki'],
    [3, '3 rzutki'],
    [4, '4 rzutki'],
    [5, '5 rzutek'],
    [9, '9 rzutek'],
    [11, '11 rzutek'],
    [12, '12 rzutek'],
    [14, '14 rzutek'],
    [21, '21 rzutek'],
    [22, '22 rzutki'],
    [24, '24 rzutki'],
    [112, '112 rzutek'],
    [0, '0 rzutek'],
  ])('%i gives %s', (count, text) => {
    expect(pl.darts(count)).toBe(text);
  });
});
