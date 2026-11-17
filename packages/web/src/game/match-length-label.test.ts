import { describe, expect, it } from 'vitest';
import { matchLengthLabel } from './match-length-label';

describe('matchLengthLabel', () => {
  it.each([
    [1, 'Best of 1'],
    [2, 'Best of 3'],
    [3, 'Best of 5'],
  ])('shows %i legs to win as %s', (legsToWin, label) => {
    expect(matchLengthLabel(legsToWin)).toBe(label);
  });

  it.each([
    [4, 'Do 4 legów'],
    [9, 'Do 9 legów'],
  ])('shows %i legs to win outside the wizard lengths as %s', (legsToWin, label) => {
    expect(matchLengthLabel(legsToWin)).toBe(label);
  });
});
