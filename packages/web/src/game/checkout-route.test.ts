import { describe, expect, it } from 'vitest';
import { player, snapshot } from '../test/snapshots';
import { checkoutRoute } from './checkout-route';

describe('checkoutRoute', () => {
  it('suggests a route for the current X01 player and the darts left', () => {
    const state = snapshot({ currentPlayerId: 'p2', players: [player('p1', 'Anna', { remaining: 40 }), player('p2', 'Bartek', { remaining: 100 })] });
    expect(checkoutRoute(state)).toEqual([
      { segment: 20, multiplier: 3 },
      { segment: 20, multiplier: 2 },
    ]);
  });

  it('counts only the darts left in the turn', () => {
    const state = snapshot({
      currentDarts: [
        { segment: 20, multiplier: 1 },
        { segment: 20, multiplier: 1 },
      ],
      players: [player('p1', 'Anna', { remaining: 100 }), player('p2', 'Bartek')],
    });
    expect(checkoutRoute(state)).toBeNull();
    expect(checkoutRoute({ ...state, players: [player('p1', 'Anna', { remaining: 32 }), player('p2', 'Bartek')] })).toEqual([{ segment: 16, multiplier: 2 }]);
  });

  it('returns null for a finished game', () => {
    const state = snapshot({ finished: true, players: [player('p1', 'Anna', { remaining: 40 }), player('p2', 'Bartek')] });
    expect(checkoutRoute(state)).toBeNull();
  });

  it('returns null in Free run', () => {
    const state = snapshot({ type: 'practice', practiceMode: 'free_run', startingScore: null, players: [player('p1', 'Anna', { remaining: null })] });
    expect(checkoutRoute(state)).toBeNull();
  });

  it('returns null without a current player', () => {
    expect(checkoutRoute(snapshot({ currentPlayerId: null, players: [player('p1', 'Anna', { remaining: 40 }), player('p2', 'Bartek')] }))).toBeNull();
  });

  it('returns null without a route', () => {
    expect(checkoutRoute(snapshot({ players: [player('p1', 'Anna', { remaining: 301 }), player('p2', 'Bartek')] }))).toBeNull();
    expect(checkoutRoute(snapshot({ players: [player('p1', 'Anna', { remaining: 169 }), player('p2', 'Bartek')] }))).toBeNull();
  });

  it('returns null with no darts left in the turn', () => {
    const state = snapshot({
      currentDarts: [
        { segment: 1, multiplier: 1 },
        { segment: 1, multiplier: 1 },
        { segment: 1, multiplier: 1 },
      ],
      players: [player('p1', 'Anna', { remaining: 40 }), player('p2', 'Bartek')],
    });
    expect(checkoutRoute(state)).toBeNull();
  });
});
