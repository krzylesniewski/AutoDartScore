import { describe, expect, it } from 'vitest';
import { checkoutHistory, checkoutPractice, checkoutSession, player, snapshot } from '../test/snapshots';
import { canEndPractice } from './can-end-practice';

function practice(practiceMode: 'free_run' | 'solo_501', darts: number) {
  return snapshot({
    type: 'practice',
    practiceMode,
    players: [player('p1', 'Anna', { remaining: practiceMode === 'free_run' ? null : 501, dartsThrownInLeg: darts })],
  });
}

describe('canEndPractice', () => {
  it.each(['free_run', 'solo_501'] as const)('allows %s after the first dart', (mode) => {
    expect(canEndPractice(practice(mode, 1))).toBe(true);
    expect(canEndPractice(practice(mode, 7))).toBe(true);
  });

  it.each(['free_run', 'solo_501'] as const)('refuses %s with 0 darts', (mode) => {
    expect(canEndPractice(practice(mode, 0))).toBe(false);
  });

  it.each(['abandoned', 'ended', 'finished'] as const)('refuses a practice that is %s', (status) => {
    expect(canEndPractice({ ...practice('solo_501', 3), status })).toBe(false);
  });

  it('allows checkout practice after the first attempt', () => {
    expect(canEndPractice(checkoutPractice(checkoutSession(checkoutHistory([false]))))).toBe(true);
    expect(canEndPractice(checkoutPractice(checkoutSession(checkoutHistory([true, false, true]))))).toBe(true);
  });

  it('refuses checkout practice with 0 attempts', () => {
    expect(canEndPractice(checkoutPractice(checkoutSession()))).toBe(false);
  });

  it.each(['abandoned', 'ended'] as const)('refuses checkout practice that is %s', (status) => {
    expect(canEndPractice({ ...checkoutPractice(checkoutSession(checkoutHistory([true]))), status })).toBe(false);
  });

  it('refuses a 1v1', () => {
    expect(canEndPractice(snapshot({ legIndex: 1, players: [player('p1', 'Anna', { dartsThrownInLeg: 3 }), player('p2', 'Bartek', { dartsThrownInLeg: 3 })] }))).toBe(false);
  });
});
