import type { MatchSnapshot, MatchSnapshotPlayer, MatchSummary, MatchSummaryPlayer } from '@autoscore/schema';
import { useState } from 'react';
import { updatePlayer } from '../api/client';
import { formatAverage, formatBestLeg, formatDoubles, formatNumber } from '../game/format-stat';
import { durationSeconds, formatDuration, gameElapsedMs } from '../game/leg-clock';
import { pl } from '../i18n/pl';
import { CheckIcon, TrophyIcon, WarningIcon } from './icons';

const NEW_GAME_HREF = '#/';

const link = 'text-xl font-semibold uppercase text-(--color-text) underline';
const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

interface Row {
  readonly label: string;
  readonly value: (line: MatchSummaryPlayer) => string;
  readonly matchOnly?: boolean;
}

export const SUMMARY_ROWS: readonly Row[] = [
  { label: pl.statAverage, value: (line) => formatAverage(line.average) },
  { label: pl.statFirst9, value: (line) => formatAverage(line.first9Average) },
  { label: pl.stat180, value: (line) => String(line.scores180) },
  { label: pl.stat140, value: (line) => String(line.scores140) },
  { label: pl.stat100, value: (line) => String(line.scores100) },
  { label: pl.stat60, value: (line) => String(line.scores60) },
  { label: pl.statHighestCheckout, value: (line) => formatNumber(line.highestCheckout) },
  { label: pl.statDoubles, value: formatDoubles },
  { label: pl.statBestLeg, value: (line) => formatBestLeg(line.bestLegDarts) },
  { label: pl.statLegsWon, value: (line) => String(line.legsWon), matchOnly: true },
];

export interface MatchSummaryPanelProps {
  state: MatchSnapshot;
  summary: MatchSummary | null;
  error: boolean;
}

export function MatchSummaryPanel({ state, summary, error }: MatchSummaryPanelProps) {
  const name = (playerId: string | null) => state.players.find((player) => player.id === playerId)?.name ?? '';
  // Podsumowanie sprzed ostatniej rzutki nie zawiera zamykającej tury, więc czekamy na aktualne.
  const current = summary && summary.eventSeq >= state.eventSeq ? summary : null;
  const elapsed = gameElapsedMs(state);

  return (
    <section className="flex flex-col gap-3 rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface) p-4 font-display">
      <h2 className="flex items-center gap-2 text-3xl font-bold uppercase">
        <TrophyIcon className="text-(--color-text)" />
        {pl.matchOver}
      </h2>
      <MatchResult state={state} name={name} />
      {elapsed !== null && <p className="text-(--color-text-muted)">{pl.gameTime(formatDuration(durationSeconds(elapsed)))}</p>}
      {state.players
        .filter((player) => player.guest)
        .map((player) => (
          <SaveGuest key={player.id} player={player} />
        ))}
      {current ? <SummaryTable state={state} summary={current} /> : <p className="text-(--color-text-muted)">{error ? pl.summaryFailed : pl.loading}</p>}
      {current && current.legs.length > 0 && <LegList summary={current} name={name} />}
      <a href={NEW_GAME_HREF} className={link}>
        {pl.newGame}
      </a>
    </section>
  );
}

function columns(state: MatchSnapshot, summary: MatchSummary): MatchSummaryPlayer[] {
  const ids =
    state.type === 'casual'
      ? [...state.placements].sort((a, b) => a.place - b.place).map((placement) => placement.playerId)
      : state.players.map((player) => player.id);
  return ids.flatMap((id) => summary.players.filter((line) => line.playerId === id));
}

function SummaryTable({ state, summary }: { state: MatchSnapshot; summary: MatchSummary }) {
  const players = columns(state, summary);
  const rows = SUMMARY_ROWS.filter((row) => !row.matchOnly || state.type === 'match');
  const name = (playerId: string) => state.players.find((player) => player.id === playerId)?.name ?? '';
  return (
    <table className="w-full text-xl">
      <caption className="sr-only">{pl.matchSummary}</caption>
      <thead>
        <tr>
          <td />
          {players.map((line) => (
            <th key={line.playerId} scope="col" className="px-2 text-right font-semibold">
              {name(line.playerId)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t-(length:--border-width) border-(--color-border)">
            <th scope="row" className={`${label} py-1 text-left`}>
              {row.label}
            </th>
            {players.map((line) => (
              <td key={line.playerId} className="px-2 py-1 text-right whitespace-nowrap tabular-nums">
                {row.value(line)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LegList({ summary, name }: { summary: MatchSummary; name: (playerId: string) => string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className={label}>{pl.legs}</h3>
      <ol className="flex flex-col gap-2">
        {summary.legs.map((leg) => (
          <li key={leg.legIndex} className="flex flex-col">
            <span className="text-xl">{pl.legSummary(leg.legIndex + 1, pl.legResult(name(leg.winnerId), leg.dartsThrown, leg.checkout))}</span>
            <span className="text-(--color-text-muted)">
              {leg.averages.map((entry) => `${name(entry.playerId)} ${formatAverage(entry.average)}`).join(' · ')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MatchResult({ state, name }: { state: MatchSnapshot; name: (playerId: string | null) => string }) {
  if (state.type === 'casual') {
    return (
      <ol className="text-2xl">
        {[...state.placements]
          .sort((a, b) => a.place - b.place)
          .map((placement) => (
            <li key={placement.playerId}>
              {pl.place(placement.place)} {name(placement.playerId)}
            </li>
          ))}
      </ol>
    );
  }
  if (state.type === 'match') {
    const winner = state.players.find((player) => player.id === state.winnerId);
    const loser = state.players.find((player) => player.id !== state.winnerId);
    return (
      <p className="text-2xl">
        {name(state.winnerId)} {pl.legsScore(winner?.legsWon ?? 0, loser?.legsWon ?? 0)}
      </p>
    );
  }
  return <p className="text-2xl">{state.players[0]?.name}</p>;
}

// Zapisany gość trafia na listę graczy, a jego wcześniejsze rzutki zaczynają się liczyć do statystyk.
export function SaveGuest({ player }: { player: MatchSnapshotPlayer }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save(): Promise<void> {
    setStatus('saving');
    try {
      await updatePlayer(player.id, { guest: false });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xl">
      <span>{player.name}</span>
      {status === 'saved' ? (
        <span className="flex items-center gap-2 font-semibold">
          <CheckIcon className="text-(--color-status-ok)" />
          {pl.playerSaved}
        </span>
      ) : (
        <button
          type="button"
          aria-label={pl.savePlayerOf(player.name)}
          disabled={status === 'saving'}
          onClick={() => void save()}
          className="flex min-h-11 items-center rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-4 font-semibold disabled:opacity-40"
        >
          {pl.savePlayer}
        </button>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-2 text-(--color-accent)">
          <WarningIcon />
          {pl.savePlayerFailed}
        </span>
      )}
    </div>
  );
}
