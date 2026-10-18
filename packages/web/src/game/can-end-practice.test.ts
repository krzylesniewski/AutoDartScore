import { describe, expect, it } from 'vitest';
import { player, snapshot } from '../test/snapshots';
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

  it('refuses a 1v1', () => {
    expect(canEndPractice(snapshot({ legIndex: 1, players: [player('p1', 'Anna', { dartsThrownInLeg: 3 }), player('p2', 'Bartek', { dartsThrownInLeg: 3 })] }))).toBe(false);
  });
});
