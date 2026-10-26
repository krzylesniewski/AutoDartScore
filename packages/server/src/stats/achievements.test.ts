import type { DomainEvent, Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { detectAchievements, EMPTY_RECORDS, type PlayerRecords } from './achievements.js';

const PLAYERS = ['anna', 'bartek'];

function turn(playerId: string, legIndex: number, total: number, darts = 3): DomainEvent {
  const hits = Array.from({ length: darts }, (): Hit => ({ segment: 20, multiplier: 1 }));
  return { type: 'turn_completed', playerId, legIndex, turnIndex: 0, darts: hits, total, remaining: 100 };
}

function bust(playerId: string, legIndex: number, darts = 3): DomainEvent {
  const hits = Array.from({ length: darts }, (): Hit => ({ segment: 20, multiplier: 3 }));
  return { type: 'bust', playerId, legIndex, turnIndex: 0, darts: hits, remaining: 40 };
}

function legWon(playerId: string, legIndex: number, checkout: number, dartsThrown: number): DomainEvent {
  return { type: 'leg_won', playerId, legIndex, checkout, dartsThrown };
}

interface Options {
  readonly anna?: Partial<PlayerRecords>;
  readonly bartek?: Partial<PlayerRecords>;
  readonly earlierEvents?: readonly DomainEvent[];
  readonly playerIds?: readonly string[];
  readonly eligible?: readonly string[];
}

function detect(newEvents: readonly DomainEvent[], options: Options = {}) {
  const reference = new Map([
    ['anna', { ...EMPTY_RECORDS, ...options.anna }],
    ['bartek', { ...EMPTY_RECORDS, ...options.bartek }],
  ]);
  return detectAchievements({
    reference,
    earlierEvents: options.earlierEvents ?? [],
    newEvents,
    playerIds: options.playerIds ?? PLAYERS,
    eligible: new Set(options.eligible ?? PLAYERS),
  });
}

function kinds(newEvents: readonly DomainEvent[], options: Options = {}) {
  return detect(newEvents, options).map(({ playerId, kind, value, previous }) => ({ playerId, kind, value, previous }));
}

// Anna wygrywa leg 0 w 12 rzutkach (60, 60, 61, 120), Bartek rzuca 9 rzutek i raz ma bust.
const LEG_0: readonly DomainEvent[] = [turn('anna', 0, 60), turn('bartek', 0, 26), turn('anna', 0, 60), bust('bartek', 0), turn('anna', 0, 61), turn('bartek', 0, 20)];
const WIN_LEG_0: readonly DomainEvent[] = [turn('anna', 0, 120), legWon('anna', 0, 120, 12)];

describe('detectAchievements: turn_record', () => {
  it.each([
    { total: 80, expected: [{ playerId: 'anna', kind: 'turn_record', value: 80, previous: 60 }] },
    { total: 60, expected: [] },
    { total: 45, expected: [] },
  ])('turn $total against a best turn of 60', ({ total, expected }) => {
    expect(kinds([turn('anna', 0, total)], { anna: { highestTurn: 60 } })).toEqual(expected);
  });

  it('stays silent without a best turn', () => {
    expect(kinds([turn('anna', 0, 80)])).toEqual([]);
  });

  it('compares the second record of a leg with the first one', () => {
    const earlierEvents = [turn('anna', 0, 80), turn('bartek', 0, 20)];
    expect(kinds([turn('anna', 0, 80)], { anna: { highestTurn: 60 } })).toEqual([{ playerId: 'anna', kind: 'turn_record', value: 80, previous: 60 }]);
    expect(kinds([turn('anna', 0, 90)], { anna: { highestTurn: 60 }, earlierEvents })).toEqual([{ playerId: 'anna', kind: 'turn_record', value: 90, previous: 80 }]);
  });

  it('triggers nothing on a bust', () => {
    expect(kinds([bust('anna', 0)], { anna: { highestTurn: 0, mostDartsInLeg: 0 } })).toEqual([]);
  });
});

describe('detectAchievements: first_*', () => {
  it.each([
    { kind: 'first_100', threshold: 100 },
    { kind: 'first_120', threshold: 120 },
    { kind: 'first_140', threshold: 140 },
    { kind: 'first_180', threshold: 180 },
  ])('$kind at exactly $threshold', ({ kind, threshold }) => {
    expect(kinds([turn('anna', 0, threshold)])).toEqual([{ playerId: 'anna', kind, value: threshold, previous: null }]);
  });

  it.each([100, 120, 140, 180])('stays silent at %i when it was reached before', (threshold) => {
    expect(kinds([turn('anna', 0, threshold)], { anna: { highestTurn: threshold } })).toEqual([]);
  });

  it('counts a threshold reached earlier in the same match', () => {
    expect(kinds([turn('anna', 1, 100)], { earlierEvents: [turn('anna', 0, 101)] })).toEqual([]);
  });

  it('gives only the highest threshold crossed in one turn', () => {
    expect(kinds([turn('anna', 0, 180)])).toEqual([{ playerId: 'anna', kind: 'first_180', value: 180, previous: null }]);
  });

  it('gives a first_* together with a turn_record', () => {
    expect(kinds([turn('anna', 0, 150)], { anna: { highestTurn: 60 } })).toEqual([
      { playerId: 'anna', kind: 'first_140', value: 150, previous: null },
      { playerId: 'anna', kind: 'turn_record', value: 150, previous: 60 },
    ]);
  });
});

describe('detectAchievements: checkout_record', () => {
  it.each([
    { checkout: 50, expected: [{ playerId: 'anna', kind: 'checkout_record', value: 50, previous: 40 }] },
    { checkout: 40, expected: [] },
    { checkout: 32, expected: [] },
  ])('checkout $checkout against a best checkout of 40', ({ checkout, expected }) => {
    expect(kinds([legWon('anna', 0, checkout, 15)], { anna: { highestCheckout: 40 } })).toEqual(expected);
  });

  it('stays silent without a best checkout', () => {
    expect(kinds([legWon('anna', 0, 50, 15)])).toEqual([]);
  });

  it('compares the second leg of a match with the first one', () => {
    const earlierEvents = [legWon('anna', 0, 50, 15)];
    expect(kinds([legWon('anna', 1, 60, 15)], { anna: { highestCheckout: 40 }, earlierEvents })).toEqual([
      { playerId: 'anna', kind: 'checkout_record', value: 60, previous: 50 },
    ]);
  });
});

describe('detectAchievements: shortest_leg', () => {
  it.each([
    { darts: 12, expected: [{ playerId: 'anna', kind: 'shortest_leg', value: 12, previous: 15 }] },
    { darts: 15, expected: [] },
    { darts: 18, expected: [] },
  ])('a leg in $darts darts against a best leg of 15', ({ darts, expected }) => {
    expect(kinds([legWon('anna', 0, 40, darts)], { anna: { fewestDartsInWonLeg: 15 } })).toEqual(expected);
  });

  it('stays silent without a won leg', () => {
    expect(kinds([legWon('anna', 0, 40, 12)])).toEqual([]);
  });
});

describe('detectAchievements: longest_leg', () => {
  it.each([
    { most: 11, expected: [{ playerId: 'anna', kind: 'longest_leg', value: 12, previous: 11 }] },
    { most: 12, expected: [] },
    { most: 15, expected: [] },
  ])('a 12-dart leg against a longest leg of $most', ({ most, expected }) => {
    expect(kinds(WIN_LEG_0, { anna: { highestTurn: 180, mostDartsInLeg: most }, earlierEvents: LEG_0 })).toEqual(expected);
  });

  it('stays silent without a completed leg', () => {
    expect(kinds(WIN_LEG_0, { anna: { highestTurn: 180 }, earlierEvents: LEG_0 })).toEqual([]);
  });

  it('counts bust darts of the loser', () => {
    expect(kinds(WIN_LEG_0, { anna: { highestTurn: 180 }, bartek: { mostDartsInLeg: 6 }, earlierEvents: LEG_0 })).toEqual([
      { playerId: 'bartek', kind: 'longest_leg', value: 9, previous: 6 },
    ]);
  });

  it('compares with completed legs only, not with the leg in progress', () => {
    const leg1 = [...Array.from({ length: 5 }, () => turn('anna', 1, 20)), ...Array.from({ length: 3 }, () => turn('bartek', 1, 20))];
    const earlierEvents = [...LEG_0, ...WIN_LEG_0, ...leg1];
    expect(kinds([turn('anna', 1, 40), legWon('anna', 1, 40, 18)], { anna: { highestTurn: 180 }, earlierEvents })).toEqual([
      { playerId: 'anna', kind: 'longest_leg', value: 18, previous: 12 },
    ]);
  });

  it('lists the leg winner first', () => {
    const options = { anna: { highestTurn: 180, mostDartsInLeg: 3 }, bartek: { mostDartsInLeg: 3 }, earlierEvents: LEG_0, playerIds: ['bartek', 'anna'] };
    expect(kinds(WIN_LEG_0, options).map(({ playerId }) => playerId)).toEqual(['anna', 'bartek']);
  });
});

describe('detectAchievements', () => {
  it('orders the kinds and sets previous to null only for first_*', () => {
    const options = {
      anna: { highestTurn: 110, highestCheckout: 40, fewestDartsInWonLeg: 15, mostDartsInLeg: 15 },
      bartek: { mostDartsInLeg: 6 },
      earlierEvents: LEG_0,
    };
    const achievements = kinds(WIN_LEG_0, options);
    expect(achievements).toEqual([
      { playerId: 'anna', kind: 'first_120', value: 120, previous: null },
      { playerId: 'anna', kind: 'turn_record', value: 120, previous: 110 },
      { playerId: 'anna', kind: 'checkout_record', value: 120, previous: 40 },
      { playerId: 'anna', kind: 'shortest_leg', value: 12, previous: 15 },
      { playerId: 'bartek', kind: 'longest_leg', value: 9, previous: 6 },
    ]);
    for (const { kind, previous } of achievements) {
      expect(previous === null).toBe(kind.startsWith('first_'));
    }
  });

  it('gives nothing to a player who is not eligible', () => {
    const options = { anna: { highestTurn: 60, mostDartsInLeg: 3 }, bartek: { mostDartsInLeg: 3 }, earlierEvents: LEG_0, eligible: ['bartek'] };
    expect(kinds(WIN_LEG_0, options)).toEqual([{ playerId: 'bartek', kind: 'longest_leg', value: 9, previous: 3 }]);
  });

  it('returns achievements without matchId and eventSeq', () => {
    expect(detect([turn('anna', 0, 100)])).toEqual([{ type: 'achievement', playerId: 'anna', kind: 'first_100', value: 100, previous: null }]);
  });
});
