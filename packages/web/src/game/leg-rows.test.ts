import type { LegTurn, MatchLeg } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { legTurn, matchLeg, scoredTurns } from '../test/snapshots';
import { legRows, legStory } from './leg-rows';

const NAMES = new Map([
  ['p1', 'Anna'],
  ['p2', 'Bartek'],
]);

// Ostatnia tura Anny: Miss i D20 za 40, zamknięcie w 26. rzutce.
function annaCheckout(): LegTurn {
  return legTurn('p1', {
    turnIndex: 8,
    darts: [
      { segment: 0, multiplier: 0 },
      { segment: 20, multiplier: 2 },
    ],
    points: 40,
    remainingAfter: 0,
  });
}

function interleave(first: readonly LegTurn[], second: readonly LegTurn[]): LegTurn[] {
  return first.flatMap((turn, index) => [turn, ...(second[index] ? [second[index]] : [])]);
}

function wonLeg(): MatchLeg {
  const anna = [...scoredTurns('p1', [60, 45, 81, 100, 41, 60, 54, 20]), annaCheckout()];
  const bartek = scoredTurns('p2', [41, 85, 26, 60, 100, 45, 57, 27]);
  return matchLeg({
    legIndex: 3,
    starterId: 'p1',
    winnerId: 'p1',
    checkout: 40,
    dartsThrown: 26,
    players: [
      { playerId: 'p1', darts: 26, average: 57.807 },
      { playerId: 'p2', darts: 24, average: 55.125 },
    ],
    turns: interleave(anna, bartek),
  });
}

describe('legRows', () => {
  it('pairs the turns of both players by round and counts the darts as thrown', () => {
    const rows = legRows(wonLeg(), ['p1', 'p2']);
    expect(rows).toHaveLength(9);
    expect(rows.map((row) => row.darts)).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 26]);
    expect(rows[0]?.sides).toEqual([
      { points: 60, remainingAfter: 441, bust: false, checkout: null },
      { points: 41, remainingAfter: 460, bust: false, checkout: null },
    ]);
    expect(rows[7]?.sides[1]).toEqual({ points: 27, remainingAfter: 60, bust: false, checkout: null });
    expect(rows[8]?.sides).toEqual([{ points: 40, remainingAfter: 0, bust: false, checkout: 'D20' }, null]);
  });

  it('shows the winner darts in the checkout row when the second player wins', () => {
    const starter = scoredTurns('p1', [100, 100, 100]);
    const winner = [
      ...scoredTurns('p2', [180, 111]),
      legTurn('p2', {
        darts: [
          { segment: 10, multiplier: 1 },
          { segment: 10, multiplier: 2 },
        ],
        points: 30,
        remainingAfter: 0,
      }),
    ];
    const leg = matchLeg({ winnerId: 'p2', checkout: 30, dartsThrown: 8, turns: interleave(starter, winner) });
    const rows = legRows(leg, ['p1', 'p2']);
    expect(rows.map((row) => row.darts)).toEqual([3, 6, 8]);
    expect(rows[2]?.sides[0]?.checkout).toBeNull();
    expect(rows[2]?.sides[1]?.checkout).toBe('D10');
  });

  it('counts a one-dart bust as one dart and keeps the score before the turn', () => {
    const bust = legTurn('p1', { darts: [{ segment: 20, multiplier: 3 }], bust: true, points: 0, remainingAfter: 40 });
    const rows = legRows(matchLeg({ turns: [bust] }), ['p1', 'p2']);
    expect(rows).toEqual([{ round: 1, sides: [{ points: 0, remainingAfter: 40, bust: true, checkout: null }, null], darts: 1 }]);
  });

  it('marks no checkout on a bust that reaches zero points or for the loser', () => {
    const leg = matchLeg({ winnerId: 'p2', checkout: 40, dartsThrown: 3, turns: [legTurn('p1', { points: 60, remainingAfter: 0 })] });
    expect(legRows(leg, ['p1', 'p2'])[0]?.sides[0]?.checkout).toBeNull();
  });

  it('returns no rows for a leg without closed turns', () => {
    expect(legRows(matchLeg(), ['p1', 'p2'])).toEqual([]);
  });
});

describe('legStory', () => {
  it('tells the starter, the checkout dart, the darts and the leg average of a won leg', () => {
    expect(legStory(wonLeg(), NAMES)).toBe('Leg 4: zaczyna Anna, zamyka D20 w 26. rzutce (średnia lega 57,81).');
  });

  it('falls back to the checkout points without the winning turn', () => {
    const leg = { ...wonLeg(), turns: [] };
    expect(legStory(leg, NAMES)).toBe('Leg 4: zaczyna Anna, zamyka 40 w 26. rzutce (średnia lega 57,81).');
  });

  it('says the leg is running without a winner', () => {
    expect(legStory(matchLeg({ legIndex: 1, starterId: 'p2' }), NAMES)).toBe('Leg 2: zaczyna Bartek, leg trwa.');
  });
});
