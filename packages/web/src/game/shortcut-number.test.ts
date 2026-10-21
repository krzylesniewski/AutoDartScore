import { describe, expect, it } from 'vitest';
import { DIGIT_WAIT_MS, typeDigit, type PendingDigit } from './shortcut-number';

function typeAll(digits: readonly number[]): { numbers: number[]; pending: PendingDigit } {
  let pending: PendingDigit = null;
  const numbers: number[] = [];
  for (const digit of digits) {
    const typed = typeDigit(pending, digit);
    numbers.push(...typed.numbers);
    pending = typed.pending;
  }
  return { numbers, pending };
}

describe('typeDigit', () => {
  it('waits one second for a second digit', () => {
    expect(DIGIT_WAIT_MS).toBe(1000);
  });

  it('ignores 0 with nothing pending', () => {
    expect(typeDigit(null, 0)).toEqual({ numbers: [], pending: null });
  });

  it.each([1, 2] as const)('keeps %i pending', (digit) => {
    expect(typeDigit(null, digit)).toEqual({ numbers: [], pending: digit });
  });

  it.each([3, 4, 5, 6, 7, 8, 9])('enters %i at once', (digit) => {
    expect(typeDigit(null, digit)).toEqual({ numbers: [digit], pending: null });
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])('turns a pending 1 and %i into 1%i', (digit) => {
    expect(typeDigit(1, digit)).toEqual({ numbers: [10 + digit], pending: null });
  });

  it('turns a pending 2 and 0 into 20', () => {
    expect(typeDigit(2, 0)).toEqual({ numbers: [20], pending: null });
  });

  it.each([3, 4, 5, 6, 7, 8, 9])('enters 2 and then %i after a pending 2', (digit) => {
    expect(typeDigit(2, digit)).toEqual({ numbers: [2, digit], pending: null });
  });

  it.each([1, 2] as const)('enters 2 and keeps %i pending after a pending 2', (digit) => {
    expect(typeDigit(2, digit)).toEqual({ numbers: [2], pending: digit });
  });

  it.each([
    [[1, 0], [10], null],
    [[2, 0], [20], null],
    [[3], [3], null],
    [[2, 5], [2, 5], null],
    [[2, 1], [2], 1],
    [[0, 0, 7], [7], null],
    [[1, 6, 2, 0], [16, 20], null],
  ] as const)('types %j as %j', (digits, numbers, pending) => {
    expect(typeAll(digits)).toEqual({ numbers, pending });
  });
});
