import { describe, expect, it } from 'vitest';
import { progressWidth } from './progress-width';

describe('progressWidth', () => {
  it.each([
    [301, 301, 0],
    [300, 150, 50],
    [301, 0, 100],
  ])('gives %i/%i a width of %d%%', (startingScore, remaining, width) => {
    expect(progressWidth(startingScore, remaining)).toBe(width);
  });

  it('does not round the width', () => {
    expect(progressWidth(301, 170)).toBeCloseTo(43.52, 2);
  });

  it('clamps a remaining score above the starting score to 0', () => {
    expect(progressWidth(301, 400)).toBe(0);
  });

  it('gives null without a starting score', () => {
    expect(progressWidth(null, 170)).toBeNull();
  });

  it('gives null without a remaining score', () => {
    expect(progressWidth(301, null)).toBeNull();
  });
});
