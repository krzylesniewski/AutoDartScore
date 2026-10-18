import { describe, expect, it } from 'vitest';
import { hitLabel } from './hit-label';

describe('hitLabel', () => {
  it.each([
    [0, 0, 'Miss'],
    [25, 1, '25'],
    [25, 2, 'Bull'],
    [7, 1, '7'],
    [16, 2, 'D16'],
    [20, 3, 'T20'],
  ] as const)('labels %i×%i as %s', (segment, multiplier, expected) => {
    expect(hitLabel({ segment, multiplier })).toBe(expected);
  });
});
