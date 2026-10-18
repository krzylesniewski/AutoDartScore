import type { Bust, CasualFinished, DomainEvent, Hit, LegWon, MatchWon, PlayerFinished, TurnCompleted } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { announcementFor } from './index.js';

const T20: Hit = { segment: 20, multiplier: 3 };
const D20: Hit = { segment: 20, multiplier: 2 };
const MISS: Hit = { segment: 0, multiplier: 0 };

const turn = (total: number, darts: Hit[] = [T20, T20, T20]): TurnCompleted => ({
  type: 'turn_completed',
  playerId: 'anna',
  legIndex: 0,
  turnIndex: 4,
  darts,
  total,
  remaining: 0,
});
const legWon: LegWon = { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 40, dartsThrown: 15 };
const matchWon: MatchWon = { type: 'match_won', playerId: 'anna', legsWon: { anna: 2, bartek: 1 } };
const bust: Bust = { type: 'bust', playerId: 'anna', legIndex: 0, turnIndex: 4, darts: [T20], remaining: 40 };
const finished = (place: number): PlayerFinished => ({ type: 'player_finished', playerId: 'anna', legIndex: 0, place, checkout: 40, dartsThrown: 15 });
const casualFinished: CasualFinished = {
  type: 'casual_finished',
  placements: [
    { playerId: 'bartek', place: 1 },
    { playerId: 'anna', place: 2 },
    { playerId: 'celina', place: 3 },
  ],
};

describe('announcementFor', () => {
  it('reads only the winner on the deciding 1v1 checkout', () => {
    const events: DomainEvent[] = [turn(40, [D20]), legWon, matchWon];
    expect(announcementFor(events)).toEqual({ kind: 'winner', text: 'Zwycięzca' });
  });

  it('reads the total on a leg checkout that does not end the match', () => {
    expect(announcementFor([turn(40, [D20]), legWon])).toEqual({ kind: 'score', text: 'czterdzieści' });
  });

  it('reads the winner for the first casual place', () => {
    expect(announcementFor([turn(40, [D20]), finished(1)])).toEqual({ kind: 'winner', text: 'Zwycięzca' });
  });

  it('reads the total for the second casual place that ends the game', () => {
    expect(announcementFor([turn(40, [D20]), finished(2), casualFinished])).toEqual({ kind: 'score', text: 'czterdzieści' });
  });

  it('reads the total on a Solo 501 checkout', () => {
    expect(announcementFor([turn(100, [T20, D20]), legWon])).toEqual({ kind: 'score', text: 'sto' });
  });

  it('reads Bust on a bust', () => {
    expect(announcementFor([bust])).toEqual({ kind: 'bust', text: 'Bust' });
  });

  it('reads zero after three misses', () => {
    expect(announcementFor([turn(0, [MISS, MISS, MISS])])).toEqual({ kind: 'score', text: 'zero' });
  });

  it('returns null without domain events', () => {
    expect(announcementFor([])).toBeNull();
  });
});
