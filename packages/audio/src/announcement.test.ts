import type { Bust, CasualFinished, DomainEvent, Hit, LegWon, MatchWon, PlayerFinished, TurnCompleted } from '@autoscore/schema';
import { describe, expect, it, vi } from 'vitest';
import { announcementFor, spokenNumber } from './index.js';

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

const first = () => 0;
const last = () => 0.999;

describe('announcementFor', () => {
  it('plays the first winner clip on the deciding 1v1 checkout for random 0', () => {
    const events: DomainEvent[] = [turn(40, [D20]), legWon, matchWon];
    expect(announcementFor(events, first)).toEqual({ kind: 'winner', text: 'Zwycięzca', clip: 'events/winner_1.mp3' });
  });

  it('plays the second winner clip on the deciding 1v1 checkout for random 0.999', () => {
    const events: DomainEvent[] = [turn(40, [D20]), legWon, matchWon];
    expect(announcementFor(events, last)).toEqual({ kind: 'winner', text: 'Zwycięzca', clip: 'events/winner_2.mp3' });
  });

  it('plays a winner clip for the first casual place', () => {
    expect(announcementFor([turn(40, [D20]), finished(1)], first)).toEqual({ kind: 'winner', text: 'Zwycięzca', clip: 'events/winner_1.mp3' });
  });

  it.each([
    [0, 'events/bust_1.mp3'],
    [0.5, 'events/bust_2.mp3'],
    [0.999, 'events/bust_3.mp3'],
  ])('plays a bust clip for random %s', (value, clip) => {
    expect(announcementFor([bust], () => value)).toEqual({ kind: 'bust', text: 'Bust', clip });
  });

  it.each<[string, DomainEvent[]]>([
    ['a leg checkout that does not end the match', [turn(40, [D20]), legWon]],
    ['a Solo 501 checkout', [turn(100, [T20, D20]), legWon]],
    ['the second casual place alone', [turn(40, [D20]), finished(2)]],
    ['the second casual place that ends the game', [turn(40, [D20]), finished(2), casualFinished]],
  ])('plays Game shot instead of the total on %s', (_name, events) => {
    expect(announcementFor(events, first)).toEqual({ kind: 'game_shot', text: 'Game shot', clip: 'events/game_shot.mp3' });
  });

  it('plays the score clip and reads the total on a plain turn', () => {
    expect(announcementFor([turn(100)], first)).toEqual({ kind: 'score', text: 'sto', clip: 'scores/100.mp3' });
  });

  it('plays zero after three misses', () => {
    expect(announcementFor([turn(0, [MISS, MISS, MISS])], first)).toEqual({ kind: 'score', text: 'zero', clip: 'scores/0.mp3' });
  });

  it('plays the 180 clip', () => {
    expect(announcementFor([turn(180)], first)).toEqual({ kind: 'score', text: 'sto osiemdziesiąt', clip: 'scores/180.mp3' });
  });

  it.each([163, 166, 169, 172, 173, 175, 176, 178, 179])('has no clip for the unreachable total %i and reads it', (total) => {
    expect(announcementFor([turn(total)], first)).toEqual({ kind: 'score', text: spokenNumber(total), clip: null });
  });

  it('returns null without domain events', () => {
    expect(announcementFor([], first)).toBeNull();
  });

  it('does not call random for a plain turn or a game shot', () => {
    const random = vi.fn(() => 0);
    announcementFor([turn(100)], random);
    announcementFor([turn(40, [D20]), legWon], random);
    expect(random).not.toHaveBeenCalled();
  });
});
