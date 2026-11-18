import type { MatchSnapshot, TournamentView } from '@autoscore/schema';
import { useMatch } from '../api/use-match';
import { useMatchLegs } from '../api/use-match-legs';
import { useMatchSummary } from '../api/use-match-summary';
import { useTournament } from '../api/use-tournament';
import { AppNav } from '../components/AppNav';
import { LegHistory } from '../components/LegHistory';
import { MatchComparisonTable } from '../components/MatchComparisonTable';
import { Notice } from '../components/Notice';
import { TournamentMatchHeader } from '../components/TournamentMatchHeader';
import { pl } from '../i18n/pl';
import type { UseMatchLegs } from '../api/use-match-legs';
import type { UseMatchSummary } from '../api/use-match-summary';

export interface TournamentMatchScreenProps {
  tournamentId: string;
  matchId: string;
}

function tournamentHref(tournamentId: string): string {
  return `#/tournaments/${encodeURIComponent(tournamentId)}`;
}

const loadingText = <p className="text-(--color-text-muted)">{pl.loading}</p>;

// Strona tylko do odczytu: bez komend gry. Nowy eventSeq z kanału meczu pobiera podsumowanie i legi jeszcze raz,
// a poprawki wyniku przychodzą z kanału turnieju.
export function TournamentMatchScreen({ tournamentId, matchId }: TournamentMatchScreenProps) {
  const tournament = useTournament(tournamentId);
  const { state, connection, notFound } = useMatch(matchId);
  const eventSeq = state?.eventSeq ?? null;
  const summary = useMatchSummary(matchId, eventSeq, state !== null);
  const legs = useMatchLegs(matchId, eventSeq);
  const missing = tournament.status === 'not_found' || notFound || (state !== null && state.tournament?.id !== tournamentId);

  let content;
  if (missing) {
    content = (
      <div className="flex flex-col items-start gap-3">
        <Notice text={pl.tournamentMatchNotFound} />
        <a
          href={tournamentHref(tournamentId)}
          className="inline-flex min-h-11 items-center text-lg text-(--color-text) underline underline-offset-4"
        >
          {pl.backToTournament}
        </a>
      </div>
    );
  } else if (tournament.status === 'error') {
    content = <Notice text={pl.loadTournamentFailed} />;
  } else if (tournament.view === null || state === null) {
    content = loadingText;
  } else {
    content = <MatchPage view={tournament.view} state={state} summary={summary} legs={legs} connectionLost={connection === 'closed'} />;
  }

  return (
    <div className="flex h-full flex-col">
      <AppNav current="tournament" />
      <main className="flex min-h-0 flex-1 flex-col gap-(--space-6) overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:px-(--space-page) lg:pt-6">
        {content}
      </main>
    </div>
  );
}

interface MatchPageProps {
  view: TournamentView;
  state: MatchSnapshot;
  summary: UseMatchSummary;
  legs: UseMatchLegs;
  connectionLost: boolean;
}

function MatchPage({ view, state, summary, legs, connectionLost }: MatchPageProps) {
  const fixture = view.fixtures.find((entry) => entry.id === state.tournament?.fixtureId);
  const names = new Map(state.players.map((player) => [player.id, player.name]));
  const [first, second] = state.players;
  return (
    <>
      <a
        href={tournamentHref(view.id)}
        className="inline-flex min-h-11 items-center gap-2 self-start font-display text-lg font-bold text-(--color-text-sub)"
      >
        <span aria-hidden="true" className="text-2xl leading-none">
          ‹
        </span>
        <span className="sr-only">{pl.backToTournament}</span> {view.name}
      </a>
      {connectionLost && !state.finished && <Notice text={pl.connectionLost} appearance="soft" />}
      <div className="grid grid-cols-1 content-start gap-(--space-6) lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start lg:gap-(--space-page)">
        <div className="min-w-0 lg:col-span-2">
          <TournamentMatchHeader state={state} fixture={fixture} />
        </div>
        {first && second && <MatchComparisonTable players={[first, second]} summary={summary.summary} error={summary.error} />}
        <LegHistory legs={legs.legs} error={legs.error} names={names} />
      </div>
    </>
  );
}
