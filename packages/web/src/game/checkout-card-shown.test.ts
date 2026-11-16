import { describe, expect, it } from 'vitest';
import { player, snapshot } from '../test/snapshots';
import { checkoutCardShown } from './checkout-card-shown';

describe('checkoutCardShown', () => {
  it('shows the card for the current X01 player with a route', () => {
    expect(checkoutCardShown(snapshot({ players: [player('p1', 'Anna', { remaining: 40 }), player('p2', 'Bartek')] }))).toBe(true);
  });

  it('shows the card without a route', () => {
    expect(checkoutCardShown(snapshot({ players: [player('p1', 'Anna', { remaining: 301 }), player('p2', 'Bartek')] }))).toBe(true);
  });

  it('hides the card in a finished game', () => {
    expect(
      checkoutCardShown(snapshot({ finished: true, players: [player('p1', 'Anna', { remaining: 40 }), player('p2', 'Bartek')] })),
    ).toBe(false);
  });

  it('hides the card in Free run', () => {
    const state = snapshot({
      type: 'practice',
      practiceMode: 'free_run',
      startingScore: null,
      players: [player('p1', 'Anna', { remaining: null })],
    });
    expect(checkoutCardShown(state)).toBe(false);
  });

  it('hides the card without a current player', () => {
    expect(checkoutCardShown(snapshot({ currentPlayerId: null }))).toBe(false);
  });

  it('hides the card when the current player has no remaining score', () => {
    expect(checkoutCardShown(snapshot({ players: [player('p1', 'Anna', { remaining: null }), player('p2', 'Bartek')] }))).toBe(false);
  });
});
