import { describe, expect, it } from 'vitest';
import { checkoutHistory, checkoutSession } from '../test/snapshots';
import { checkoutControls, checkoutPercent, checkoutPracticeName, formatCheckoutPercent } from './checkout-practice';

describe('checkoutPercent', () => {
  it.each([
    [7, 12, 58],
    [1, 1, 100],
    [0, 3, 0],
  ])('gives %i of %i as %i', (successes, attempts, expected) => {
    expect(checkoutPercent({ attempts, successes })).toBe(expected);
    expect(formatCheckoutPercent({ attempts, successes })).toBe(`${expected}%`);
  });

  it('gives no percent without attempts', () => {
    expect(checkoutPercent({ attempts: 0, successes: 0 })).toBeNull();
    expect(formatCheckoutPercent({ attempts: 0, successes: 0 })).toBe('—');
  });
});

describe('checkoutPracticeName', () => {
  it('names the mode with its range', () => {
    expect(checkoutPracticeName(checkoutSession([], { range: '51-100' }))).toBe('Końcówki 51-100');
    expect(checkoutPracticeName(null)).toBe('Końcówki');
  });
});

describe('checkoutControls', () => {
  const tried = checkoutSession(checkoutHistory([true]));

  const skipped = checkoutSession([], { skips: 2 });

  it('enables the results, the skip and Cofnij in a connected session with an attempt', () => {
    expect(checkoutControls({ status: 'in_progress', checkouts: tried }, true)).toEqual({ results: true, skip: true, undo: true });
  });

  it('disables Cofnij with 0 attempts and 0 skips', () => {
    expect(checkoutControls({ status: 'in_progress', checkouts: checkoutSession() }, true)).toEqual({ results: true, skip: true, undo: false });
  });

  it('enables Cofnij with only skips', () => {
    expect(checkoutControls({ status: 'in_progress', checkouts: skipped }, true)).toEqual({ results: true, skip: true, undo: true });
    expect(checkoutControls({ status: 'in_progress', checkouts: skipped }, false)).toEqual({ results: false, skip: false, undo: true });
  });

  it('disables the results and the skip without a connection', () => {
    expect(checkoutControls({ status: 'in_progress', checkouts: tried }, false)).toEqual({ results: false, skip: false, undo: true });
  });

  it.each(['ended', 'abandoned'] as const)('disables everything in a session that is %s', (status) => {
    expect(checkoutControls({ status, checkouts: tried }, true)).toEqual({ results: false, skip: false, undo: false });
    expect(checkoutControls({ status, checkouts: skipped }, true)).toEqual({ results: false, skip: false, undo: false });
  });
});
