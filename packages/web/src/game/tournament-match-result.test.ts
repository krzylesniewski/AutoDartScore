import { describe, expect, it } from 'vitest';
import { fixture, player, snapshot } from '../test/snapshots';
import { headerResult } from './tournament-match-result';

// Mecz w kolejności [p2, p1], a sloty w kolejności [p1, p2].
const played = snapshot({
  id: 'm1',
  status: 'finished',
  finished: true,
  players: [player('p2', 'Bartek', { legsWon: 3 }), player('p1', 'Anna', { legsWon: 2 })],
  winnerId: 'p2',
});

describe('headerResult', () => {
  it('uses the match legs and winner without a correction', () => {
    const entry = fixture({ status: 'finished', matchId: 'm1', result: { legs: [2, 3], winnerId: 'p2', corrected: false } });
    expect(headerResult(played, entry)).toEqual({ legs: [3, 2], winnerId: 'p2', mark: null, played: null });
  });

  it('maps the corrected legs from slot order to match order and keeps the played legs', () => {
    const entry = fixture({ status: 'finished', matchId: 'm1', result: { legs: [3, 1], winnerId: 'p1', corrected: true } });
    expect(headerResult(played, entry)).toEqual({ legs: [1, 3], winnerId: 'p1', mark: 'corrected', played: [3, 2] });
  });

  it('shows the walkover result of a fixture that kept this match', () => {
    const abandoned = snapshot({
      id: 'm1',
      status: 'abandoned',
      players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 2 })],
    });
    const entry = fixture({ status: 'walkover', matchId: 'm1', result: { legs: [3, 0], winnerId: 'p1', corrected: false } });
    expect(headerResult(abandoned, entry)).toEqual({ legs: [3, 0], winnerId: 'p1', mark: 'walkover', played: [1, 2] });
  });

  it('ignores a walkover of another match', () => {
    const entry = fixture({ status: 'walkover', matchId: 'm9', result: { legs: [3, 0], winnerId: 'p1', corrected: false } });
    expect(headerResult(played, entry)).toEqual({ legs: [3, 2], winnerId: 'p2', mark: null, played: null });
  });

  it('uses the match while the fixture runs or is missing', () => {
    const running = snapshot({ players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 0 })] });
    expect(headerResult(running, fixture({ status: 'in_progress', matchId: 'm1' }))).toEqual({
      legs: [1, 0],
      winnerId: null,
      mark: null,
      played: null,
    });
    expect(headerResult(running, undefined).legs).toEqual([1, 0]);
  });
});
