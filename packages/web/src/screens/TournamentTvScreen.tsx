import type { Fixture, TournamentView } from '@autoscore/schema';
import type { ReactNode } from 'react';
import { useMatch, type Connection } from '../api/use-match';
import { useMatchSummary } from '../api/use-match-summary';
import { useRunningLegs } from '../api/use-running-legs';
import { useTournament } from '../api/use-tournament';
import { AppMark } from '../components/AppMark';
import { PauseIcon } from '../components/icons';
import { Notice } from '../components/Notice';
import { PlayoffBracket } from '../components/PlayoffBracket';
import { StandingsTable } from '../components/StandingsTable';
import { followCardShown, TvFollowCard, type TvPage } from '../components/TvFollowCard';
import { TvLiveMatch } from '../components/TvLiveMatch';
import { TvNextFixture } from '../components/TvNextFixture';
import { TvSideColumn } from '../components/TvSideColumn';
import { fixtureLabel } from '../game/fixture-label';
import { progressText, tournamentProgress } from '../game/tournament-progress';
import { pl } from '../i18n/pl';

export interface TournamentTvScreenProps {
  tournamentId: string;
  // Tylko dla testów: w jsdom adres strony to zawsze localhost.
  page?: TvPage;
}

const PILL =
  'inline-flex shrink-0 items-center gap-2.5 rounded-(--radius-pill) bg-(--color-surface-soft) px-4 py-2 font-display text-[length:clamp(16px,min(1.4vw,2.5vh),24px)] leading-none font-extrabold whitespace-nowrap shadow-(--shadow-inset-line)';

// Ekran tylko do odczytu dla dużego ekranu przy tarczy: bez klawiatury, głosu i przycisków.
export function TournamentTvScreen({ tournamentId, page = window.location }: TournamentTvScreenProps) {
  const { status, view, connection } = useTournament(tournamentId);
  const liveFixture = view?.fixtures.find((fixture) => fixture.id === view.liveFixtureId && fixture.matchId !== null);

  return (
    <main className="flex h-full flex-col gap-(--space-6) overflow-y-auto px-4 pt-4 pb-6 sm:px-8 lg:overflow-hidden lg:px-(--space-page) lg:py-6">
      {status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
      {status === 'error' && <Notice text={pl.loadTournamentFailed} />}
      {status === 'not_found' && (
        <div className="flex flex-col items-start gap-3">
          <Notice text={pl.tournamentNotFound} />
          <a href="#/tournaments" className="inline-flex min-h-11 items-center text-lg text-(--color-text) underline underline-offset-4">
            {pl.backToTournaments}
          </a>
        </div>
      )}
      {status === 'ready' &&
        view &&
        (liveFixture?.matchId ? (
          // Nowy mecz na żywo montuje TvLive od nowa, więc kanał poprzedniego meczu się zamyka.
          <TvLive
            key={liveFixture.matchId}
            view={view}
            fixture={liveFixture}
            matchId={liveFixture.matchId}
            connection={connection}
            page={page}
          />
        ) : (
          <TvIdle view={view} connection={connection} page={page} />
        ))}
    </main>
  );
}

interface TvHeaderProps {
  view: TournamentView;
  meta: string;
  badge: ReactNode;
}

function TvHeader({ view, meta, badge }: TvHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4.5 gap-y-2">
      <AppMark className="size-[clamp(32px,min(2.5vw,4.4vh),48px)]" />
      <h1 className="min-w-0 font-display text-[length:clamp(2rem,min(2.75vw,4.9vh),3.25rem)] leading-none font-black break-words">
        {view.name}
      </h1>
      <p className="font-display text-[length:clamp(18px,min(1.6vw,2.9vh),30px)] leading-tight font-bold text-(--color-text-muted)">
        {meta}
      </p>
      <span aria-hidden="true" className="grow" />
      {badge}
      <a
        href={`#/tournaments/${encodeURIComponent(view.id)}`}
        className="inline-flex min-h-11 items-center text-sm text-(--color-text-muted) underline underline-offset-4"
      >
        {pl.backToTournament}
      </a>
    </header>
  );
}

function ConnectionNotice({ closed }: { closed: boolean }) {
  return closed ? <Notice text={pl.connectionLost} appearance="soft" /> : null;
}

interface TvLiveProps {
  view: TournamentView;
  fixture: Fixture;
  matchId: string;
  connection: Connection;
  page: TvPage;
}

// Bez callbacku na żywo, więc bez głosu, efektów i komunikatów. Komend useMatch ekran nie wywołuje.
function TvLive({ view, fixture, matchId, connection, page }: TvLiveProps) {
  const { state, connection: matchConnection } = useMatch(matchId);
  const { summary } = useMatchSummary(matchId, state?.eventSeq ?? null, state !== null);

  let badge: ReactNode = null;
  if (state?.status === 'in_progress') {
    badge = (
      <span className={`${PILL} tracking-[0.12em] uppercase`}>
        <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-(--color-status-ok)" />
        {pl.tagLive}
      </span>
    );
  } else if (state?.status === 'abandoned') {
    badge = (
      <span className={PILL}>
        <PauseIcon className="text-(--color-accent)" />
        {pl.statusAbandoned}
      </span>
    );
  }

  return (
    <>
      <TvHeader view={view} meta={`${fixtureLabel(view.format, fixture)} · ${pl.tableLegsMeta(fixture.legsToWin)}`} badge={badge} />
      <ConnectionNotice closed={connection === 'closed' || matchConnection === 'closed'} />
      <div className="grid grid-cols-1 gap-(--space-page) lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_clamp(400px,calc(21.875vw+120px),470px)] lg:grid-rows-[minmax(0,1fr)]">
        <TvLiveMatch fixture={fixture} state={state} summary={summary} />
        <TvSideColumn view={view} page={page} />
      </div>
    </>
  );
}

interface TvIdleProps {
  view: TournamentView;
  connection: Connection;
  page: TvPage;
}

function TvIdle({ view, connection, page }: TvIdleProps) {
  const live = useRunningLegs(view);
  const progress = tournamentProgress(view);
  const table = view.format === 'league' || progress.phase === 'group';

  return (
    <>
      <TvHeader view={view} meta={progressText(progress)} badge={null} />
      <ConnectionNotice closed={connection === 'closed'} />
      <div className="flex shrink-0 flex-wrap gap-(--space-page)">
        <div className="min-w-0 flex-[1_1_24rem]">
          <TvNextFixture view={view} />
        </div>
        {followCardShown(view, page) && <TvFollowCard view={view} page={page} />}
      </div>
      <div className="min-h-0 overflow-auto max-lg:shrink-0 lg:flex-1">
        {table ? <StandingsTable view={view} variant="auto" /> : <PlayoffBracket view={view} live={live} />}
      </div>
    </>
  );
}
