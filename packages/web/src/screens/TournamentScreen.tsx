import type { FixtureSlot, TournamentView } from '@autoscore/schema';
import { useEffect, useState } from 'react';
import { ApiRequestError, getTournament } from '../api/client';
import { AppNav } from '../components/AppNav';
import { Notice } from '../components/Notice';
import { FORMAT_LABELS } from '../game/tournament-setup';
import { pl } from '../i18n/pl';

type Loaded = { status: 'loading' } | { status: 'not_found' } | { status: 'error' } | { status: 'ready'; view: TournamentView };

export interface TournamentScreenProps {
  tournamentId: string;
}

function slotText(slot: FixtureSlot, view: TournamentView): string {
  if (slot.kind === 'player') {
    return view.players.find((player) => player.id === slot.playerId)?.name ?? pl.slotPending;
  }
  return slot.kind === 'bye' ? pl.slotBye : pl.slotPending;
}

// Zaślepka ekranu turnieju: nazwa i lista meczów, bez akcji i bez aktualizacji na żywo.
export function TournamentScreen({ tournamentId }: TournamentScreenProps) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getTournament(tournamentId).then(
      (view) => {
        if (!cancelled) {
          setLoaded({ status: 'ready', view });
        }
      },
      (caught: unknown) => {
        if (!cancelled) {
          setLoaded({ status: caught instanceof ApiRequestError && caught.status === 404 ? 'not_found' : 'error' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  return (
    <div className="flex h-full flex-col">
      <AppNav current="tournament" />
      <main className="flex min-h-0 flex-1 flex-col gap-(--space-6) overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:px-(--space-page) lg:pt-6">
        {loaded.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {loaded.status === 'error' && <Notice text={pl.loadTournamentFailed} />}
        {loaded.status === 'not_found' && (
          <div className="flex flex-col items-start gap-3">
            <Notice text={pl.tournamentNotFound} />
            <a href="#/tournaments" className="inline-flex min-h-11 items-center text-lg text-(--color-text) underline underline-offset-4">
              {pl.backToTournaments}
            </a>
          </div>
        )}
        {loaded.status === 'ready' && <Fixtures view={loaded.view} />}
      </main>
    </div>
  );
}

function Fixtures({ view }: { view: TournamentView }) {
  const fixtures = [...view.fixtures].sort((first, second) => first.number - second.number);
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[length:clamp(2.5rem,10vw,4rem)] leading-[0.9] font-black tracking-[0.01em] break-words">
          {view.name}
        </h1>
        <p className="text-[17px] text-(--color-text-sub)">{pl.tournamentMeta(FORMAT_LABELS[view.format], view.config.startingScore)}</p>
      </div>
      <section aria-labelledby="tournament-fixtures" className="flex flex-col gap-3">
        <h2
          id="tournament-fixtures"
          className="font-display text-(length:--text-label) font-bold tracking-[0.18em] text-(--color-text-muted) uppercase"
        >
          {pl.tournamentMatches}
        </h2>
        <ol className="flex flex-col gap-2">
          {fixtures.map((fixture) => (
            <li
              key={fixture.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-(--radius-card) bg-(--color-surface-softer) px-4 py-3 shadow-(--shadow-inset-line)"
            >
              <span className="w-20 shrink-0 font-display text-lg font-bold text-(--color-text-muted)">
                {pl.fixtureNumber(fixture.number)}
              </span>
              <span className="min-w-0 flex-1 basis-56 font-display text-xl font-bold">
                {slotText(fixture.slots[0], view)} {pl.versus} {slotText(fixture.slots[1], view)}
              </span>
              {fixture.result && (
                <span className="font-display text-xl font-extrabold tabular-nums">
                  {pl.legsState(fixture.result.legs[0], fixture.result.legs[1])}
                </span>
              )}
              <span className="text-(--color-text-sub)">{pl.fixtureStatus[fixture.status]}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
