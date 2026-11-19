import { StandingRow } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { computeStandings, type FinishedFixture } from './standings.js';
import type { FixtureScoring } from './tournament.js';

function played(
  first: string,
  second: string,
  legs: readonly [number, number],
  scoring: readonly [FixtureScoring, FixtureScoring] | null = null,
): FinishedFixture {
  return { playerIds: [first, second], legs, scoring };
}

// Wynik przez kontrakt, żeby każdy wiersz przechodził StandingRow.parse.
function table(players: readonly string[], order: readonly string[], fixtures: readonly FinishedFixture[]) {
  return computeStandings(players, order, fixtures).map((row) => StandingRow.parse(row));
}

function places(rows: readonly StandingRow[]): string[] {
  return rows.map((row) => row.playerId);
}

const score = (points: number, darts: number): FixtureScoring => ({ points, darts });

describe('computeStandings rows', () => {
  it('lists every player with 0 played before any match, in drawn order', () => {
    const rows = table(['a', 'b', 'c'], ['c', 'a', 'b'], []);
    expect(places(rows)).toEqual(['c', 'a', 'b']);
    expect(rows[0]).toEqual({
      playerId: 'c',
      place: 1,
      played: 0,
      won: 0,
      lost: 0,
      legsFor: 0,
      legsAgainst: 0,
      legDifference: 0,
      points: 0,
      average: null,
      withdrawn: false,
      advances: false,
    });
    expect(rows.map((row) => row.place)).toEqual([1, 2, 3]);
  });

  it('weights the average by darts over fixtures with scoring and rounds to two decimals', () => {
    const rows = table(
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
      [played('a', 'b', [3, 1], [score(300, 9), score(100, 7)]), played('c', 'a', [0, 3], [score(40, 30), score(150, 15)])],
    );
    const byId = new Map(rows.map((row) => [row.playerId, row]));
    // 3 * 450 / 24, a nie średnia ze 100 i 30.
    expect(byId.get('a')?.average).toBe(56.25);
    expect(byId.get('b')?.average).toBe(42.86);
    expect(byId.get('c')?.average).toBe(4);
  });

  it('skips fixtures without scoring and gives null when no darts were counted', () => {
    const rows = table(['a', 'b', 'c'], ['a', 'b', 'c'], [played('a', 'b', [3, 1], [score(90, 9), score(0, 0)]), played('a', 'c', [3, 0])]);
    const byId = new Map(rows.map((row) => [row.playerId, row]));
    expect(byId.get('a')?.average).toBe(30);
    expect(byId.get('b')?.average).toBeNull();
    expect(byId.get('c')?.average).toBeNull();
  });
});

describe('computeStandings tie-breaks', () => {
  it('points rank above a better leg difference', () => {
    const rows = table(['a', 'b', 'c'], ['c', 'b', 'a'], [played('a', 'b', [5, 4]), played('a', 'c', [5, 4]), played('b', 'c', [5, 0])]);
    expect(places(rows)).toEqual(['a', 'b', 'c']);
    expect(rows.map((row) => [row.points, row.legDifference])).toEqual([
      [4, 2],
      [2, 4],
      [0, -6],
    ]);
  });

  it('leg difference decides between players level on points', () => {
    const rows = table(['a', 'b', 'c', 'd'], ['b', 'a', 'c', 'd'], [played('a', 'c', [3, 0]), played('b', 'd', [3, 2])]);
    expect(places(rows)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('the direct match beats a higher average and an earlier draw position', () => {
    const high = score(300, 9);
    const low = score(90, 9);
    const rows = table(
      ['a', 'b', 'c', 'd'],
      ['b', 'c', 'd', 'a'],
      [played('a', 'b', [3, 2], [low, high]), played('b', 'c', [3, 2], [high, low]), played('a', 'd', [2, 3], [low, high])],
    );
    expect(places(rows)).toEqual(['d', 'a', 'b', 'c']);
    const [, a, b] = rows;
    expect([a?.points, a?.legDifference]).toEqual([b?.points, b?.legDifference]);
    expect(b?.average).toBeGreaterThan(a?.average ?? 0);
  });

  it('the average decides when the level players have not met yet', () => {
    const rows = table(
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'c', 'd'],
      [played('a', 'c', [3, 1], [score(150, 15), score(90, 15)]), played('b', 'd', [3, 1], [score(180, 15), score(120, 15)])],
    );
    expect(places(rows)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('the average decides a circle of 3:2 wins where the mini table is level', () => {
    const rows = table(
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
      [
        played('a', 'b', [3, 2], [score(200, 30), score(180, 30)]),
        played('b', 'c', [3, 2], [score(180, 30), score(260, 30)]),
        played('c', 'a', [3, 2], [score(260, 30), score(200, 30)]),
      ],
    );
    expect(rows.map((row) => [row.playerId, row.points, row.legDifference, row.average])).toEqual([
      ['c', 2, 0, 26],
      ['a', 2, 0, 20],
      ['b', 2, 0, 18],
    ]);
  });

  it('the drawn order decides when everything else is level', () => {
    const rows = table(['a', 'b', 'c', 'd'], ['d', 'b', 'a', 'c'], [played('a', 'c', [3, 1]), played('b', 'd', [3, 1])]);
    expect(places(rows)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('a null average ranks below any number', () => {
    const rows = table(
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'c', 'd'],
      [played('a', 'c', [3, 1]), played('b', 'd', [3, 1], [score(0, 9), score(0, 9)])],
    );
    expect(rows.map((row) => [row.playerId, row.average])).toEqual([
      ['b', 0],
      ['a', null],
      ['d', 0],
      ['c', null],
    ]);
  });
});

describe('computeStandings three-way ties', () => {
  it('the mini table separates all three level players', () => {
    // a, b i c mają po 2 punkty i -3, a w małej tabeli +3, -1 i -2.
    const rows = table(
      ['a', 'b', 'c', 'd'],
      ['c', 'b', 'a', 'd'],
      [
        played('a', 'b', [9, 4], [score(90, 90), score(90, 90)]),
        played('b', 'c', [9, 5], [score(90, 90), score(900, 90)]),
        played('c', 'a', [9, 7], [score(900, 90), score(90, 90)]),
        played('a', 'd', [3, 9]),
        played('b', 'd', [7, 9]),
        played('c', 'd', [8, 9]),
      ],
    );
    expect(rows.map((row) => [row.playerId, row.points, row.legDifference])).toEqual([
      ['d', 6, 9],
      ['a', 2, -3],
      ['b', 2, -3],
      ['c', 2, -3],
    ]);
  });

  it('the mini table separates one player and the direct match decides the other two', () => {
    // Małe różnice legów: a -2, b +1, c +1. Potem b wygrał z c.
    const rows = table(
      ['a', 'b', 'c', 'd', 'e'],
      ['a', 'c', 'b', 'd', 'e'],
      [
        played('a', 'b', [3, 2], [score(300, 9), score(90, 9)]),
        played('b', 'c', [3, 1], [score(90, 9), score(300, 9)]),
        played('c', 'a', [3, 0], [score(300, 9), score(300, 9)]),
        played('a', 'e', [3, 0]),
        played('a', 'd', [1, 3]),
        played('b', 'e', [3, 2]),
        played('b', 'd', [0, 3]),
        played('c', 'e', [3, 2]),
        played('c', 'd', [0, 3]),
      ],
    );
    expect(rows.map((row) => [row.playerId, row.points, row.legDifference])).toEqual([
      ['d', 6, 8],
      ['b', 4, -1],
      ['c', 4, -1],
      ['a', 4, -1],
      ['e', 0, -5],
    ]);
  });
});
