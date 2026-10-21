import { describe, expect, it } from 'vitest';
import { frequentHitLabel } from './frequent-hit-label';

describe('frequentHitLabel', () => {
  it.each([
    [20, 1, 'S20'],
    [1, 1, 'S1'],
    [16, 2, 'D16'],
    [20, 3, 'T20'],
    [25, 1, '25'],
    [25, 2, 'Bull'],
  ] as const)('labels %i×%i as %s', (segment, multiplier, expected) => {
    expect(frequentHitLabel({ segment, multiplier })).toBe(expected);
  });
});
