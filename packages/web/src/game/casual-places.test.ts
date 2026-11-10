import { describe, expect, it } from 'vitest';
import { casual, summary, summaryPlayer } from '../test/snapshots';
import { casualPlaces } from './casual-places';

const state = casual(['Anna', 'Bartek', 'Celina'], {
  finished: true,
  currentPlayerId: null,
  placements: [
    { playerId: 'p1', place: 2 },
    { playerId: 'p3', place: 1 },
    { playerId: 'p2', place: 3 },
  ],
});

const lines = summary({
  type: 'casual',
  players: [summaryPlayer('p1', { dartsThrown: 33 }), summaryPlayer('p2', { dartsThrown: 36 }), summaryPlayer('p3', { dartsThrown: 27 })],
});

describe('casualPlaces', () => {
  it('orders the players by place and joins their summary lines', () => {
    const places = casualPlaces(state, lines);
    expect(places.map((entry) => [entry.place, entry.player.name, entry.line?.dartsThrown])).toEqual([
      [1, 'Celina', 27],
      [2, 'Anna', 33],
      [3, 'Bartek', 36],
    ]);
  });

  it('gives a null line without a summary', () => {
    const places = casualPlaces(state, null);
    expect(places.map((entry) => entry.player.name)).toEqual(['Celina', 'Anna', 'Bartek']);
    expect(places.map((entry) => entry.line)).toEqual([null, null, null]);
  });

  it('gives a null line to a player missing from the summary', () => {
    const places = casualPlaces(state, summary({ type: 'casual', players: [summaryPlayer('p3')] }));
    expect(places.map((entry) => entry.line?.playerId ?? null)).toEqual(['p3', null, null]);
  });

  it('skips a placement of an unknown player', () => {
    const places = casualPlaces({ ...state, placements: [...state.placements, { playerId: 'p9', place: 4 }] }, lines);
    expect(places.map((entry) => entry.player.id)).toEqual(['p3', 'p1', 'p2']);
  });
});
