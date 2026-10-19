import type { MatchSnapshot, MatchSummary, MatchSummaryPlayer } from '@autoscore/schema';
import { formatAverage, formatDoubles, formatNumber, NO_VALUE } from '../game/format-stat';
import { pl } from '../i18n/pl';

const label = 'font-display text-(length:--text-label) leading-5 font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

const COLUMNS: readonly { header: string; value: (line: MatchSummaryPlayer) => string }[] = [
  { header: pl.average, value: (line) => formatAverage(line.average) },
  { header: pl.statFirst9, value: (line) => formatAverage(line.first9Average) },
  { header: pl.statHighestCheckoutShort, value: (line) => formatNumber(line.highestCheckout) },
  { header: pl.statDoubles, value: formatDoubles },
  { header: pl.legs, value: (line) => String(line.legsWon) },
];

export interface MatchStatsPanelProps {
  state: MatchSnapshot;
  summary: MatchSummary | null;
}

// Mieści się w około 120 px pod paskiem wyników 1v1 przy 1440×810, więc jeden wiersz na gracza i jedna kolumna na statystykę.
// W wąskiej kolumnie (telefon, tablet) czcionka maleje, a gdyby to nie wystarczyło, przewija się tylko tabela, nie strona.
export function MatchStatsPanel({ state, summary }: MatchStatsPanelProps) {
  if (state.type !== 'match') {
    return null;
  }
  const name = (playerId: string) => state.players.find((player) => player.id === playerId)?.name ?? '';
  const lastLeg = summary?.legs.at(-1);

  return (
    <section className="@container flex flex-col rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) px-4 py-1.5">
      <div className="overflow-x-auto">
        <table className="w-full font-display">
          <caption className="sr-only">{pl.matchStats}</caption>
          <thead>
            <tr>
              <td />
              {COLUMNS.map((column) => (
                <th key={column.header} scope="col" className={`${label} px-1 text-right whitespace-nowrap @max-md:text-xs @max-md:tracking-normal`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.players.map((player) => {
              const line = summary?.players.find((candidate) => candidate.playerId === player.id);
              return (
                <tr key={player.id} className="text-lg leading-7 @max-md:text-base">
                  <th scope="row" className="w-full max-w-0 truncate text-left font-semibold">
                    {player.name}
                  </th>
                  {COLUMNS.map((column) => (
                    <td key={column.header} className="px-1 text-right whitespace-nowrap tabular-nums">
                      {line ? column.value(line) : NO_VALUE}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lastLeg && (
        <p className="truncate leading-6 text-(--color-text-muted)">{pl.lastLeg(pl.legResult(name(lastLeg.winnerId), lastLeg.dartsThrown, lastLeg.checkout))}</p>
      )}
    </section>
  );
}
