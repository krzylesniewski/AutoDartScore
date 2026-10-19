import type { CreateMatchRequest, MatchSnapshot, MatchSnapshotPlayer, MatchSummary } from '@autoscore/schema';
import { useRef, useState } from 'react';
import { createMatch } from '../api/client';
import { rematchRequest } from '../game/rematch-request';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { EffectsToggle } from './EffectsToggle';
import { CheckIcon, TrophyIcon, UndoIcon, WarningIcon } from './icons';
import { SaveGuest, SUMMARY_ROWS } from './MatchSummaryPanel';
import { VoiceToggle } from './VoiceToggle';

const HOME_HREF = '#/';

const card = 'rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface)';
const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const button =
  'flex min-h-12 items-center justify-center gap-2 rounded-(--radius-card) border-(length:--border-width) px-5 font-display text-(length:--text-button) font-semibold';

export interface MatchEndViewProps {
  state: MatchSnapshot;
  summary: MatchSummary | null;
  summaryError: boolean;
  error: string | null;
  connectionLost: boolean;
  busy: boolean;
  onUndo(): void;
  voiceEnabled: boolean;
  onVoiceChange(next: boolean): void;
  effectsEnabled: boolean;
  onEffectsChange(next: boolean): void;
}

export function MatchEndView({
  state,
  summary,
  summaryError,
  error,
  connectionLost,
  busy,
  onUndo,
  voiceEnabled,
  onVoiceChange,
  effectsEnabled,
  onEffectsChange,
}: MatchEndViewProps) {
  // Podsumowanie sprzed ostatniej rzutki nie zawiera zamykającej tury, więc czekamy na aktualne.
  const current = summary && summary.eventSeq >= state.eventSeq ? summary : null;
  const winner = state.players.find((player) => player.id === state.winnerId);
  const loser = state.players.find((player) => player.id !== state.winnerId);
  const ranked = [winner, loser].filter((player) => player !== undefined);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--color-border-subtle) bg-(--color-surface-header) px-(--space-page) py-2">
        <a href={HOME_HREF} className="flex min-h-11 items-center text-(length:--text-button) font-semibold text-(--color-text-muted)">
          {pl.close}
        </a>
        <h1 className="font-display text-(length:--text-heading) font-bold tracking-wide">{pl.matchEndTitle}</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <VoiceToggle enabled={voiceEnabled} onChange={onVoiceChange} />
          <EffectsToggle enabled={effectsEnabled} onChange={onEffectsChange} />
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 content-start gap-(--space-page) overflow-auto p-(--space-page) lg:grid-cols-[1fr_470px]">
        {(connectionLost || error) && (
          <div className="flex flex-col gap-3 lg:col-span-2">
            {connectionLost && <Notice text={pl.connectionLost} />}
            {error && <Notice text={error} />}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-4">
          <WinnerCard state={state} winner={winner} loser={loser} />
          {state.players
            .filter((player) => player.guest)
            .map((player) => (
              <SaveGuest key={player.id} player={player} />
            ))}
          {current && current.legs.length > 0 && <LegCards state={state} summary={current} />}
        </div>
        <div className="min-w-0">
          {current ? (
            <ComparisonTable state={state} summary={current} players={ranked} />
          ) : (
            <p className="font-display text-xl text-(--color-text-muted)">{summaryError ? pl.summaryFailed : pl.loading}</p>
          )}
        </div>
      </main>
      <ActionBar state={state} busy={busy} onUndo={onUndo} />
    </div>
  );
}

function setupLine(state: MatchSnapshot): string {
  const parts: string[] = [];
  if (state.startingScore !== null) {
    parts.push(String(state.startingScore), pl.doubleOut);
  }
  if (state.legsToWin !== null) {
    parts.push(pl.bestOfOption(state.legsToWin * 2 - 1));
  }
  return parts.join(' · ');
}

function colorIndex(state: MatchSnapshot, playerId: string): number {
  return state.players.findIndex((player) => player.id === playerId);
}

interface WinnerCardProps {
  state: MatchSnapshot;
  winner: MatchSnapshotPlayer | undefined;
  loser: MatchSnapshotPlayer | undefined;
}

function WinnerCard({ state, winner, loser }: WinnerCardProps) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-(--radius-card) border-(length:--border-width) border-(--color-accent) bg-(--color-surface-active) p-4 text-center lg:p-8">
      <TrophyIcon className="text-[56px] text-(--color-accent)" />
      <p className={label}>{pl.matchFinished}</p>
      <p className="font-display text-[length:clamp(2.25rem,6vw,3.75rem)] leading-tight font-bold break-words">{pl.playerWins(winner?.name ?? '')}</p>
      <div className="flex items-center gap-3 lg:gap-7">
        {winner && <Avatar name={winner.name} avatar={winner.avatar} colorIndex={colorIndex(state, winner.id)} size="preview" />}
        <p className="font-display text-[length:clamp(4rem,12vw,7.5rem)] leading-none font-bold tabular-nums">
          {pl.matchScore(winner?.legsWon ?? 0, loser?.legsWon ?? 0)}
        </p>
        {loser && <Avatar name={loser.name} avatar={loser.avatar} colorIndex={colorIndex(state, loser.id)} size="preview" />}
      </div>
      <p className="text-lg text-(--color-text-muted)">{setupLine(state)}</p>
    </section>
  );
}

function LegCards({ state, summary }: { state: MatchSnapshot; summary: MatchSummary }) {
  return (
    <ol aria-label={pl.legs} className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
      {summary.legs.map((leg) => {
        const legWinner = state.players.find((player) => player.id === leg.winnerId);
        const name = legWinner?.name ?? '';
        return (
          <li key={leg.legIndex} className={`flex items-center gap-3 px-5 py-4 lg:flex-1 ${card}`}>
            <Avatar name={name} avatar={legWinner?.avatar ?? null} colorIndex={colorIndex(state, leg.winnerId)} size="small" />
            <div className="flex flex-col">
              <span className={label}>{pl.legNumber(leg.legIndex + 1)}</span>
              <span className="text-xl font-semibold">{pl.legWinner(name, leg.dartsThrown)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

interface ComparisonTableProps {
  state: MatchSnapshot;
  summary: MatchSummary;
  players: readonly MatchSnapshotPlayer[];
}

function ComparisonTable({ state, summary, players }: ComparisonTableProps) {
  const lines = players.map((player) => summary.players.find((line) => line.playerId === player.id));
  return (
    <div className={card}>
      <table className="w-full">
        <caption className="sr-only">{pl.matchSummary}</caption>
        <thead>
          <tr>
            <td />
            {players.map((player) => (
              <th key={player.id} scope="col" className="px-2 py-3 text-left text-lg font-semibold lg:px-4 lg:text-xl">
                <span className="flex items-center gap-2">
                  <Avatar name={player.name} avatar={player.avatar} colorIndex={colorIndex(state, player.id)} size="small" />
                  <span className="min-w-0 break-words">{player.name}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SUMMARY_ROWS.map((row) => (
            <tr key={row.label} className="h-[38px] border-t-(length:--border-width) border-(--color-border) lg:h-[52px]">
              <th scope="row" className={`${label} px-2 text-left lg:px-4`}>
                {row.label}
              </th>
              {lines.map((line, index) => (
                <td
                  key={players[index]?.id}
                  className={`px-2 text-base whitespace-nowrap tabular-nums lg:px-4 lg:text-xl ${index === 0 ? 'font-bold' : 'font-semibold text-(--color-text-muted)'}`}
                >
                  {line ? row.value(line) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionBar({ state, busy, onUndo }: { state: MatchSnapshot; busy: boolean; onUndo(): void }) {
  const request = rematchRequest(state);
  // Ref blokuje drugie kliknięcie w tym samym takcie, zanim stan zdąży wyłączyć przycisk.
  const pending = useRef(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'failed'>('idle');

  async function rematch(body: CreateMatchRequest): Promise<void> {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setStatus('pending');
    try {
      const match = await createMatch(body);
      // Przycisk zostaje wyłączony, bo zmiana adresu odmontowuje ten widok.
      window.location.hash = `#/matches/${encodeURIComponent(match.id)}`;
    } catch {
      pending.current = false;
      setStatus('failed');
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-(--color-border) bg-(--color-surface-header) px-(--space-page) pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-3">
        <a href={HOME_HREF} className={`${button} border-transparent text-(--color-text-muted)`}>
          <CheckIcon />
          {pl.saveAndExit}
        </a>
        <button
          type="button"
          onClick={onUndo}
          disabled={busy}
          className={`${button} border-(--color-border-strong) bg-(--color-surface-button) disabled:opacity-40`}
        >
          <UndoIcon />
          {pl.undo}
        </button>
      </div>
      <div className="flex flex-col gap-2 lg:items-end">
        {status === 'failed' && (
          <p className="flex items-center gap-2 font-display text-xl text-(--color-text)">
            <WarningIcon className="text-(--color-accent)" />
            {pl.rematchFailed}
          </p>
        )}
        <div className="flex gap-3">
          <a href={HOME_HREF} className={`${button} h-[60px] flex-1 border-(--color-border-strong) bg-(--color-surface-button) lg:flex-none`}>
            {pl.newMatch}
          </a>
          {request && (
            <button
              type="button"
              disabled={status === 'pending'}
              onClick={() => void rematch(request)}
              className="flex h-[60px] flex-1 items-center justify-center rounded-(--radius-card) border-(length:--border-width) border-(--color-accent) bg-(--color-accent) px-10 font-display text-xl font-bold text-(--color-on-accent) disabled:opacity-40 lg:flex-none"
            >
              {pl.rematch}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-(--radius-card) border-(length:--border-width) border-(--color-accent) bg-(--color-surface) px-4 py-2 font-display text-xl text-(--color-text)">
      <WarningIcon className="text-(--color-accent)" />
      {text}
    </p>
  );
}
