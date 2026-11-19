import type { TournamentListItem } from '@autoscore/schema';
import { useEffect, useState } from 'react';
import { listTournaments } from '../api/client';
import { AppNav } from '../components/AppNav';
import { ArchiveTournamentDialog } from '../components/ArchiveTournamentDialog';
import { ArchiveIcon } from '../components/icons';
import { Notice } from '../components/Notice';
import { FORMAT_LABELS, formatDay } from '../game/tournament-setup';
import { pl } from '../i18n/pl';

type Tournaments = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: readonly TournamentListItem[] };

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';

function tournamentHref(id: string): string {
  return `#/tournaments/${encodeURIComponent(id)}`;
}

function winnerName(item: TournamentListItem): string | null {
  const winner = item.placements.find((placement) => placement.place === 1);
  return item.players.find((player) => player.id === winner?.playerId)?.name ?? null;
}

// Trwający turniej jest najwyżej jeden, więc wpis „Turniej” prowadzi prosto do niego. Bez niego ekran pokazuje zakończone.
export function TournamentsScreen() {
  const [tournaments, setTournaments] = useState<Tournaments>({ status: 'loading' });
  const [archiving, setArchiving] = useState<TournamentListItem | null>(null);
  const active = tournaments.status === 'ready' ? tournaments.items.find((item) => item.status === 'in_progress') : undefined;

  useEffect(() => {
    let cancelled = false;
    listTournaments().then(
      (items) => {
        if (!cancelled) {
          setTournaments({ status: 'ready', items });
        }
      },
      () => {
        if (!cancelled) {
          setTournaments({ status: 'error' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (active) {
      window.location.replace(tournamentHref(active.id));
    }
  }, [active]);

  const finished = tournaments.status === 'ready' ? tournaments.items.filter((item) => item.status === 'finished') : [];

  function archived(id: string): void {
    setArchiving(null);
    setTournaments((current) =>
      current.status === 'ready' ? { status: 'ready', items: current.items.filter((item) => item.id !== id) } : current,
    );
  }

  return (
    <div className="flex h-full flex-col">
      <AppNav current="tournament" />
      <main className="flex min-h-0 flex-1 flex-col gap-(--space-6) overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:px-(--space-page) lg:pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-8">
          <h1 className="font-display text-[length:clamp(2.5rem,10vw,4rem)] leading-[0.9] font-black tracking-[0.01em]">
            {pl.tournaments}
          </h1>
          <a
            href="#/tournaments/new"
            className="sc-btn sc-btn--primary h-13 rounded-(--radius-card) px-6 font-display text-2xl font-extrabold tracking-[0.04em] uppercase max-sm:w-full"
          >
            {pl.newTournament}
          </a>
        </div>
        {(tournaments.status === 'loading' || active) && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {tournaments.status === 'error' && <Notice text={pl.loadTournamentsFailed} />}
        {tournaments.status === 'ready' && !active && (
          <section aria-labelledby="finished-tournaments" className="flex flex-col gap-3">
            <h2 id="finished-tournaments" className={label}>
              {pl.finishedTournaments}
            </h2>
            {finished.length === 0 ? (
              <p className="text-lg text-(--color-text-muted)">{pl.noFinishedTournaments}</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {finished.map((item) => {
                  const winner = winnerName(item);
                  return (
                    // Przycisk obok linku, nie w nim, bo element interaktywny w <a> jest niedozwolony.
                    <li key={item.id} className="flex items-stretch gap-2.5">
                      {/* Siatka rozciąga link na wysokość wiersza, a min-w-0 pozwala skrócić długą nazwę. */}
                      <div className="grid min-w-0 flex-1">
                        <a
                          href={tournamentHref(item.id)}
                          className="flex min-h-16 flex-wrap items-center gap-x-5 gap-y-1 rounded-(--radius-card) bg-(--color-surface-softer) px-5 py-3 text-(--color-text) shadow-(--shadow-inset-line)"
                        >
                          <span className="min-w-0 flex-1 basis-60 truncate font-display text-2xl font-bold">{item.name}</span>
                          <span className="text-(--color-text-sub)">{FORMAT_LABELS[item.format]}</span>
                          <span className="text-(--color-text-muted) tabular-nums">{formatDay(new Date(item.createdAt))}</span>
                          {winner && <span className="font-semibold">{pl.tournamentWinner(winner)}</span>}
                        </a>
                      </div>
                      <button
                        type="button"
                        aria-label={pl.archiveTournamentOf(item.name)}
                        onClick={() => setArchiving(item)}
                        className="sc-btn sc-btn--outline h-auto min-h-11 shrink-0 rounded-(--radius-card) px-3.5 sm:px-5"
                      >
                        <ArchiveIcon />
                        {pl.archive}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
        {archiving && <ArchiveTournamentDialog tournament={archiving} onArchived={archived} onCancel={() => setArchiving(null)} />}
      </main>
    </div>
  );
}
