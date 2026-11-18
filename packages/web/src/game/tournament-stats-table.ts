import type {
  Fixture,
  TournamentLegRecord,
  TournamentPlacement,
  TournamentRecord,
  TournamentStatsPlayer,
  TournamentView,
} from '@autoscore/schema';
import { pl } from '../i18n/pl';
import { fixtureLabel } from './fixture-label';

export type StatsColumn =
  | 'place'
  | 'matches'
  | 'legs'
  | 'legDifference'
  | 'average'
  | 'first9Average'
  | 'scores100'
  | 'scores140'
  | 'scores180'
  | 'highestCheckout'
  | 'bestLegDarts';

export type SortDirection = 'ascending' | 'descending';

export interface StatsSort {
  readonly column: StatsColumn;
  readonly direction: SortDirection;
}

export const DEFAULT_SORT: StatsSort = { column: 'average', direction: 'descending' };

// Przy miejscu i najlepszym legu lepsza jest mniejsza liczba.
const ASCENDING_FIRST: ReadonlySet<StatsColumn> = new Set(['place', 'bestLegDarts']);

export function nextSort(current: StatsSort, column: StatsColumn): StatsSort {
  if (current.column === column) {
    return { column, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
  }
  return { column, direction: ASCENDING_FIRST.has(column) ? 'ascending' : 'descending' };
}

function sortKey(row: TournamentStatsPlayer, column: StatsColumn, places: ReadonlyMap<string, number>): number | null {
  switch (column) {
    case 'place':
      return places.get(row.playerId) ?? null;
    case 'matches':
      return row.won;
    case 'legs':
      return row.legsFor;
    default:
      return row[column];
  }
}

// Brak wartości i gracz bez miejsca zawsze na końcu. Remisy zostają w kolejności zgłoszenia, bo sort jest stabilny.
export function sortStatsRows(
  rows: readonly TournamentStatsPlayer[],
  placements: readonly TournamentPlacement[],
  sort: StatsSort,
): TournamentStatsPlayer[] {
  const places = new Map(placements.map((placement) => [placement.playerId, placement.place]));
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return rows
    .map((row) => ({ row, key: sortKey(row, sort.column, places) }))
    .sort((first, second) => {
      if (first.key === null || second.key === null) {
        return (first.key === null ? 1 : 0) - (second.key === null ? 1 : 0);
      }
      return sign * (first.key - second.key);
    })
    .map((entry) => entry.row);
}

export type BestColumn = 'average' | 'first9Average' | 'scores100' | 'scores140' | 'scores180' | 'highestCheckout' | 'bestLegDarts';

export type BestValues = Readonly<Record<BestColumn, number | null>>;

const MAX_COLUMNS = ['average', 'first9Average', 'scores100', 'scores140', 'scores180', 'highestCheckout'] as const;
const COUNT_COLUMNS: ReadonlySet<BestColumn> = new Set(['scores100', 'scores140', 'scores180']);

function present(values: readonly (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null);
}

// Najlepsza wartość kolumny. Zero w kolumnie licznika nie jest wynikiem do wyróżnienia.
export function bestValues(rows: readonly TournamentStatsPlayer[]): BestValues {
  const best: Record<BestColumn, number | null> = {
    average: null,
    first9Average: null,
    scores100: null,
    scores140: null,
    scores180: null,
    highestCheckout: null,
    bestLegDarts: null,
  };
  for (const column of MAX_COLUMNS) {
    const values = present(rows.map((row) => row[column]));
    const max = values.length === 0 ? null : Math.max(...values);
    best[column] = max === 0 && COUNT_COLUMNS.has(column) ? null : max;
  }
  const legs = present(rows.map((row) => row.bestLegDarts));
  best.bestLegDarts = legs.length === 0 ? null : Math.min(...legs);
  return best;
}

export function isBest(best: BestValues, column: BestColumn, value: number | null): boolean {
  return value !== null && best[column] === value;
}

function opponentName(view: TournamentView, fixture: Fixture, playerId: string): string | null {
  const other = fixture.slots.find((slot) => slot.kind === 'player' && slot.playerId !== playerId);
  if (other?.kind !== 'player') {
    return null;
  }
  return view.players.find((player) => player.id === other.playerId)?.name ?? null;
}

// Gdzie padł rekord: etykieta meczu i rywal (średnia meczu) albo numer lega (rekordy z lega).
export function recordWhere(view: TournamentView, record: TournamentRecord | TournamentLegRecord): string {
  const fixture = view.fixtures.find((entry) => entry.id === record.fixtureId);
  if (!fixture) {
    return '';
  }
  const label = fixtureLabel(view.format, fixture);
  if ('legIndex' in record) {
    return `${label} · ${pl.recordLeg(record.legIndex + 1)}`;
  }
  const opponent = opponentName(view, fixture, record.playerId);
  return opponent === null ? label : `${label} · ${pl.recordOpponent(opponent)}`;
}
