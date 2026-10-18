import type { DomainEvent, Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { buildHeadToHead } from './head-to-head.js';

const S = (segment: number): Hit => ({ segment, multiplier: 1 }) as Hit;
const D = (segment: number): Hit => ({ segment, multiplier: 2 }) as Hit;
const T = (segment: number): Hit => ({ segment, multiplier: 3 }) as Hit;
const MISS = { segment: 0, multiplier: 0 } as Hit;

function turn(playerId: string, legIndex: number, darts: Hit[], total: number, remaining: number): DomainEvent {
  return { type: 'turn_completed', playerId, legIndex, turnIndex: 0, darts, total, remaining };
}

// Zwycięzca rzuca 180, przegrany trzy pudła, zwycięzca kończy 121 (T20 T17 D5).
function leg301(winner: string, loser: string, legIndex: number): DomainEvent[] {
  return [
    turn(winner, legIndex, [T(20), T(20), T(20)], 180, 121),
    turn(loser, legIndex, [MISS, MISS, MISS], 0, 301),
    turn(winner, legIndex, [T(20), T(17), D(5)], 121, 0),
    { type: 'leg_won', playerId: winner, legIndex, checkout: 121, dartsThrown: 6 },
  ];
}

describe('buildHeadToHead', () => {
  it('gives zeros and null averages without games', () => {
    expect(buildHeadToHead({ playerId: 'anna', opponentId: 'bartek', games: [] })).toEqual({
      playerId: 'anna',
      opponentId: 'bartek',
      matchesPlayed: 0,
      matchesWon: 0,
      opponentMatchesWon: 0,
      legsWon: 0,
      opponentLegsWon: 0,
      average: null,
      opponentAverage: null,
    });
  });

  it('counts matches and legs from both sides', () => {
    const won = { winnerId: 'anna', events: [...leg301('anna', 'bartek', 0), ...leg301('bartek', 'anna', 1), ...leg301('anna', 'bartek', 2)] };
    const lost = { winnerId: 'bartek', events: [...leg301('bartek', 'anna', 0), ...leg301('bartek', 'anna', 1)] };
    expect(buildHeadToHead({ playerId: 'anna', opponentId: 'bartek', games: [won, lost] })).toMatchObject({
      matchesPlayed: 2,
      matchesWon: 1,
      opponentMatchesWon: 1,
      legsWon: 2,
      opponentLegsWon: 3,
    });
  });

  it('sums points and darts across games instead of averaging the averages', () => {
    const first = { winnerId: 'anna', events: leg301('anna', 'bartek', 0) };
    const second = {
      winnerId: 'bartek',
      events: [
        turn('bartek', 0, [T(20), T(20), T(20)], 180, 121),
        turn('anna', 0, [S(20), S(20), S(20)], 60, 241),
        turn('bartek', 0, [T(20), T(17), D(5)], 121, 0),
        { type: 'leg_won', playerId: 'bartek', legIndex: 0, checkout: 121, dartsThrown: 6 } as DomainEvent,
      ],
    };
    const result = buildHeadToHead({ playerId: 'anna', opponentId: 'bartek', games: [first, second] });
    // Anna: 301 + 60 punktów w 9 rzutkach. Bartek: 0 + 301 punktów w 9 rzutkach.
    expect(result.average).toBe(120.33);
    expect(result.opponentAverage).toBe(100.33);
  });

  it('leaves the interrupted leg out of the averages but keeps the won legs', () => {
    const game = {
      winnerId: null,
      events: [...leg301('anna', 'bartek', 0), turn('anna', 1, [S(1), S(1), S(1)], 3, 298), turn('bartek', 1, [T(20), T(20), T(20)], 180, 121)],
    };
    expect(buildHeadToHead({ playerId: 'anna', opponentId: 'bartek', games: [game] })).toMatchObject({
      matchesPlayed: 1,
      matchesWon: 0,
      opponentMatchesWon: 0,
      legsWon: 1,
      opponentLegsWon: 0,
      average: 150.5,
      opponentAverage: 0,
    });
  });
});
