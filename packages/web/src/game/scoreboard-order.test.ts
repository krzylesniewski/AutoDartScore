import { describe, expect, it } from 'vitest';
import { casual, player, snapshot } from '../test/snapshots';
import { scoreboardOrder } from './scoreboard-order';

function ids(order: readonly { id: string }[]): string[] {
  return order.map((entry) => entry.id);
}

describe('scoreboardOrder', () => {
  it('puts the thrower first in a 1v1 match', () => {
    expect(ids(scoreboardOrder(snapshot({ currentPlayerId: 'p2' })))).toEqual(['p2', 'p1']);
    expect(ids(scoreboardOrder(snapshot({ currentPlayerId: 'p1' })))).toEqual(['p1', 'p2']);
  });

  it('rotates four casual players around the third one', () => {
    const state = casual(['Anna', 'Bartek', 'Celina', 'Darek'], { currentPlayerId: 'p3' });
    expect(ids(scoreboardOrder(state))).toEqual(['p3', 'p4', 'p1', 'p2']);
  });

  it('moves finished casual players to the bottom by place', () => {
    const state = casual(['Anna', 'Bartek', 'Celina', 'Darek'], {
      currentPlayerId: 'p4',
      players: [
        player('p1', 'Anna', { place: 2, remaining: 0 }),
        player('p2', 'Bartek'),
        player('p3', 'Celina', { place: 1, remaining: 0 }),
        player('p4', 'Darek'),
      ],
    });
    expect(ids(scoreboardOrder(state))).toEqual(['p4', 'p2', 'p3', 'p1']);
  });

  it('keeps creation order once the game is over', () => {
    const state = snapshot({
      finished: true,
      currentPlayerId: null,
      winnerId: 'p2',
      players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 2, remaining: 0 })],
    });
    expect(ids(scoreboardOrder(state))).toEqual(['p1', 'p2']);
  });
});
