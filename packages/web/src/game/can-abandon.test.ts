import { describe, expect, it } from 'vitest';
import { casual, player, snapshot } from '../test/snapshots';
import { canAbandon } from './can-abandon';

describe('canAbandon', () => {
  it('allows a 1v1 only after the first leg', () => {
    expect(canAbandon(snapshot({ legIndex: 0 }))).toBe(false);
    expect(canAbandon(snapshot({ legIndex: 1 }))).toBe(true);
  });

  it('allows a casual game only once someone holds a place', () => {
    const game = casual(['Anna', 'Bartek', 'Celina']);
    expect(canAbandon(game)).toBe(false);
    expect(canAbandon({ ...game, players: [player('p1', 'Anna', { remaining: 0, place: 1 }), ...game.players.slice(1)] })).toBe(true);
  });

  it('never allows a practice game', () => {
    expect(canAbandon(snapshot({ type: 'practice', practiceMode: 'solo_501', legIndex: 1, players: [player('p1', 'Anna')] }))).toBe(false);
    expect(canAbandon(snapshot({ type: 'practice', practiceMode: 'free_run', players: [player('p1', 'Anna', { remaining: null })] }))).toBe(false);
  });

  it('never allows a game that is not in progress', () => {
    expect(canAbandon(snapshot({ legIndex: 1, finished: true }))).toBe(false);
    expect(canAbandon(snapshot({ legIndex: 1, status: 'abandoned' }))).toBe(false);
  });
});
