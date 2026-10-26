import type { DomainEvent, Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { buildLegProgress } from './leg-progress.js';

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

const point = (dart: number, remaining: number, isBust = false) => ({ dart, remaining, bust: isBust });

describe('buildLegProgress', () => {
  it('gives the remaining score after every dart of a turn', () => {
    expect(buildLegProgress(['anna', 'bartek'], 301, 0, [turn('anna', 0, [T(20), MISS, S(5)], 65, 236)])).toEqual({
      legIndex: 0,
      startingScore: 301,
      players: [
        { playerId: 'anna', points: [point(1, 241), point(2, 241), point(3, 236)] },
        { playerId: 'bartek', points: [] },
      ],
    });
  });

  it('numbers the darts of a player across the turns of the leg', () => {
    const events = [
      turn('anna', 0, [T(20), T(20), T(20)], 180, 121),
      turn('bartek', 0, [MISS, MISS, MISS], 0, 301),
      turn('anna', 0, [T(20), T(17), D(5)], 121, 0),
      { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 121, dartsThrown: 6 } as const,
    ];
    expect(buildLegProgress(['anna', 'bartek'], 301, 0, events)?.players).toEqual([
      { playerId: 'anna', points: [point(1, 241), point(2, 181), point(3, 121), point(4, 61), point(5, 10), point(6, 0)] },
      { playerId: 'bartek', points: [point(1, 301), point(2, 301), point(3, 301)] },
    ]);
  });

  it('marks a bust on the 2nd dart and returns to the score before the turn', () => {
    const events = [turn('anna', 0, [T(20), T(20), T(20)], 180, 121), bust('anna', 0, [T(20), T(20)], 121)];
    expect(buildLegProgress(['anna'], 301, 0, events)?.players[0]?.points).toEqual([
      point(1, 241),
      point(2, 181),
      point(3, 121),
      point(4, 61),
      point(5, 121, true),
    ]);
  });

  it('marks a bust on the 3rd dart only on the busting dart', () => {
    const events = [turn('anna', 0, [T(20), T(20), T(20)], 180, 121), bust('anna', 0, [S(20), T(20), T(20)], 121)];
    expect(buildLegProgress(['anna'], 301, 0, events)?.players[0]?.points).toEqual([
      point(1, 241),
      point(2, 181),
      point(3, 121),
      point(4, 101),
      point(5, 41),
      point(6, 121, true),
    ]);
  });

  it('ignores the turns of other legs', () => {
    const events = [
      turn('anna', 0, [T(20), T(20), T(20)], 180, 121),
      turn('bartek', 1, [T(20), MISS, MISS], 60, 241),
      turn('anna', 2, [S(1)], 1, 300),
    ];
    expect(buildLegProgress(['anna', 'bartek'], 301, 1, events)).toEqual({
      legIndex: 1,
      startingScore: 301,
      players: [
        { playerId: 'anna', points: [] },
        { playerId: 'bartek', points: [point(1, 241), point(2, 241), point(3, 241)] },
      ],
    });
  });

  it('gives empty points to a player without turns in the leg', () => {
    const events = [turn('bartek', 0, [S(1), S(1), S(1)], 3, 498)];
    expect(buildLegProgress(['anna', 'bartek', 'celina'], 501, 0, events)?.players).toEqual([
      { playerId: 'anna', points: [] },
      { playerId: 'bartek', points: [point(1, 500), point(2, 499), point(3, 498)] },
      { playerId: 'celina', points: [] },
    ]);
  });

  it('gives null when the leg has no closed turn', () => {
    expect(buildLegProgress(['anna', 'bartek'], 301, 0, [])).toBeNull();
    expect(buildLegProgress(['anna', 'bartek'], 301, 1, [turn('anna', 0, [T(20), T(20), T(20)], 180, 121)])).toBeNull();
  });
});
