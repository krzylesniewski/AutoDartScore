import type { Fixture, StandingRow, TournamentPlayer, TournamentView } from '@autoscore/schema';
import { useId } from 'react';
import { crossCell, highlightedFixtureId } from '../game/cross-table';
import { useMediaQuery } from '../game/use-media-query';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { ArrowUpIcon } from './icons';

export interface StandingsTableProps {
  view: TournamentView;
}

const SM_QUERY = '(min-width: 40rem)';

const headClass = 'px-1.5 pb-1 font-display text-[15px] font-bold tracking-[0.1em] text-(--color-text-muted) uppercase';
const numberClass = 'px-1 text-center text-lg tabular-nums';

function legDifference(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function Abbreviation({ short, full }: { short: string; full: string }) {
  return (
    <>
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{full}</span>
    </>
  );
}

function PlaceCell({ row }: { row: StandingRow }) {
  return (
    <td className="px-1.5 font-display text-[22px] font-extrabold tabular-nums">
      <span className={`inline-flex items-center gap-1 ${row.advances ? 'text-(--color-gold)' : 'text-(--color-text-muted)'}`}>
        {row.place}
        {row.advances && (
          <>
            <ArrowUpIcon className="text-base" />
            <span className="sr-only">{pl.advancesToPlayoff}</span>
          </>
        )}
      </span>
    </td>
  );
}

function PlayerHeader({ player, withdrawn }: { player: TournamentPlayer | undefined; withdrawn: boolean }) {
  const name = player?.name ?? '';
  return (
    <th scope="row" className="px-1.5 text-left font-normal">
      <span className="flex min-w-0 items-center gap-2.5">
        {player && <Avatar name={name} avatar={player.avatar} color={player.color} size="medium" />}
        <span className={`min-w-0 truncate font-display text-[22px] leading-tight font-bold ${withdrawn ? 'text-(--color-text-sub)' : ''}`}>
          {name}
        </span>
        {withdrawn && <span className="shrink-0 text-sm text-(--color-text-sub)">{pl.withdrawnTag}</span>}
      </span>
    </th>
  );
}

// Druga linia komórki z wynikiem: skrót na ekranie, pełny tekst dla czytników ekranu.
function resultMark(fixture: Fixture): { short: string; full: string } | null {
  if (fixture.status === 'walkover') {
    return { short: pl.walkoverShort, full: pl.tagWalkover };
  }
  if (fixture.result?.corrected) {
    return { short: pl.correctedShort, full: pl.correctedFull };
  }
  return null;
}

// Komórka ma tło z tokenu i obrys, a wyróżniony mecz dostaje ramkę w kolorze akcentu i słowo pod numerem.
function CrossCellView({
  view,
  rowId,
  columnId,
  highlighted,
}: {
  view: TournamentView;
  rowId: string;
  columnId: string;
  highlighted: string | null;
}) {
  const cell = crossCell(view, rowId, columnId);
  const box = 'mx-auto flex h-[54px] min-w-[52px] flex-col items-center justify-center gap-px rounded-(--radius-chip)';
  if (cell.kind === 'self') {
    return (
      <td aria-hidden="true" className="px-0.5">
        <span className={`${box} bg-(--color-surface-softer)`} />
      </td>
    );
  }
  if (cell.kind === 'none') {
    return <td className="px-0.5" />;
  }
  if (cell.kind === 'result') {
    const [own, other] = cell.legs;
    const won = own > other;
    // Pierwsza cyfra to legi gracza z wiersza (legi mają jedną cyfrę), więc ::first-letter pogrubia stronę zwycięzcy.
    const weight = won ? 'font-semibold first-letter:font-black' : 'font-black first-letter:font-semibold';
    const mark = resultMark(cell.fixture);
    return (
      <td className="px-0.5">
        <span className={`${box} shadow-(--shadow-inset-line) ${won ? 'bg-(--color-surface-soft)' : ''}`}>
          <span
            className={`block font-display text-[22px] leading-none tabular-nums ${weight} ${won ? 'text-(--color-text)' : 'text-(--color-text-sub)'}`}
          >
            {pl.legsCell(own, other)}
          </span>
          {mark && (
            <span className="text-xs leading-none text-(--color-text-sub)">
              <Abbreviation short={mark.short} full={mark.full} />
            </span>
          )}
        </span>
      </td>
    );
  }
  const isHighlighted = cell.fixture.id === highlighted;
  return (
    <td className="px-0.5">
      <span className={`${box} ${isHighlighted ? 'inset-ring-2 inset-ring-(--color-accent)' : 'shadow-(--shadow-inset-line)'}`}>
        <span
          aria-hidden="true"
          className={`flex size-[30px] items-center justify-center rounded-full border-[1.5px] text-[15px] tabular-nums ${isHighlighted ? 'border-(--color-accent) text-(--color-text)' : 'border-(--color-border-strong) text-(--color-text-muted)'}`}
        >
          {cell.fixture.number}
        </span>
        <span className="sr-only">{pl.fixtureNumber(cell.fixture.number)}</span>
        {isHighlighted && (
          <span className="text-xs text-(--color-text-sub)">{cell.fixture.status === 'in_progress' ? pl.fixtureLive : pl.fixtureNow}</span>
        )}
      </span>
    </td>
  );
}

interface TableProps {
  view: TournamentView;
  titleId: string;
  players: ReadonlyMap<string, TournamentPlayer>;
}

function CrossTable({ view, titleId, players }: TableProps) {
  const highlighted = highlightedFixtureId(view);
  return (
    <div role="region" aria-labelledby={titleId} tabIndex={0} className="max-w-full overflow-x-auto rounded-(--radius-card)">
      <table aria-labelledby={titleId} className="w-full border-separate border-spacing-y-1.5">
        <thead>
          <tr>
            <th scope="col" className={`${headClass} w-[34px] text-left`}>
              <Abbreviation short={pl.columnPlace} full={pl.columnPlaceFull} />
            </th>
            <th scope="col" className={`${headClass} text-left`}>
              {pl.columnPlayer}
            </th>
            {view.standings.map((row) => {
              const player = players.get(row.playerId);
              return (
                <th key={row.playerId} scope="col" className="px-0.5 pb-1">
                  {player && (
                    <span className="flex justify-center">
                      <Avatar name={player.name} avatar={player.avatar} color={player.color} size="small" />
                    </span>
                  )}
                  <span className="sr-only">{player?.name ?? ''}</span>
                </th>
              );
            })}
            <ColumnHeads />
          </tr>
        </thead>
        <tbody>
          {view.standings.map((row) => (
            <tr key={row.playerId} className="h-16">
              <PlaceCell row={row} />
              <PlayerHeader player={players.get(row.playerId)} withdrawn={row.withdrawn} />
              {view.standings.map((column) => (
                <CrossCellView
                  key={column.playerId}
                  view={view}
                  rowId={row.playerId}
                  columnId={column.playerId}
                  highlighted={highlighted}
                />
              ))}
              <td className={numberClass}>{row.played}</td>
              <td className={numberClass}>{row.won}</td>
              <td className={numberClass}>{row.lost}</td>
              <td className={numberClass}>{legDifference(row.legDifference)}</td>
              <td className="px-1 text-center font-display text-[28px] font-black tabular-nums">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ColumnHeads() {
  return (
    <>
      <th scope="col" className={`${headClass} w-11`}>
        <Abbreviation short={pl.columnPlayed} full={pl.columnPlayedFull} />
      </th>
      <th scope="col" className={`${headClass} w-11`}>
        <Abbreviation short={pl.columnWon} full={pl.columnWonFull} />
      </th>
      <th scope="col" className={`${headClass} w-11`}>
        <Abbreviation short={pl.columnLost} full={pl.columnLostFull} />
      </th>
      <th scope="col" className={`${headClass} w-14`}>
        <Abbreviation short={pl.columnLegDifference} full={pl.columnLegDifferenceFull} />
      </th>
      <th scope="col" className={`${headClass} w-14 text-(--color-text)`}>
        <Abbreviation short={pl.columnPoints} full={pl.columnPointsFull} />
      </th>
    </>
  );
}

// Na telefonie bez kolumn rywali, żeby tabela zmieściła się bez przewijania.
function ShortTable({ view, titleId, players }: TableProps) {
  return (
    <table aria-labelledby={titleId} className="w-full table-fixed border-separate border-spacing-y-1">
      <thead>
        <tr>
          <th scope="col" className={`${headClass} w-12 text-left`}>
            <Abbreviation short={pl.columnPlace} full={pl.columnPlaceFull} />
          </th>
          <th scope="col" className={`${headClass} text-left`}>
            {pl.columnPlayer}
          </th>
          <th scope="col" className={`${headClass} w-14`}>
            <Abbreviation short={pl.columnWonLost} full={pl.columnWonLostFull} />
          </th>
          <th scope="col" className={`${headClass} w-12`}>
            <Abbreviation short={pl.columnLegDifference} full={pl.columnLegDifferenceFull} />
          </th>
          <th scope="col" className={`${headClass} w-12 text-(--color-text)`}>
            <Abbreviation short={pl.columnPoints} full={pl.columnPointsFull} />
          </th>
        </tr>
      </thead>
      <tbody>
        {view.standings.map((row) => (
          <tr key={row.playerId} className="h-14">
            <PlaceCell row={row} />
            <PlayerHeader player={players.get(row.playerId)} withdrawn={row.withdrawn} />
            <td className={numberClass}>{pl.wonLost(row.won, row.lost)}</td>
            <td className={numberClass}>{legDifference(row.legDifference)}</td>
            <td className="px-1 text-center font-display text-[24px] font-black tabular-nums">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Legend({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-(--color-text-muted)">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function StandingsTable({ view }: StandingsTableProps) {
  const titleId = useId();
  const wide = useMediaQuery(SM_QUERY);
  const isGroup = view.format === 'group_playoff';
  const players = new Map(view.players.map((player) => [player.id, player]));
  const meta = [pl.tableLegsMeta(view.config.legsToWin.group)];
  if (isGroup && view.config.advance !== undefined) {
    meta.push(pl.tableAdvanceMeta(view.config.advance));
  }
  const legend: string[] = [pl.legendResult, pl.legendNumber, pl.legendTiebreak];
  if (isGroup) {
    legend.push(pl.legendAdvance);
  }
  const groupFixtures = view.fixtures.filter((fixture) => fixture.phase === 'group');
  if (groupFixtures.some((fixture) => fixture.status === 'walkover')) {
    legend.push(pl.legendWalkover);
  }
  if (groupFixtures.some((fixture) => fixture.status === 'finished' && fixture.result?.corrected)) {
    legend.push(pl.legendCorrected);
  }
  // Bez nazwy na sekcji: regionem z tytułem jest tylko przewijana ramka tabeli, a całość leży już w panelu zakładki.
  return (
    <section className="sc-panel min-w-0 gap-3 px-3 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <h2 id={titleId} className="font-display text-[26px] leading-tight font-extrabold">
          {isGroup ? pl.phaseGroup : pl.leagueTable}
        </h2>
        <p className="text-[15px] text-(--color-text-muted)">{meta.join(' · ')}</p>
      </div>
      {wide ? (
        <CrossTable view={view} titleId={titleId} players={players} />
      ) : (
        <ShortTable view={view} titleId={titleId} players={players} />
      )}
      <Legend items={legend} />
    </section>
  );
}
