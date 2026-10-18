import type { MatchListItem } from '@autoscore/schema';
import { useEffect, useState } from 'react';
import { listMatches, resumeMatch } from '../api/client';
import { PauseIcon, TargetIcon, ThrowingIcon, WarningIcon } from '../components/icons';
import { pl } from '../i18n/pl';

const NEW_GAME_HREF = '#/new';

// Pełne nazwy klas, bo Tailwind generuje CSS tylko dla klas zapisanych dosłownie.
const AVATAR_COLORS = ['bg-(--color-avatar-1)', 'bg-(--color-avatar-2)', 'bg-(--color-avatar-3)', 'bg-(--color-avatar-4)'] as const;

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const action = 'flex min-h-12 items-center rounded-(--radius-card) border-(length:--border-width) px-5 font-display text-xl font-semibold uppercase';

const dateFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' });

function matchHref(id: string): string {
  return `#/matches/${encodeURIComponent(id)}`;
}

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'loaded'; matches: MatchListItem[] };

export function HomeScreen() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [resumeError, setResumeError] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMatches('unfinished').then(
      (matches) => {
        if (!cancelled) {
          setLoad({ kind: 'loaded', matches });
        }
      },
      () => {
        if (!cancelled) {
          setLoad({ kind: 'error' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function resume(id: string): Promise<void> {
    setResuming(id);
    setResumeError(false);
    try {
      await resumeMatch(id);
      window.location.hash = matchHref(id);
    } catch {
      setResumeError(true);
      setResuming(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <h1 className="flex items-center gap-3 font-display text-5xl font-bold uppercase">
        <TargetIcon className="text-(--color-accent)" />
        {pl.appName}
      </h1>
      <a
        href={NEW_GAME_HREF}
        className="flex min-h-14 items-center justify-center rounded-(--radius-card) bg-(--color-accent) px-6 font-display text-2xl font-bold uppercase text-(--color-on-accent)"
      >
        {pl.newGame}
      </a>
      <section aria-labelledby="unfinished-games" className="flex flex-col gap-3">
        <h2 id="unfinished-games" className="font-display text-3xl font-bold uppercase">
          {pl.unfinishedGames}
        </h2>
        {resumeError && <Notice text={pl.resumeFailed} />}
        {load.kind === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {load.kind === 'error' && <Notice text={pl.loadMatchesFailed} />}
        {load.kind === 'loaded' && load.matches.length === 0 && <p className="text-(--color-text-muted)">{pl.noUnfinishedGames}</p>}
        {load.kind === 'loaded' && load.matches.length > 0 && (
          <ul className="flex flex-col gap-3">
            {load.matches.map((match) => (
              <MatchRow key={match.id} match={match} resuming={resuming !== null} onResume={() => void resume(match.id)} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function typeLabel(match: MatchListItem): string {
  if (match.type === 'match') {
    return pl.typeMatch;
  }
  if (match.type === 'casual') {
    return pl.typeCasual;
  }
  return match.practiceMode === 'solo_501' ? pl.solo501 : pl.freeRun;
}

interface MatchRowProps {
  match: MatchListItem;
  resuming: boolean;
  onResume(): void;
}

function MatchRow({ match, resuming, onResume }: MatchRowProps) {
  const abandoned = match.status === 'abandoned';
  return (
    <li className="flex flex-col gap-3 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-2xl font-bold uppercase">{typeLabel(match)}</span>
        {/* W Solo 501 punkty startowe są już w nazwie trybu. */}
        {match.type !== 'practice' && match.startingScore !== null && <span className="font-display text-2xl text-(--color-text-muted)">{match.startingScore}</span>}
        <StatusBadge abandoned={abandoned} />
        <span className="ml-auto flex items-baseline gap-2">
          <span className={label}>{pl.lastActivity}</span>
          <time dateTime={match.updatedAt} className="text-(--color-text-muted)">
            {dateFormat.format(new Date(match.updatedAt))}
          </time>
        </span>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {match.players.map((player, index) => (
          <li key={player.id} className="flex items-center gap-2 font-display text-xl">
            <span
              aria-hidden="true"
              className={`flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-(--color-on-avatar) ${AVATAR_COLORS[index] ?? AVATAR_COLORS[0]}`}
            >
              {player.avatar ?? player.name.charAt(0).toUpperCase()}
            </span>
            <span className="font-semibold">{player.name}</span>
            <PlayerProgress player={player} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        {abandoned ? (
          <>
            <button
              type="button"
              onClick={onResume}
              disabled={resuming}
              className={`${action} border-(--color-text) bg-(--color-text) text-(--color-text-inverse) disabled:opacity-40`}
            >
              {pl.resume}
            </button>
            <a href={matchHref(match.id)} className={`${action} border-(--color-border-strong) bg-(--color-surface-button) text-(--color-text)`}>
              {pl.preview}
            </a>
          </>
        ) : (
          <a href={matchHref(match.id)} className={`${action} border-(--color-text) bg-(--color-text) text-(--color-text-inverse)`}>
            {pl.continueMatch}
          </a>
        )}
      </div>
    </li>
  );
}

function PlayerProgress({ player }: { player: MatchListItem['players'][number] }) {
  if (player.place !== null) {
    return <span className="text-(--color-text-muted)">{pl.place(player.place)}</span>;
  }
  return (
    <>
      {player.remaining !== null && <span className="font-bold tabular-nums">{player.remaining}</span>}
      {player.legsWon !== null && (
        <span className="text-(--color-text-muted)">
          {pl.legs} {player.legsWon}
        </span>
      )}
    </>
  );
}

function StatusBadge({ abandoned }: { abandoned: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-(--radius-chip) border-(length:--border-width) px-3 py-1 font-display text-lg font-semibold uppercase ${
        abandoned ? 'border-(--color-accent) text-(--color-text)' : 'border-(--color-border-strong) text-(--color-text-muted)'
      }`}
    >
      {abandoned ? <PauseIcon className="text-(--color-accent)" /> : <ThrowingIcon />}
      {abandoned ? pl.statusAbandoned : pl.statusInProgress}
    </span>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 font-display text-xl text-(--color-accent)">
      <WarningIcon />
      {text}
    </p>
  );
}
