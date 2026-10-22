import { describe, expect, it } from 'vitest';
import { casual, player, snapshot } from '../test/snapshots';
import { canAbandon } from './can-abandon';

describe('canAbandon', () => {
  it('allows a 1v1 from the start, also in the first leg', () => {
    expect(canAbandon(snapshot({ legIndex: 0 }))).toBe(true);
    expect(canAbandon(snapshot({ legIndex: 1 }))).toBe(true);
  });

  it('allows a casual game before anyone holds a place', () => {
    expect(canAbandon(casual(['Anna', 'Bartek', 'Celina']))).toBe(true);
  });

  it('allows a Solo 501 but never a Free run', () => {
    expect(canAbandon(snapshot({ type: 'practice', practiceMode: 'solo_501', players: [player('p1', 'Anna')] }))).toBe(true);
    expect(canAbandon(snapshot({ type: 'practice', practiceMode: 'free_run', players: [player('p1', 'Anna', { remaining: null })] }))).toBe(false);
  });

  it('never allows a game that is not in progress', () => {
    expect(canAbandon(snapshot({ legIndex: 1, finished: true }))).toBe(false);
    expect(canAbandon(snapshot({ legIndex: 1, status: 'abandoned' }))).toBe(false);
  });
});
