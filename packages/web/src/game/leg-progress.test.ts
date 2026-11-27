import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { legTurn, matchLeg } from '../test/snapshots';
import { legProgressFromTurns } from './leg-progress';

const S = (segment: number): Hit => ({ segment, multiplier: 1 });
const D = (segment: number): Hit => ({ segment, multiplier: 2 });
const T = (segment: number): Hit => ({ segment, multiplier: 3 });

describe('legProgressFromTurns', () => {
  it('gives no progress for a leg without closed turns', () => {
    expect(legProgressFromTurns(matchLeg(), 301, ['p1', 'p2'])).toBeNull();
  });

  it('gives the remaining score after every dart, per player in the given order', () => {
    const leg = matchLeg({
      legIndex: 1,
      starterId: 'p2',
      turns: [
        legTurn('p2', { darts: [T(20), S(20), S(1)], points: 81, remainingAfter: 220 }),
        legTurn('p1', { darts: [T(20), T(20), T(20)], points: 180, remainingAfter: 121 }),
        legTurn('p2', { turnIndex: 1, darts: [S(5)], points: 5, remainingAfter: 215 }),
      ],
    });
    expect(legProgressFromTurns(leg, 301, ['p1', 'p2'])).toEqual({
      legIndex: 1,
      startingScore: 301,
      players: [
        {
          playerId: 'p1',
          points: [
            { dart: 1, remaining: 241, bust: false },
            { dart: 2, remaining: 181, bust: false },
            { dart: 3, remaining: 121, bust: false },
          ],
        },
        {
          playerId: 'p2',
          points: [
            { dart: 1, remaining: 241, bust: false },
            { dart: 2, remaining: 221, bust: false },
            { dart: 3, remaining: 220, bust: false },
            { dart: 4, remaining: 215, bust: false },
          ],
        },
      ],
    });
  });

  it('marks only the last dart of a bust turn and returns to the score before the turn', () => {
    const leg = matchLeg({
      turns: [legTurn('p1', { darts: [S(20), T(20)], points: 0, remainingAfter: 40, bust: true })],
    });
    expect(legProgressFromTurns(leg, 301, ['p1', 'p2'])?.players).toEqual([
      {
        playerId: 'p1',
        points: [
          { dart: 1, remaining: 20, bust: false },
          { dart: 2, remaining: 40, bust: true },
        ],
      },
      { playerId: 'p2', points: [] },
    ]);
  });

  it('ends the line at 0 on the closing dart', () => {
    const leg = matchLeg({
      winnerId: 'p1',
      checkout: 40,
      dartsThrown: 1,
      turns: [legTurn('p1', { darts: [D(20)], points: 40, remainingAfter: 0 })],
    });
    expect(legProgressFromTurns(leg, 301, ['p1', 'p2'])?.players[0]?.points).toEqual([{ dart: 1, remaining: 0, bust: false }]);
  });
});
