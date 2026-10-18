import type { DomainEvent, Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { EMPTY_TOTALS, mergeTotals, tallyGame, toStatLine } from './tally.js';

const S = (segment: number): Hit => ({ segment, multiplier: 1 }) as Hit;
const D = (segment: number): Hit => ({ segment, multiplier: 2 }) as Hit;
const T = (segment: number): Hit => ({ segment, multiplier: 3 }) as Hit;
const MISS = { segment: 0, multiplier: 0 } as Hit;

function turn(playerId: string, legIndex: number, darts: Hit[], total: number, remaining: number): DomainEvent {
  return { type: 'turn_completed', playerId, legIndex, turnIndex: 0, darts, total, remaining };
}

function bust(playerId: string, legIndex: number, darts: Hit[], remaining: number): DomainEvent {
  return { type: 'bust', playerId, legIndex, turnIndex: 0, darts, remaining };
}

function legWon(playerId: string, legIndex: number, checkout: number, dartsThrown: number): DomainEvent {
  return { type: 'leg_won', playerId, legIndex, checkout, dartsThrown };
}

function line(type: Parameters<typeof tallyGame>[0], playerIds: string[], events: DomainEvent[], playerId: string) {
  return toStatLine(tallyGame(type, playerIds, events).players.get(playerId) ?? EMPTY_TOTALS);
}

// LEG_301 z test-helpers.ts: Anna 180, Bartek trzy pudła, Anna 121 (T20 T17 D5).
const leg301: DomainEvent[] = [
  turn('anna', 0, [T(20), T(20), T(20)], 180, 121),
  turn('bartek', 0, [MISS, MISS, MISS], 0, 301),
  turn('anna', 0, [T(20), T(17), D(5)], 121, 0),
  legWon('anna', 0, 121, 6),
  { type: 'match_won', playerId: 'anna', legsWon: { anna: 1, bartek: 0 } },
];

describe('tallyGame', () => {
  it('counts the LEG_301 match for both players', () => {
    const tally = tallyGame('match', ['anna', 'bartek'], leg301);
    expect(toStatLine(tally.players.get('anna') ?? EMPTY_TOTALS)).toEqual({
      dartsThrown: 6,
      points: 301,
      average: 150.5,
      first9Average: 150.5,
      scores180: 1,
      scores140: 0,
      scores100: 1,
      scores60: 0,
      highestCheckout: 121,
      doubleAttempts: 1,
      doublesHit: 1,
      doublesPercent: 100,
      bestLegDarts: 6,
      legsWon: 1,
    });
    expect(toStatLine(tally.players.get('bartek') ?? EMPTY_TOTALS)).toEqual({
      dartsThrown: 3,
      points: 0,
      average: 0,
      first9Average: 0,
      scores180: 0,
      scores140: 0,
      scores100: 0,
      scores60: 0,
      highestCheckout: null,
      doubleAttempts: 0,
      doublesHit: 0,
      doublesPercent: null,
      bestLegDarts: null,
      legsWon: 0,
    });
    expect(tally.winnerId).toBe('anna');
    expect(tally.legs).toEqual([
      {
        legIndex: 0,
        winnerId: 'anna',
        checkout: 121,
        dartsThrown: 6,
        averages: [
          { playerId: 'anna', average: 150.5 },
          { playerId: 'bartek', average: 0 },
        ],
      },
    ]);
  });

  it('counts a Solo 501 checkout without a won leg', () => {
    const events: DomainEvent[] = [
      turn('anna', 0, [T(20), T(20), T(20)], 180, 321),
      turn('anna', 0, [T(20), T(20), T(20)], 180, 141),
      turn('anna', 0, [T(20), T(19), D(12)], 141, 0),
      legWon('anna', 0, 141, 9),
    ];
    const tally = tallyGame('practice', ['anna'], events);
    expect(toStatLine(tally.players.get('anna') ?? EMPTY_TOTALS)).toMatchObject({
      dartsThrown: 9,
      average: 167,
      first9Average: 167,
      scores180: 2,
      scores140: 1,
      highestCheckout: 141,
      doubleAttempts: 1,
      doublesHit: 1,
      bestLegDarts: 9,
      legsWon: 0,
    });
    expect(tally.winnerId).toBeNull();
    expect(tally.legs).toHaveLength(1);
  });

  it('counts two double attempts and no hit for a bust from 40', () => {
    const stats = line('practice', ['anna'], [bust('anna', 0, [S(20), S(19)], 40)], 'anna');
    expect(stats).toMatchObject({ doubleAttempts: 2, doublesHit: 0, doublesPercent: 0, dartsThrown: 2, points: 0, average: 0 });
  });

  it('takes the first 9 from the first three turns of the leg', () => {
    const events: DomainEvent[] = [
      turn('anna', 0, [T(20), S(20), S(20)], 100, 401),
      turn('anna', 0, [S(20), S(20), S(20)], 60, 341),
      turn('anna', 0, [S(20), S(20), S(5)], 45, 296),
      turn('anna', 0, [T(20), T(20), T(20)], 180, 116),
    ];
    expect(line('practice', ['anna'], events, 'anna')).toMatchObject({ first9Average: 68.33, average: 96.25 });
  });

  it('counts a bust turn as one of the first three turns', () => {
    const events: DomainEvent[] = [
      turn('anna', 0, [T(20), T(20), T(20)], 180, 141),
      bust('anna', 0, [T(20), T(20), T(20)], 141),
      turn('anna', 0, [T(20), S(1), MISS], 61, 80),
      turn('anna', 0, [T(20), S(20), MISS], 80, 0),
    ];
    expect(line('practice', ['anna'], events, 'anna').first9Average).toBe(80.33);
  });

  it('uses fewer darts for the first 9 when the leg ends before the third turn', () => {
    const events: DomainEvent[] = [
      // Leg 0: Anna kończy w drugiej turze, Bartek ma tylko jedną.
      turn('anna', 0, [T(20), T(20), T(20)], 180, 121),
      turn('bartek', 0, [S(20), S(20), S(20)], 60, 241),
      turn('anna', 0, [T(20), T(17), D(5)], 121, 0),
      legWon('anna', 0, 121, 6),
      // Leg 1: pierwsze trzy tury Bartka liczą się od nowa.
      turn('bartek', 1, [T(20), T(20), T(20)], 180, 121),
      turn('anna', 1, [S(1), S(1), S(1)], 3, 298),
    ];
    const tally = tallyGame('match', ['anna', 'bartek'], events);
    const bartek = tally.players.get('bartek') ?? EMPTY_TOTALS;
    expect(bartek).toMatchObject({ first9Points: 240, first9Darts: 6 });
    expect(toStatLine(bartek).first9Average).toBe(120);
    expect(tally.legs[0]?.averages).toEqual([
      { playerId: 'anna', average: 150.5 },
      { playerId: 'bartek', average: 60 },
    ]);
  });

  it('ignores darts of an open turn because it has no event yet', () => {
    expect(line('match', ['anna', 'bartek'], [], 'anna')).toMatchObject({ dartsThrown: 0, average: null, first9Average: null });
  });

  it('keeps the score buckets apart', () => {
    const totals = [180, 179, 140, 139, 100, 99, 60, 59].map((total) => turn('anna', 0, [T(20)], total, 200));
    expect(line('practice', ['anna'], totals, 'anna')).toMatchObject({ scores180: 1, scores140: 2, scores100: 2, scores60: 2 });
  });

  it('counts a Bull finish as a double attempt', () => {
    const events: DomainEvent[] = [turn('anna', 0, [S(10), { segment: 25, multiplier: 2 } as Hit], 60, 0)];
    // Przed pierwszą rzutką zostaje 60 (nie do zamknięcia jedną rzutką), przed drugą 50 (Bull).
    expect(line('practice', ['anna'], events, 'anna').doubleAttempts).toBe(1);
  });

  it('adds 1st place in a casual game to legsWon, but not 2nd place', () => {
    const events: DomainEvent[] = [
      turn('anna', 0, [T(20), D(20)], 100, 0),
      { type: 'player_finished', playerId: 'anna', legIndex: 0, place: 1, checkout: 100, dartsThrown: 2 },
      turn('bartek', 0, [D(16)], 32, 0),
      { type: 'player_finished', playerId: 'bartek', legIndex: 0, place: 2, checkout: 32, dartsThrown: 1 },
      { type: 'casual_finished', placements: [{ playerId: 'anna', place: 1 }, { playerId: 'bartek', place: 2 }, { playerId: 'celina', place: 3 }] },
    ];
    const tally = tallyGame('casual', ['anna', 'bartek', 'celina'], events);
    expect(toStatLine(tally.players.get('anna') ?? EMPTY_TOTALS)).toMatchObject({ legsWon: 1, doublesHit: 1, highestCheckout: 100 });
    expect(toStatLine(tally.players.get('bartek') ?? EMPTY_TOTALS)).toMatchObject({ legsWon: 0, doublesHit: 1, highestCheckout: 32, bestLegDarts: 1 });
    expect(tally.winnerId).toBe('anna');
    expect(tally.legs).toEqual([]);
  });
});

describe('mergeTotals', () => {
  it('adds counts and keeps the best checkout and leg', () => {
    const a = { ...EMPTY_TOTALS, points: 100, darts: 3, highestCheckout: 40, bestLegDarts: 15, legsWon: 1 };
    const b = { ...EMPTY_TOTALS, points: 60, darts: 6, highestCheckout: 121, bestLegDarts: 18, legsWon: 2 };
    expect(mergeTotals(a, b)).toMatchObject({ points: 160, darts: 9, highestCheckout: 121, bestLegDarts: 15, legsWon: 3 });
    expect(mergeTotals(EMPTY_TOTALS, a)).toEqual(a);
    expect(mergeTotals(a, EMPTY_TOTALS)).toEqual(a);
  });
});
