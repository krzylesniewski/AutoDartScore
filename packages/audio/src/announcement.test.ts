import type { AchievementKind, Bust, CasualFinished, DomainEvent, Hit, LegWon, MatchWon, PlayerFinished, TurnCompleted } from '@autoscore/schema';
import { describe, expect, it, vi } from 'vitest';
import { ACHIEVEMENT_CLIPS, announcementFor, EVENT_CLIPS, spokenNumber } from './index.js';

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
    expect(announcementFor(events, [], first)).toEqual({ kind: 'winner', parts: [{ text: 'Zwycięzca', clip: 'events/winner_1.mp3' }] });
  });

  it('plays the second winner clip on the deciding 1v1 checkout for random 0.999', () => {
    const events: DomainEvent[] = [turn(40, [D20]), legWon, matchWon];
    expect(announcementFor(events, [], last)).toEqual({ kind: 'winner', parts: [{ text: 'Zwycięzca', clip: 'events/winner_2.mp3' }] });
  });

  it('plays a winner clip for the first casual place', () => {
    expect(announcementFor([turn(40, [D20]), finished(1)], [], first)).toEqual({ kind: 'winner', parts: [{ text: 'Zwycięzca', clip: 'events/winner_1.mp3' }] });
  });

  it.each([
    [0, 'events/bust_1.mp3'],
    [0.5, 'events/bust_2.mp3'],
    [0.999, 'events/bust_3.mp3'],
  ])('plays a bust clip for random %s', (value, clip) => {
    expect(announcementFor([bust], [], () => value)).toEqual({ kind: 'bust', parts: [{ text: 'Bust', clip }] });
  });

  it.each<[string, DomainEvent[]]>([
    ['a leg checkout that does not end the match', [turn(40, [D20]), legWon]],
    ['a Solo 501 checkout', [turn(100, [T20, D20]), legWon]],
    ['the second casual place alone', [turn(40, [D20]), finished(2)]],
    ['the second casual place that ends the game', [turn(40, [D20]), finished(2), casualFinished]],
  ])('plays Game shot instead of the total on %s', (_name, events) => {
    expect(announcementFor(events, [], first)).toEqual({ kind: 'game_shot', parts: [{ text: 'Game shot', clip: 'events/game_shot.mp3' }] });
  });

  it('plays the score clip and reads the total on a plain turn', () => {
    expect(announcementFor([turn(100)], [], first)).toEqual({ kind: 'score', parts: [{ text: 'sto', clip: 'scores/100.mp3' }] });
  });

  it.each([
    [0, { text: 'Tarcza wisi trochę wyżej', clip: 'events/zero_1.mp3' }],
    [0.999, { text: 'Następnym razem będzie lepiej', clip: 'events/zero_2.mp3' }],
  ])('plays zero after three misses, then a comment for random %s', (value, comment) => {
    expect(announcementFor([turn(0, [MISS, MISS, MISS])], [], () => value)).toEqual({
      kind: 'score',
      parts: [{ text: 'zero', clip: 'scores/0.mp3' }, comment],
    });
  });

  it('adds no zero comment to a bust', () => {
    expect(announcementFor([bust], [], first)).toEqual({ kind: 'bust', parts: [{ text: 'Bust', clip: 'events/bust_1.mp3' }] });
  });

  it('plays the 180 clip', () => {
    expect(announcementFor([turn(180)], [], first)).toEqual({ kind: 'score', parts: [{ text: 'sto osiemdziesiąt', clip: 'scores/180.mp3' }] });
  });

  it.each([163, 166, 169, 172, 173, 175, 176, 178, 179])('has no clip for the unreachable total %i and reads it', (total) => {
    expect(announcementFor([turn(total)], [], first)).toEqual({ kind: 'score', parts: [{ text: spokenNumber(total), clip: null }] });
  });

  it('returns null without domain events', () => {
    expect(announcementFor([], [], first)).toBeNull();
  });

  it('picks the main variant before the zero variant', () => {
    const random = vi.fn(() => 0);
    announcementFor([turn(0, [MISS, MISS, MISS])], ['turn_record'], random);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it('does not call random for a plain turn or a game shot', () => {
    const random = vi.fn(() => 0);
    announcementFor([turn(100)], [], random);
    announcementFor([turn(40, [D20]), legWon], [], random);
    expect(random).not.toHaveBeenCalled();
  });
});

describe('announcementFor with achievements', () => {
  const achievement = (kind: AchievementKind) => ({ text: expect.any(String) as string, clip: ACHIEVEMENT_CLIPS[kind] });

  it('reads the turn record after the score', () => {
    expect(announcementFor([turn(140)], ['turn_record'], first)).toEqual({
      kind: 'score',
      parts: [
        { text: 'sto czterdzieści', clip: 'scores/140.mp3' },
        { text: 'Nowy rekord tury', clip: 'events/achievement_turn_record.mp3' },
      ],
    });
  });

  it.each<[string, AchievementKind[]]>([
    ['in order', ['first_180', 'turn_record']],
    ['reversed', ['turn_record', 'first_180']],
  ])('reads first_180 before turn_record when passed %s', (_name, kinds) => {
    expect(announcementFor([turn(180)], kinds, first)).toEqual({
      kind: 'score',
      parts: [
        { text: 'sto osiemdziesiąt', clip: 'scores/180.mp3' },
        { text: 'Pierwsze sto osiemdziesiąt', clip: 'events/first_180.mp3' },
        { text: 'Nowy rekord tury', clip: 'events/achievement_turn_record.mp3' },
      ],
    });
  });

  it('reads the leg achievements after Game shot', () => {
    const events: DomainEvent[] = [turn(40, [D20]), legWon];
    expect(announcementFor(events, ['longest_leg', 'shortest_leg', 'checkout_record'], first)).toEqual({
      kind: 'game_shot',
      parts: [
        { text: 'Game shot', clip: 'events/game_shot.mp3' },
        { text: 'Nowy rekord zamknięcia', clip: 'events/achievement_checkout_record.mp3' },
        { text: 'Najkrótszy leg w historii', clip: 'events/achievement_shortest_leg.mp3' },
        { text: 'Najdłuższy leg w historii', clip: 'events/achievement_longest_leg.mp3' },
      ],
    });
  });

  it('reads the achievements after Zwycięzca', () => {
    const events: DomainEvent[] = [turn(100, [T20, D20]), legWon, matchWon];
    expect(announcementFor(events, ['checkout_record', 'first_100'], first)).toEqual({
      kind: 'winner',
      parts: [{ text: 'Zwycięzca', clip: 'events/winner_1.mp3' }, achievement('first_100'), achievement('checkout_record')],
    });
  });

  it('reads a duplicate kind once', () => {
    const events: DomainEvent[] = [turn(40, [D20]), legWon];
    expect(announcementFor(events, ['longest_leg', 'longest_leg'], first)?.parts).toEqual([
      { text: 'Game shot', clip: 'events/game_shot.mp3' },
      achievement('longest_leg'),
    ]);
  });

  it('gives null for achievements without a main readout', () => {
    expect(announcementFor([], ['turn_record', 'first_100'], first)).toBeNull();
  });

  it('lists every achievement and zero clip in EVENT_CLIPS', () => {
    expect(EVENT_CLIPS).toHaveLength(16);
    expect(EVENT_CLIPS).toEqual(expect.arrayContaining([...Object.values(ACHIEVEMENT_CLIPS), 'events/zero_1.mp3', 'events/zero_2.mp3']));
  });
});
