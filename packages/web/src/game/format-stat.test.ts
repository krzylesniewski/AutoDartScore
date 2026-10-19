import { describe, expect, it } from 'vitest';
import { pl } from '../i18n/pl';
import { formatAverage, formatBestLeg, formatDecimal, formatDoubles, formatDoublesParts, formatNumber } from './format-stat';

describe('formatDecimal', () => {
  it('renders a decimal comma with the given digits', () => {
    expect(formatDecimal(122.46, 1)).toBe('122,5');
    expect(formatDecimal(7, 1)).toBe('7,0');
    expect(formatDecimal(18.375, 2)).toBe('18,38');
    expect(formatDecimal(7, 2)).toBe('7,00');
  });

  it('renders large numbers without grouping', () => {
    expect(formatDecimal(12345.6, 1)).toBe('12345,6');
    expect(formatDecimal(12345.6, 2)).toBe('12345,60');
  });
});

describe('formatAverage', () => {
  it('renders two decimals with a comma', () => {
    expect(formatAverage(150.5)).toBe('150,50');
    expect(formatAverage(68.33)).toBe('68,33');
    expect(formatAverage(0)).toBe('0,00');
  });

  it('renders large averages without a grouping space', () => {
    expect(formatAverage(1234.5)).toBe('1234,50');
    expect(formatAverage(12345.6)).toBe('12345,60');
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
    expect(formatDoubles({ doublesPercent: 33.3, doublesHit: 1, doubleAttempts: 3 })).toBe('33,3% (1/3)');
    expect(formatDoubles({ doublesPercent: 100, doublesHit: 1, doubleAttempts: 1 })).toBe('100,0% (1/1)');
    expect(formatDoubles({ doublesPercent: 100 / 110, doublesHit: 1, doubleAttempts: 110 })).toBe('0,9% (1/110)');
  });

  it('renders a dash without attempts', () => {
    expect(formatDoubles({ doublesPercent: null, doublesHit: 0, doubleAttempts: 0 })).toBe('—');
  });
});

describe('formatDoublesParts', () => {
  it('splits the percent from hits and attempts', () => {
    expect(formatDoublesParts({ doublesPercent: 66.7, doublesHit: 2, doubleAttempts: 3 })).toEqual({ value: '66,7%', detail: '(2/3)' });
  });

  it('renders a dash and no detail without attempts', () => {
    expect(formatDoublesParts({ doublesPercent: null, doublesHit: 0, doubleAttempts: 0 })).toEqual({ value: '—', detail: null });
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
