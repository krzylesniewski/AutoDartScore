import { describe, expect, it } from 'vitest';
import { betterSide } from './better-side';

describe('betterSide', () => {
  it('picks the higher value when higher is better', () => {
    expect(betterSide(49.73, 44.88, false)).toBe(0);
    expect(betterSide(2, 4, false)).toBe(1);
  });

  it('picks the lower value when lower is better', () => {
    expect(betterSide(21, 24, true)).toBe(0);
    expect(betterSide(24, 21, true)).toBe(1);
  });

  it('lets a number beat null on either side', () => {
    expect(betterSide(64, null, false)).toBe(0);
    expect(betterSide(null, 15, true)).toBe(1);
  });

  it('marks no side on a tie, including zeros and two nulls', () => {
    expect(betterSide(3, 3, false)).toBeNull();
    expect(betterSide(0, 0, false)).toBeNull();
    expect(betterSide(null, null, true)).toBeNull();
  });
});
