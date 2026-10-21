import { describe, expect, it } from 'vitest';
import { DARTBOARD_ORDER } from './dartboard-order';

describe('DARTBOARD_ORDER', () => {
  it('follows the dartboard clockwise from 20', () => {
    expect(DARTBOARD_ORDER).toEqual([20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]);
  });

  it('holds each of 1-20 once', () => {
    expect([...DARTBOARD_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });
});
