import { POINTS_PER_WIN, type StandingRow } from '@autoscore/schema';
import type { FixtureScoring } from './tournament.js';

export interface FinishedFixture {
  readonly playerIds: readonly [string, string]; // w kolejności slotów
  readonly legs: readonly [number, number];
  readonly scoring: readonly [FixtureScoring, FixtureScoring] | null;
}

interface MiniRecord {
  readonly points: number;
  readonly legDifference: number;
}

type Row = Omit<StandingRow, 'place'>;

// Ta sama formuła co threeDartAverage na serwerze, żeby tabela pokazywała tę samą średnią co statystyki.
export function threeDartAverage(points: number, darts: number): number | null {
  return darts === 0 ? null : Math.round(((3 * points) / darts) * 100) / 100;
}

function record(playerId: string, fixtures: readonly FinishedFixture[]): Row {
  let won = 0;
  let legsFor = 0;
  let legsAgainst = 0;
  let points = 0;
  let darts = 0;
  let played = 0;
  for (const fixture of fixtures) {
    const side = fixture.playerIds.indexOf(playerId);
    if (side === -1) {
      continue;
    }
    const own = fixture.legs[side === 0 ? 0 : 1];
    const other = fixture.legs[side === 0 ? 1 : 0];
    played += 1;
    won += own > other ? 1 : 0;
    legsFor += own;
    legsAgainst += other;
    const scoring = fixture.scoring?.[side === 0 ? 0 : 1];
    if (scoring) {
      points += scoring.points;
      darts += scoring.darts;
    }
  }
  return {
    playerId,
    played,
    won,
    lost: played - won,
    legsFor,
    legsAgainst,
    legDifference: legsFor - legsAgainst,
    points: won * POINTS_PER_WIN,
    average: threeDartAverage(points, darts),
    withdrawn: false,
    advances: false,
  };
}

function compareRecords(a: MiniRecord, b: MiniRecord): number {
  return b.points - a.points || b.legDifference - a.legDifference;
}

// Kolejne grupy elementów równych według compare. Wejście musi być już posortowane tym samym compare.
function levelGroups<T>(items: readonly T[], compare: (a: T, b: T) => number): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const group = groups.at(-1);
    if (group && compare(group[0] as T, item) === 0) {
      group.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups;
}

function miniTable(group: readonly Row[], fixtures: readonly FinishedFixture[]): Map<string, MiniRecord> {
  const ids = group.map((row) => row.playerId);
  const inside = fixtures.filter((fixture) => fixture.playerIds.every((id) => ids.includes(id)));
  return new Map(
    ids.map((id) => {
      const row = record(id, inside);
      return [id, { points: row.points, legDifference: row.legDifference }];
    }),
  );
}

// Mała tabela grupy, a gdy niczego nie rozdziela, średnia (null niżej niż liczba) i pozycja w losowaniu.
function resolveLevel(group: readonly Row[], fixtures: readonly FinishedFixture[], drawPosition: (id: string) => number): Row[] {
  if (group.length < 2) {
    return [...group];
  }
  const mini = miniTable(group, fixtures);
  const byMini = (a: Row, b: Row) => compareRecords(mini.get(a.playerId) as MiniRecord, mini.get(b.playerId) as MiniRecord);
  const sorted = [...group].sort(byMini);
  const subgroups = levelGroups(sorted, byMini);
  if (subgroups.length > 1) {
    return subgroups.flatMap((subgroup) => resolveLevel(subgroup, fixtures, drawPosition));
  }
  return sorted.sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || drawPosition(a.playerId) - drawPosition(b.playerId));
}

// Tabela z rozegranych meczów każdy z każdym. Kolejność: punkty, różnica legów, mecze bezpośrednie, średnia, losowanie.
export function computeStandings(
  playerIds: readonly string[],
  order: readonly string[],
  fixtures: readonly FinishedFixture[],
): StandingRow[] {
  const drawPosition = (id: string) => order.indexOf(id);
  const rows = playerIds.map((id) => record(id, fixtures)).sort(compareRecords);
  return levelGroups(rows, compareRecords)
    .flatMap((group) => resolveLevel(group, fixtures, drawPosition))
    .map((row, index) => ({ ...row, place: index + 1 }));
}
