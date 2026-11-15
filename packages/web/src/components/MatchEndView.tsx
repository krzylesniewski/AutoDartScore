import type { CreateMatchRequest, MatchSnapshot, MatchSnapshotPlayer, MatchSummary } from '@autoscore/schema';
import { useRef, useState, type ReactNode } from 'react';
import { createMatch } from '../api/client';
import type { AchievementNotice } from '../api/use-match';
import { casualPlaces } from '../game/casual-places';
import { formatAverage } from '../game/format-stat';
import { rematchRequest } from '../game/rematch-request';
import { pl } from '../i18n/pl';
import { AchievementNotices } from './AchievementNotices';
import { Avatar } from './Avatar';
import { CasualRankingCard } from './CasualRankingCard';
import { EffectsToggle } from './EffectsToggle';
import { GameTime } from './GameTime';
import { CheckIcon, LockIcon, PlusIcon, TrophyIcon, UndoIcon, WarningIcon } from './icons';
import { LegDuration } from './LegDuration';
import { SaveGuest, SUMMARY_ROWS } from './MatchSummaryPanel';
import { ScoreProgressChart } from './ScoreProgressChart';
import { VoiceToggle } from './VoiceToggle';

const HOME_HREF = '#/';

// Bez rozmiaru i koloru, żeby dwie klasy tego samego rodzaju nie walczyły na jednym elemencie.
const labelBase = 'font-display font-semibold uppercase tracking-(--tracking-label)';
const label = `${labelBase} text-(length:--text-label) text-(--color-text-muted)`;

export interface MatchEndViewProps {
  state: MatchSnapshot;
  summary: MatchSummary | null;
  summaryError: boolean;
  error: string | null;
  connectionLost: boolean;
  busy: boolean;
  undoLocked: boolean;
  undoCountdown: string | null; // pozostały czas na cofnięcie, np. 4:12
  onUndo(): void;
  voiceEnabled: boolean;
  onVoiceChange(next: boolean): void;
  effectsEnabled: boolean;
  onEffectsChange(next: boolean): void;
  achievements?: readonly AchievementNotice[];
}

export function MatchEndView({
  state,
  summary,
  summaryError,
  error,
  connectionLost,
  busy,
  undoLocked,
  undoCountdown,
  onUndo,
  voiceEnabled,
  onVoiceChange,
  effectsEnabled,
  onEffectsChange,
  achievements = [],
}: MatchEndViewProps) {
  // Podsumowanie sprzed ostatniej rzutki nie zawiera zamykającej tury, więc czekamy na aktualne.
  const current = summary && summary.eventSeq >= state.eventSeq ? summary : null;
  const isCasual = state.type === 'casual';
  const pending = <p className="font-display text-xl text-(--color-text-muted)">{summaryError ? pl.summaryFailed : pl.loading}</p>;
  const guests = state.players
    .filter((player) => player.guest)
    .map((player) => <SaveGuest key={player.id} player={player} />);
  const chart = current?.lastLegProgress && <ScoreProgressChart progress={current.lastLegProgress} players={state.players} />;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-(--color-border) px-4 py-2 sm:px-(--space-page) lg:min-h-17">
        <a href={HOME_HREF} className="flex min-h-11 items-center font-display text-[19px] font-semibold text-(--color-text-sub)">
          {pl.close}
        </a>
        <h1 className="font-display text-[26px] leading-tight font-extrabold">{pl.matchEndTitle}</h1>
        {isCasual && <span className="font-display text-[19px] text-(--color-text-sub)">{[pl.typeCasual, setupLine(state)].join(' · ')}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <VoiceToggle enabled={voiceEnabled} onChange={onVoiceChange} />
          <EffectsToggle enabled={effectsEnabled} onChange={onEffectsChange} />
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <main
          className={`grid min-h-0 flex-1 grid-cols-1 content-start gap-(--space-page) overflow-auto p-4 sm:p-(--space-page) lg:gap-6 ${isCasual ? 'lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[520px_minmax(0,1fr)]' : 'lg:grid-cols-[1fr_470px]'}`}
        >
          {(connectionLost || error || undoLocked) && (
            <div className="flex flex-col gap-3 lg:col-span-2">
              {connectionLost && <Notice text={pl.connectionLost} />}
              {error && <Notice text={error} />}
              {undoLocked && <Notice text={pl.matchLocked} icon={<LockIcon className="text-(--color-accent)" />} />}
            </div>
          )}
          {isCasual ? (
            <>
              <div className="flex min-w-0 flex-col gap-4">
                <CasualRankingCard state={state} summary={current} />
                {guests}
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                {chart}
                {current ? <StatsPanel summary={current} columns={casualPlaces(state, current)} rows={SUMMARY_ROWS.filter((row) => !row.matchOnly)} /> : pending}
              </div>
            </>
          ) : (
            <MatchColumns state={state} current={current} guests={guests} chart={chart} pending={pending} />
          )}
        </main>
        {/* Nakładka nie przesuwa układu i nie łapie dotyku, więc przyciski zostają klikalne. */}
        <div role="status" className="pointer-events-none absolute inset-x-0 top-0 z-10 px-(--space-page) pt-(--space-page)">
          <AchievementNotices notices={achievements} />
        </div>
      </div>
      <ActionBar state={state} busy={busy} undoLocked={undoLocked} undoCountdown={undoCountdown} onUndo={onUndo} />
    </div>
  );
}

interface MatchColumnsProps {
  state: MatchSnapshot;
  current: MatchSummary | null;
  guests: ReactNode;
  chart: ReactNode;
  pending: ReactNode;
}

function MatchColumns({ state, current, guests, chart, pending }: MatchColumnsProps) {
  const winner = state.players.find((player) => player.id === state.winnerId);
  const loser = state.players.find((player) => player.id !== state.winnerId);
  const ranked = [winner, loser].filter((player) => player !== undefined).map((player) => ({ player, place: null }));
  return (
    <>
      <div className="flex min-w-0 flex-col gap-4">
        <WinnerCard state={state} winner={winner} loser={loser} />
        {guests}
        {current && current.legs.length > 0 && <LegCards state={state} summary={current} />}
        {chart}
      </div>
      <div className="min-w-0">{current ? <StatsPanel summary={current} columns={ranked} rows={SUMMARY_ROWS} /> : pending}</div>
    </>
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

function WinnerHalo() {
  return <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full max-h-96 bg-(image:--gradient-winner-halo)" />;
}

interface WinnerCardProps {
  state: MatchSnapshot;
  winner: MatchSnapshotPlayer | undefined;
  loser: MatchSnapshotPlayer | undefined;
}

function WinnerCard({ state, winner, loser }: WinnerCardProps) {
  return (
    <section className="sc-panel items-center px-4 py-6 text-center lg:px-8 lg:py-7">
      <WinnerHalo />
      <div className="relative flex max-w-full flex-col items-center gap-3">
        <TrophyIcon className="text-5xl text-(--color-gold)" />
        <p className={`${labelBase} text-(length:--text-label) text-(--color-text-sub)`}>{pl.matchFinished}</p>
        <p className="max-w-full font-display text-[length:clamp(2.25rem,5vw,3.25rem)] leading-tight font-black break-words">{pl.playerWins(winner?.name ?? '')}</p>
        <div className="flex items-center gap-4 lg:gap-7">
          {winner && (
            <span className="inline-flex rounded-full shadow-(--shadow-winner-avatar)">
              <Avatar name={winner.name} avatar={winner.avatar} color={winner.color} size="preview" />
            </span>
          )}
          <p className="font-display text-[length:clamp(3.5rem,9vw,5.375rem)] leading-none font-black tabular-nums">
            {pl.matchScore(winner?.legsWon ?? 0, loser?.legsWon ?? 0)}
          </p>
          {loser && <Avatar name={loser.name} avatar={loser.avatar} color={loser.color} size="preview" />}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <GameTime state={state} />
          <p className="text-[15px] text-(--color-text-muted)">{setupLine(state)}</p>
        </div>
      </div>
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
          <li key={leg.legIndex} className="sc-panel min-w-0 gap-0.5 rounded-(--radius-card) px-4.5 py-3 shadow-(--shadow-card) lg:flex-1 lg:basis-52">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Avatar name={name} avatar={legWinner?.avatar ?? null} color={legWinner?.color ?? 1} size="small" />
              <span className={`${labelBase} text-[13px] text-(--color-text-sub)`}>{pl.legNumber(leg.legIndex + 1)}</span>
              <span className="ml-auto text-[21px] leading-none">
                <LegDuration ms={leg.durationMs} />
              </span>
            </div>
            <span className="mt-1.5 text-[15px] break-words text-(--color-text-sub)">{pl.legResult(name, leg.dartsThrown, leg.checkout)}</span>
            {leg.averages.length > 0 && (
              <span className="text-sm break-words text-(--color-text-muted)">
                {leg.averages
                  .map((entry) => `${state.players.find((player) => player.id === entry.playerId)?.name ?? ''} ${formatAverage(entry.average)}`)
                  .join(' · ')}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface StatsColumn {
  player: MatchSnapshotPlayer;
  place: number | null; // numer miejsca w nagłówku kolumny, tylko w zabawie
}

interface StatsPanelProps {
  summary: MatchSummary;
  columns: readonly StatsColumn[];
  rows: typeof SUMMARY_ROWS;
}

function StatsPanel({ summary, columns, rows }: StatsPanelProps) {
  const lines = columns.map(({ player }) => summary.players.find((line) => line.playerId === player.id));
  return (
    <section className="sc-panel">
      <h2 className="font-display text-[26px] leading-tight font-extrabold">{pl.matchStats}</h2>
      {/* Tabela czterech graczy jest szersza niż telefon, więc przewija się tylko ona, nie strona. */}
      <div className="overflow-x-auto">
        <table className="w-full font-display">
          <caption className="sr-only">{pl.matchSummary}</caption>
          <thead>
            <tr>
              <td />
              {columns.map(({ player, place }, index) => (
                <th
                  key={player.id}
                  scope="col"
                  className={`px-2 pb-3 text-left text-xl font-bold lg:px-3 ${index === 0 ? 'text-(--color-text)' : 'text-(--color-text-sub)'}`}
                >
                  {/* W zabawie imię może zejść pod avatar, żeby cztery kolumny mieściły się w panelu bez przewijania. */}
                  <span className={`flex items-center gap-x-2 gap-y-1 ${place === null ? '' : 'flex-wrap'}`}>
                    {place !== null && (
                      <span className={`font-black ${place === 1 ? 'text-(--color-gold)' : 'text-(--color-text-muted)'}`}>{pl.placeNumber(place)}</span>
                    )}
                    <Avatar name={player.name} avatar={player.avatar} color={player.color} size="small" />
                    <span className="min-w-0 break-words">{player.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-(--color-border)">
                <th scope="row" className={`${label} py-3 pr-2 text-left`}>
                  {row.label}
                </th>
                {lines.map((line, index) => (
                  <td
                    key={columns[index]?.player.id}
                    className={`px-2 py-3 text-[21px] whitespace-nowrap tabular-nums lg:px-3 ${index === 0 ? 'font-extrabold text-(--color-text)' : 'font-semibold text-(--color-text-sub)'}`}
                  >
                    {line ? row.value(line) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface ActionBarProps {
  state: MatchSnapshot;
  busy: boolean;
  undoLocked: boolean;
  undoCountdown: string | null;
  onUndo(): void;
}

function ActionBar({ state, busy, undoLocked, undoCountdown, onUndo }: ActionBarProps) {
  const isCasual = state.type === 'casual';
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
    <div className="flex flex-col gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-(--space-page) lg:min-h-23 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-3">
        {!isCasual && (
          <a href={HOME_HREF} className="sc-btn flex-1 bg-transparent text-(--color-text-sub) lg:flex-none">
            <CheckIcon />
            {pl.saveAndExit}
          </a>
        )}
        <button type="button" onClick={onUndo} disabled={busy || undoLocked} className="sc-btn sc-btn--outline flex-1 tabular-nums lg:flex-none">
          <UndoIcon />
          {undoCountdown === null ? pl.undo : pl.undoWithTime(undoCountdown)}
        </button>
      </div>
      <div className="flex flex-col gap-2 lg:items-end">
        {status === 'failed' && (
          <p role="alert" className="flex items-center gap-2 font-display text-xl text-(--color-text)">
            <WarningIcon className="text-(--color-accent)" />
            {pl.rematchFailed}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {isCasual ? (
            <a href={HOME_HREF} className="sc-btn sc-btn--primary h-[60px] flex-1 lg:flex-none">
              <PlusIcon />
              {pl.newGame}
            </a>
          ) : (
            <>
              <a href={HOME_HREF} className="sc-btn h-[60px] flex-1 text-[22px] font-bold shadow-(--shadow-key) lg:flex-none">
                {pl.newMatch}
              </a>
              {request && (
                <button
                  type="button"
                  disabled={status === 'pending'}
                  onClick={() => void rematch(request)}
                  className="sc-btn sc-btn--primary h-[60px] flex-1 px-8 lg:flex-none"
                >
                  {pl.rematch}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Notice({ text, icon = <WarningIcon className="text-(--color-accent)" /> }: { text: string; icon?: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-(--radius-card) bg-(--color-surface-soft) px-4 py-2 font-display text-xl text-(--color-text)">
      {icon}
      {text}
    </p>
  );
}
