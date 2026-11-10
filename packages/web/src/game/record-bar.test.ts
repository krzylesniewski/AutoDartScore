import { describe, expect, it } from 'vitest';
import { recordBarPercent } from './record-bar';

describe('recordBarPercent', () => {
  it('compares to the highest value when higher is better', () => {
    expect(recordBarPercent(86.5, 98.33, false)).toBe(88);
    expect(recordBarPercent(60, 180, false)).toBe(33);
  });

  it('compares to the lowest value when lower is better', () => {
    expect(recordBarPercent(18, 15, true)).toBe(83);
    expect(recordBarPercent(30, 15, true)).toBe(50);
  });

  it('gives 100 for a value equal to the best', () => {
    expect(recordBarPercent(121, 121, false)).toBe(100);
    expect(recordBarPercent(15, 15, true)).toBe(100);
  });

  it('gives 0 for a zero best when higher is better', () => {
    expect(recordBarPercent(0, 0, false)).toBe(0);
    expect(recordBarPercent(10, 0, false)).toBe(0);
  });

  it('gives 0 for a zero value when lower is better', () => {
    expect(recordBarPercent(0, 15, true)).toBe(0);
  });

  it('clamps the result to 0-100', () => {
    expect(recordBarPercent(200, 100, false)).toBe(100);
    expect(recordBarPercent(10, 15, true)).toBe(100);
    expect(recordBarPercent(-5, 100, false)).toBe(0);
  });
});
