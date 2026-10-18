import type { DomainEvent, Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { completedPlayerLegs } from './completed-legs.js';

const S = (segment: number): Hit => ({ segment, multiplier: 1 }) as Hit;
const D = (segment: number): Hit => ({ segment, multiplier: 2 }) as Hit;
const T = (segment: number): Hit => ({ segment, multiplier: 3 }) as Hit;
const MISS = { segment: 0, multiplier: 0 } as Hit;

function turn(playerId: string, legIndex: number, darts: Hit[], total: number, remaining: number): DomainEvent {
  return { type: 'turn_completed', playerId, legIndex, turnIndex: 0, darts, total, remaining };
}

// LEG_301 z test-helpers.ts: Anna 180, Bartek trzy pudła, Anna 121 (T20 T17 D5).
const leg301 = (legIndex: number): DomainEvent[] => [
  turn('anna', legIndex, [T(20), T(20), T(20)], 180, 121),
  turn('bartek', legIndex, [MISS, MISS, MISS], 0, 301),
  turn('anna', legIndex, [T(20), T(17), D(5)], 121, 0),
  { type: 'leg_won', playerId: 'anna', legIndex, checkout: 121, dartsThrown: 6 },
];

describe('completedPlayerLegs', () => {
  it('counts a finished 1v1 leg for both players', () => {
    expect(completedPlayerLegs('match', ['anna', 'bartek'], leg301(0))).toEqual([
      { playerId: 'anna', legIndex: 0, points: 301, darts: 6 },
      { playerId: 'bartek', legIndex: 0, points: 0, darts: 3 },
    ]);
  });

  it('drops an interrupted second leg', () => {
    const events = [...leg301(0), turn('bartek', 1, [T(20), T(20), T(20)], 180, 121), turn('anna', 1, [S(1), S(1), S(1)], 3, 298)];
    expect(completedPlayerLegs('match', ['anna', 'bartek'], events).map((leg) => leg.legIndex)).toEqual([0, 0]);
  });

  it('counts bust darts with 0 points', () => {
    const events: DomainEvent[] = [
      turn('anna', 0, [T(20), T(20), T(20)], 180, 121),
      turn('bartek', 0, [S(20), S(20), S(20)], 60, 241),
      { type: 'bust', playerId: 'anna', legIndex: 0, turnIndex: 1, darts: [T(20), T(20), T(20)], remaining: 121 },
      turn('bartek', 0, [T(20), T(20), T(20)], 180, 61),
      turn('anna', 0, [T(20), T(17), D(5)], 121, 0),
      { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 121, dartsThrown: 9 },
    ];
    expect(completedPlayerLegs('match', ['anna', 'bartek'], events)).toEqual([
      { playerId: 'anna', legIndex: 0, points: 301, darts: 9 },
      { playerId: 'bartek', legIndex: 0, points: 240, darts: 6 },
    ]);
  });

  it('counts only the finished player of an abandoned casual game', () => {
    const events: DomainEvent[] = [
      turn('anna', 0, [T(20), T(20), T(20)], 180, 121),
      turn('bartek', 0, [S(20), S(20), S(20)], 60, 241),
      turn('celina', 0, [S(5), S(5), S(5)], 15, 286),
      turn('anna', 0, [T(20), T(17), D(5)], 121, 0),
      { type: 'player_finished', playerId: 'anna', legIndex: 0, place: 1, checkout: 121, dartsThrown: 6 },
      turn('bartek', 0, [S(20), S(20), S(20)], 60, 181),
    ];
    expect(completedPlayerLegs('casual', ['anna', 'bartek', 'celina'], events)).toEqual([{ playerId: 'anna', legIndex: 0, points: 301, darts: 6 }]);
  });

  it('counts every player once the casual game is over, in any event order', () => {
    const events: DomainEvent[] = [
      { type: 'casual_finished', placements: [{ playerId: 'anna', place: 1 }, { playerId: 'bartek', place: 2 }] },
      turn('anna', 0, [T(20), T(20), T(20)], 180, 121),
      turn('bartek', 0, [MISS, MISS, MISS], 0, 301),
    ];
    expect(completedPlayerLegs('casual', ['anna', 'bartek'], events)).toEqual([
      { playerId: 'anna', legIndex: 0, points: 180, darts: 3 },
      { playerId: 'bartek', legIndex: 0, points: 0, darts: 3 },
    ]);
  });

  it('drops a player without darts in a completed leg', () => {
    const events: DomainEvent[] = [turn('anna', 0, [T(20), T(17), D(5)], 121, 0), { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 121, dartsThrown: 3 }];
    expect(completedPlayerLegs('match', ['anna', 'bartek'], events)).toEqual([{ playerId: 'anna', legIndex: 0, points: 121, darts: 3 }]);
  });

  it('yields nothing for an unfinished Solo 501', () => {
    expect(completedPlayerLegs('practice', ['anna'], [turn('anna', 0, [T(20), T(20), T(20)], 180, 321)])).toEqual([]);
  });
});
