import type {
  PublicTournamentPlayer,
  PublicTournamentView,
  TournamentLegRecord,
  TournamentRecord,
  TournamentStats,
  TournamentStatsPlayer,
} from '@autoscore/schema';
import { useId, useState, type ReactNode } from 'react';
import { NO_VALUE, formatAverage, formatLegDifference, formatNumber } from '../game/format-stat';
import { placeColor } from '../game/place-color';
import { placementRows } from '../game/placement-rows';
import {
  DEFAULT_SORT,
  bestValues,
  isBest,
  nextSort,
  recordWhere,
  sortStatsRows,
  type BestColumn,
  type BestValues,
  type StatsColumn,
  type StatsSort,
} from '../game/tournament-stats-table';
import { pl } from '../i18n/pl';
import { Abbreviation } from './Abbreviation';
import { Avatar } from './Avatar';
import { StarIcon } from './icons';
import { useMatchHref } from './match-href-context';

export interface TournamentStatsPanelProps {
  view: PublicTournamentView;
  stats: TournamentStats;
}

type Players = ReadonlyMap<string, PublicTournamentPlayer>;

const labelClass = 'font-display text-(length:--text-label) font-bold tracking-[0.18em] text-(--color-text-muted) uppercase';
const titleClass = 'font-display text-[26px] leading-tight font-extrabold';

function Podium({ view, players }: { view: PublicTournamentView; players: Players }) {
  const titleId = useId();
  const rows = placementRows(view).filter((row) => row.place <= 3 && row.playerId !== null);
  return (
    <section aria-labelledby={titleId} className="sc-panel gap-1.5 px-4 py-4 sm:px-5.5">
      <h2 id={titleId} className={titleClass}>
        {pl.tournamentPodium}
      </h2>
      <ol className="flex flex-col">
        {rows.map((row) => {
          const player = players.get(row.playerId ?? '');
          return (
            <li
              key={`${row.place}-${row.playerId}`}
              className="flex min-h-15.5 items-center gap-3.5 border-t border-(--color-border-subtle) py-1.5"
            >
              <span className={`w-7 shrink-0 font-display text-[30px] font-black tabular-nums ${placeColor(row.place)}`}>
                {pl.placeNumber(row.place)}
              </span>
              {player && <Avatar name={player.name} avatar={player.avatar} color={player.color} size="medium" />}
              <span className="min-w-0 flex-1 truncate font-display text-2xl font-extrabold">{player?.name ?? ''}</span>
              {row.text && <span className="shrink-0 text-sm text-(--color-text-muted)">{row.text}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface RecordEntry {
  readonly label: string;
  readonly record: TournamentRecord | TournamentLegRecord | null;
  format(value: number): string;
}

function RecordItem({ view, players, entry }: { view: PublicTournamentView; players: Players; entry: RecordEntry }) {
  const matchHref = useMatchHref();
  const box = 'flex min-h-11 flex-col gap-0.5 border-t border-(--color-border-subtle) py-2.5';
  const label = <span className="text-sm text-(--color-text-muted)">{entry.label}</span>;
  const { record } = entry;
  if (record === null) {
    return (
      <li className={box}>
        {label}
        <span className="font-display text-[32px] leading-none font-black text-(--color-text-muted)">{NO_VALUE}</span>
      </li>
    );
  }
  const where = recordWhere(view, record);
  return (
    <li>
      <a href={matchHref(view.id, record.matchId)} className={`${box} text-(--color-text) no-underline`}>
        {label}
        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="font-display text-[32px] leading-none font-black tabular-nums">{entry.format(record.value)}</span>
          <span className="font-display text-xl font-bold">{players.get(record.playerId)?.name ?? ''}</span>
          {where && <span className="text-[13px] text-(--color-text-muted)">{where}</span>}
        </span>
      </a>
    </li>
  );
}

function Records({ view, stats, players }: { view: PublicTournamentView; stats: TournamentStats; players: Players }) {
  const titleId = useId();
  const { records } = stats;
  const entries: RecordEntry[] = [
    { label: pl.recordHighestMatchAverage, record: records.highestMatchAverage, format: formatAverage },
    { label: pl.recordHighestCheckout, record: records.highestCheckout, format: String },
    { label: pl.recordShortestLeg, record: records.shortestLeg, format: pl.darts },
    { label: pl.recordHighestTurn, record: records.highestTurn, format: String },
  ];
  return (
    <section aria-labelledby={titleId} className="sc-panel sc-panel--flat gap-1 px-4 py-4 sm:px-5.5">
      <h2 id={titleId} className={`${labelClass} mb-1.5`}>
        {pl.tournamentRecords}
      </h2>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <RecordItem key={entry.label} view={view} players={players} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

interface Column {
  readonly id: StatsColumn;
  readonly head: ReactNode;
  readonly best?: BestColumn;
  text(row: TournamentStatsPlayer): string;
}

const COLUMNS: readonly Column[] = [
  { id: 'matches', head: pl.columnPlayedFull, text: (row) => pl.wonLost(row.won, row.lost) },
  { id: 'legs', head: pl.columnLegs, text: (row) => pl.legsCell(row.legsFor, row.legsAgainst) },
  {
    id: 'legDifference',
    head: <Abbreviation short={pl.columnLegDifference} full={pl.columnLegDifferenceFull} />,
    text: (row) => formatLegDifference(row.legDifference),
  },
  { id: 'average', head: pl.average, best: 'average', text: (row) => formatAverage(row.average) },
  { id: 'first9Average', head: pl.statFirst9, best: 'first9Average', text: (row) => formatAverage(row.first9Average) },
  { id: 'scores100', head: pl.stat100, best: 'scores100', text: (row) => formatNumber(row.scores100) },
  { id: 'scores140', head: pl.stat140, best: 'scores140', text: (row) => formatNumber(row.scores140) },
  { id: 'scores180', head: pl.stat180, best: 'scores180', text: (row) => formatNumber(row.scores180) },
  {
    id: 'highestCheckout',
    head: <Abbreviation short={pl.columnHighestCheckout} full={pl.columnHighestCheckoutFull} />,
    best: 'highestCheckout',
    text: (row) => formatNumber(row.highestCheckout),
  },
  {
    id: 'bestLegDarts',
    head: <Abbreviation short={pl.columnBestLeg} full={pl.columnBestLegFull} />,
    best: 'bestLegDarts',
    text: (row) => formatNumber(row.bestLegDarts),
  },
];

const headClass = 'px-1 pb-1 font-display text-[15px] font-bold tracking-[0.08em] whitespace-nowrap text-(--color-text-muted) uppercase';

function SortHeader({
  head,
  column,
  sort,
  onSort,
}: {
  head: ReactNode;
  column: StatsColumn;
  sort: StatsSort;
  onSort(column: StatsColumn): void;
}) {
  const sorted = sort.column === column;
  const align = column === 'place' ? 'justify-start' : 'justify-end';
  return (
    <th scope="col" aria-sort={sorted ? sort.direction : undefined} className={headClass}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex min-h-11 w-full items-center gap-1 px-1 uppercase ${align} ${sorted ? 'text-(--color-text)' : ''}`}
      >
        <span>{head}</span>
        {sorted && <span aria-hidden="true">{sort.direction === 'ascending' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}

function ValueCell({ column, row, best }: { column: Column; row: TournamentStatsPlayer; best: BestValues }) {
  const marked = column.best !== undefined && isBest(best, column.best, row[column.best]);
  const size = column.id === 'average' ? 'text-[26px]' : 'text-[22px]';
  let tone = column.id === 'average' ? 'font-extrabold text-(--color-text)' : 'font-semibold text-(--color-text-sub)';
  if (marked) {
    tone = 'font-extrabold text-(--color-gold)';
  }
  return (
    <td className={`px-2 text-right font-display whitespace-nowrap tabular-nums ${size} ${tone}`}>
      <span className="inline-flex items-center gap-1">
        {marked && <StarIcon className="text-sm" />}
        {column.text(row)}
      </span>
      {marked && <span className="sr-only"> {pl.bestInColumn}</span>}
    </td>
  );
}

function PlayersTable({ view, stats, players }: { view: PublicTournamentView; stats: TournamentStats; players: Players }) {
  const titleId = useId();
  const [sort, setSort] = useState<StatsSort>(DEFAULT_SORT);
  const places = new Map(view.placements.map((placement) => [placement.playerId, placement.place]));
  const rows = sortStatsRows(stats.players, view.placements, sort);
  const best = bestValues(stats.players);
  const onSort = (column: StatsColumn) => setSort((current) => nextSort(current, column));
  // Bez nazwy na sekcji: regionem z tytułem jest tylko przewijana ramka tabeli, jak w tabeli grupy.
  return (
    <section className="sc-panel min-w-0 gap-2.5 px-3 py-4 sm:px-5.5">
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <h2 id={titleId} className={titleClass}>
          {pl.tournamentPlayersTitle}
        </h2>
        <p className="text-[15px] text-(--color-text-muted)">{pl.tournamentStatsMeta}</p>
      </div>
      <div role="region" aria-labelledby={titleId} tabIndex={0} className="max-w-full overflow-x-auto rounded-(--radius-card)">
        <table aria-labelledby={titleId} className="w-full border-collapse">
          <thead>
            <tr>
              <SortHeader
                head={<Abbreviation short={pl.columnPlace} full={pl.columnPlaceFull} />}
                column="place"
                sort={sort}
                onSort={onSort}
              />
              <th scope="col" className={`${headClass} text-left`}>
                {pl.columnPlayer}
              </th>
              {COLUMNS.map((column) => (
                <SortHeader key={column.id} head={column.head} column={column.id} sort={sort} onSort={onSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const player = players.get(row.playerId);
              const place = places.get(row.playerId);
              return (
                <tr key={row.playerId} className="h-16.5 border-t border-(--color-border-subtle)">
                  <td
                    className={`px-2 font-display text-2xl font-black tabular-nums ${place === undefined ? 'text-(--color-text-muted)' : placeColor(place)}`}
                  >
                    {place === undefined ? NO_VALUE : place}
                  </td>
                  <th scope="row" className="px-1.5 text-left font-normal">
                    <span className="flex items-center gap-2.5">
                      {player && <Avatar name={player.name} avatar={player.avatar} color={player.color} size="small" />}
                      <span className="font-display text-[22px] font-bold whitespace-nowrap">{player?.name ?? ''}</span>
                    </span>
                  </th>
                  {COLUMNS.map((column) => (
                    <ValueCell key={column.id} column={column} row={row} best={best} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Od lg podium i rekordy w kolumnie 380 px po lewej, tabela obok. Niżej wszystko w jednej kolumnie.
export function TournamentStatsPanel({ view, stats }: TournamentStatsPanelProps) {
  const players: Players = new Map(view.players.map((player) => [player.id, player]));
  return (
    <div className="grid grid-cols-1 content-start gap-(--space-6) lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-(--space-page)">
      <aside className="flex min-w-0 flex-col gap-(--space-6)">
        {view.status === 'finished' && <Podium view={view} players={players} />}
        <Records view={view} stats={stats} players={players} />
      </aside>
      <PlayersTable view={view} stats={stats} players={players} />
    </div>
  );
}
