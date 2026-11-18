import type { MatchSummary, PlayerStatLine, PublicMatchPlayer } from '@autoscore/schema';
import { useId } from 'react';
import { betterSide } from '../game/better-side';
import { NO_VALUE, formatAverage, formatBestLeg, formatDoubles, formatNumber } from '../game/format-stat';
import { pl } from '../i18n/pl';
import { Notice } from './Notice';

type ComparedPlayer = Pick<PublicMatchPlayer, 'id' | 'name'>;

export interface MatchComparisonTableProps {
  players: readonly [ComparedPlayer, ComparedPlayer];
  summary: MatchSummary | null; // null do pierwszej odpowiedzi
  error: boolean;
}

interface StatRow {
  readonly label: string;
  readonly lowerIsBetter: boolean;
  value(line: PlayerStatLine): number | null;
  text(line: PlayerStatLine): string;
}

const ROWS: readonly StatRow[] = [
  { label: pl.statLegsWon, lowerIsBetter: false, value: (line) => line.legsWon, text: (line) => String(line.legsWon) },
  { label: pl.statAverage, lowerIsBetter: false, value: (line) => line.average, text: (line) => formatAverage(line.average) },
  {
    label: pl.statFirst9,
    lowerIsBetter: false,
    value: (line) => line.first9Average,
    text: (line) => formatAverage(line.first9Average),
  },
  { label: pl.stat100, lowerIsBetter: false, value: (line) => line.scores100, text: (line) => String(line.scores100) },
  { label: pl.stat140, lowerIsBetter: false, value: (line) => line.scores140, text: (line) => String(line.scores140) },
  { label: pl.stat180, lowerIsBetter: false, value: (line) => line.scores180, text: (line) => String(line.scores180) },
  {
    label: pl.statHighestCheckout,
    lowerIsBetter: false,
    value: (line) => line.highestCheckout,
    text: (line) => formatNumber(line.highestCheckout),
  },
  { label: pl.statBestLeg, lowerIsBetter: true, value: (line) => line.bestLegDarts, text: (line) => formatBestLeg(line.bestLegDarts) },
  { label: pl.statDoubles, lowerIsBetter: false, value: (line) => line.doublesPercent, text: (line) => formatDoubles(line) },
];

function ValueCell({ text, better, align }: { text: string; better: boolean; align: 'left' | 'right' }) {
  const tone = better ? 'text-2xl font-black text-(--color-text)' : 'text-xl font-semibold text-(--color-text-sub)';
  return (
    <td className={`px-2 py-2 font-display break-words tabular-nums ${align === 'left' ? 'text-left' : 'text-right'} ${tone}`}>
      {text}
      {better && <span className="sr-only"> {pl.betterValue}</span>}
    </td>
  );
}

// Statystyki zawsze z rozegranych rzutek, więc po poprawce wyniku pokazują mecz tak, jak go rozegrano.
export function MatchComparisonTable({ players, summary, error }: MatchComparisonTableProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="sc-panel min-w-0 gap-3 px-3 py-4 sm:px-5.5">
      <h2 id={titleId} className="font-display text-[26px] leading-tight font-extrabold">
        {pl.matchStats}
      </h2>
      {error && <Notice text={pl.summaryFailed} appearance="soft" />}
      {!summary && !error && <p className="text-(--color-text-muted)">{pl.loading}</p>}
      {summary && <ComparisonTable players={players} summary={summary} titleId={titleId} />}
    </section>
  );
}

function ComparisonTable({
  players,
  summary,
  titleId,
}: {
  players: MatchComparisonTableProps['players'];
  summary: MatchSummary;
  titleId: string;
}) {
  const lines = players.map((player) => summary.players.find((line) => line.playerId === player.id));
  const [first, second] = lines;
  const headClass = 'px-2 pb-2 font-display text-xl font-bold';
  return (
    <table aria-labelledby={titleId} className="w-full table-fixed border-collapse">
      <thead>
        <tr>
          <th scope="col" className={`${headClass} truncate text-left`}>
            {players[0].name}
          </th>
          <td className="w-[38%]" />
          <th scope="col" className={`${headClass} truncate text-right`}>
            {players[1].name}
          </th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => {
          const better = betterSide(first ? row.value(first) : null, second ? row.value(second) : null, row.lowerIsBetter);
          return (
            <tr key={row.label} className="border-t border-(--color-border-subtle)">
              <ValueCell text={first ? row.text(first) : NO_VALUE} better={better === 0} align="left" />
              <th scope="row" className="px-1 text-center text-sm font-normal text-(--color-text-muted)">
                {row.label}
              </th>
              <ValueCell text={second ? row.text(second) : NO_VALUE} better={better === 1} align="right" />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
