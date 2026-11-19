import type { TournamentStatsPlayer } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { fixture, tournamentStatsPlayer, tournamentView } from '../test/snapshots';
import { DEFAULT_SORT, bestValues, isBest, nextSort, recordWhere, sortStatsRows, type StatsSort } from './tournament-stats-table';

function ids(rows: readonly TournamentStatsPlayer[]): string[] {
  return rows.map((row) => row.playerId);
}

const rows: TournamentStatsPlayer[] = [
  tournamentStatsPlayer('p1', { won: 1, lost: 1, legsFor: 4, legsAgainst: 4, average: 40, bestLegDarts: 21, scores180: 0 }),
  tournamentStatsPlayer('p2', { won: 2, lost: 0, legsFor: 6, legsAgainst: 2, average: null, bestLegDarts: null }),
  tournamentStatsPlayer('p3', { won: 0, lost: 2, legsFor: 2, legsAgainst: 6, average: 45.5, bestLegDarts: 18 }),
  tournamentStatsPlayer('p4', { won: 1, lost: 1, legsFor: 4, legsAgainst: 4, average: 40, bestLegDarts: 24 }),
];

describe('nextSort', () => {
  it('starts with the average, descending', () => {
    expect(DEFAULT_SORT).toEqual({ column: 'average', direction: 'descending' });
  });

  it('flips the direction of the same column', () => {
    expect(nextSort(DEFAULT_SORT, 'average')).toEqual({ column: 'average', direction: 'ascending' });
    expect(nextSort({ column: 'average', direction: 'ascending' }, 'average')).toEqual(DEFAULT_SORT);
  });

  it('starts a new column in its natural direction', () => {
    expect(nextSort(DEFAULT_SORT, 'place')).toEqual({ column: 'place', direction: 'ascending' });
    expect(nextSort(DEFAULT_SORT, 'bestLegDarts')).toEqual({ column: 'bestLegDarts', direction: 'ascending' });
    expect(nextSort({ column: 'place', direction: 'descending' }, 'scores180')).toEqual({ column: 'scores180', direction: 'descending' });
    expect(nextSort({ column: 'place', direction: 'ascending' }, 'matches')).toEqual({ column: 'matches', direction: 'descending' });
  });
});

describe('sortStatsRows', () => {
  it('sorts by the default column and keeps the input untouched', () => {
    const input = [...rows];
    expect(ids(sortStatsRows(input, [], DEFAULT_SORT))).toEqual(['p3', 'p1', 'p4', 'p2']);
    expect(ids(input)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('puts nulls last in both directions and keeps ties in registration order', () => {
    expect(ids(sortStatsRows(rows, [], { column: 'average', direction: 'ascending' }))).toEqual(['p1', 'p4', 'p3', 'p2']);
    expect(ids(sortStatsRows(rows, [], { column: 'bestLegDarts', direction: 'ascending' }))).toEqual(['p3', 'p1', 'p4', 'p2']);
    expect(ids(sortStatsRows(rows, [], { column: 'bestLegDarts', direction: 'descending' }))).toEqual(['p4', 'p1', 'p3', 'p2']);
  });

  it('sorts matches by wins and legs by legs won', () => {
    expect(ids(sortStatsRows(rows, [], { column: 'matches', direction: 'descending' }))).toEqual(['p2', 'p1', 'p4', 'p3']);
    expect(ids(sortStatsRows(rows, [], { column: 'legs', direction: 'ascending' }))).toEqual(['p3', 'p1', 'p4', 'p2']);
    expect(ids(sortStatsRows(rows, [], { column: 'legDifference', direction: 'descending' }))).toEqual(['p2', 'p1', 'p4', 'p3']);
  });

  it('sorts by the known places and puts players without a place last', () => {
    const placements = [
      { playerId: 'p4', place: 1 },
      { playerId: 'p2', place: 2 },
    ];
    const ascending: StatsSort = { column: 'place', direction: 'ascending' };
    expect(ids(sortStatsRows(rows, placements, ascending))).toEqual(['p4', 'p2', 'p1', 'p3']);
    expect(ids(sortStatsRows(rows, placements, nextSort(ascending, 'place')))).toEqual(['p2', 'p4', 'p1', 'p3']);
  });

  it('keeps registration order when nobody has a value', () => {
    const empty = ['p3', 'p1', 'p2'].map((id) => tournamentStatsPlayer(id));
    expect(ids(sortStatsRows(empty, [], DEFAULT_SORT))).toEqual(['p3', 'p1', 'p2']);
    expect(ids(sortStatsRows(empty, [], { column: 'place', direction: 'ascending' }))).toEqual(['p3', 'p1', 'p2']);
  });
});

describe('bestValues', () => {
  it('takes the max of the score columns and the min of the best leg', () => {
    const best = bestValues([
      tournamentStatsPlayer('p1', { average: 40, first9Average: 50, scores100: 3, scores140: 1, highestCheckout: 64, bestLegDarts: 21 }),
      tournamentStatsPlayer('p2', { average: 45.5, first9Average: 48, scores100: 3, scores140: 0, highestCheckout: 40, bestLegDarts: 18 }),
    ]);
    expect(best).toEqual({
      average: 45.5,
      first9Average: 50,
      scores100: 3,
      scores140: 1,
      scores180: null,
      highestCheckout: 64,
      bestLegDarts: 18,
    });
  });

  it('marks every tied row and nothing in a column of zeros', () => {
    const tied = [tournamentStatsPlayer('p1', { scores100: 3 }), tournamentStatsPlayer('p2', { scores100: 3 })];
    const best = bestValues(tied);
    expect(tied.map((row) => isBest(best, 'scores100', row.scores100))).toEqual([true, true]);
    expect(tied.map((row) => isBest(best, 'scores180', row.scores180))).toEqual([false, false]);
  });

  it('gives null when no row has a value', () => {
    const best = bestValues([tournamentStatsPlayer('p1')]);
    expect(best.average).toBeNull();
    expect(best.highestCheckout).toBeNull();
    expect(best.bestLegDarts).toBeNull();
    expect(isBest(best, 'average', null)).toBe(false);
    expect(bestValues([]).average).toBeNull();
  });
});

describe('recordWhere', () => {
  const view = tournamentView({
    fixtures: [
      fixture({
        id: 'g-2',
        number: 2,
        status: 'finished',
        matchId: 'm2',
        result: { legs: [3, 1], winnerId: 'p1', corrected: false },
      }),
    ],
  });

  it('names the fixture and the opponent for the match average', () => {
    expect(recordWhere(view, { playerId: 'p1', fixtureId: 'g-2', matchId: 'm2', value: 52.4 })).toBe('Liga, mecz 2 · rywal: Bartek');
    expect(recordWhere(view, { playerId: 'p2', fixtureId: 'g-2', matchId: 'm2', value: 41 })).toBe('Liga, mecz 2 · rywal: Anna');
  });

  it('names the fixture and the leg for a leg record', () => {
    expect(recordWhere(view, { playerId: 'p1', fixtureId: 'g-2', matchId: 'm2', value: 64, legIndex: 1 })).toBe('Liga, mecz 2 · leg 2');
  });

  it('uses the play-off label of the fixture', () => {
    const final = fixture({ id: 'p-f', number: 5, phase: 'playoff', bracketRound: 'final' });
    const cup = tournamentView({ format: 'cup', fixtures: [final] });
    expect(recordWhere(cup, { playerId: 'p1', fixtureId: 'p-f', matchId: 'm5', value: 140, legIndex: 4 })).toBe('Finał · leg 5');
  });

  it('gives an empty text for a fixture that is not in the view', () => {
    expect(recordWhere(view, { playerId: 'p1', fixtureId: 'g-9', matchId: 'm9', value: 52 })).toBe('');
    expect(recordWhere(view, { playerId: 'p1', fixtureId: 'g-9', matchId: 'm9', value: 64, legIndex: 0 })).toBe('');
  });
});
