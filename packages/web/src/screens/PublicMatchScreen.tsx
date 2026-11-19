import type { PublicTournamentMatch, PublicTournamentView } from '@autoscore/schema';
import { getPublicTournament, getPublicTournamentMatch } from '../api/client';
import { usePublicPoll } from '../api/use-public-poll';
import { LegHistory } from '../components/LegHistory';
import { MatchComparisonTable } from '../components/MatchComparisonTable';
import { Notice } from '../components/Notice';
import { PublicBrand } from '../components/PublicBrand';
import { TournamentMatchHeader } from '../components/TournamentMatchHeader';
import { publicTournamentHref } from '../game/tournament-match-href';
import { pl } from '../i18n/pl';

export interface PublicMatchScreenProps {
  tournamentId: string;
  matchId: string;
}

const loadingText = <p className="text-(--color-text-muted)">{pl.loading}</p>;

// Jak prywatna strona meczu, ale z publicznego API odpytywanego co 10 s, bez logowania, nawigacji i komend.
// Wynik po korekcie i walkower bierze z publicznego widoku turnieju.
export function PublicMatchScreen({ tournamentId, matchId }: PublicMatchScreenProps) {
  const tournament = usePublicPoll(() => getPublicTournament(tournamentId), [tournamentId]);
  const match = usePublicPoll(() => getPublicTournamentMatch(tournamentId, matchId), [tournamentId, matchId]);

  let content;
  if (tournament.status === 'not_found') {
    content = <Notice text={pl.publicNotShared} />;
  } else if (match.status === 'not_found') {
    content = (
      <div className="flex flex-col items-start gap-3">
        <Notice text={pl.tournamentMatchNotFound} />
        <a
          href={publicTournamentHref(tournamentId)}
          className="inline-flex min-h-11 items-center text-lg text-(--color-text) underline underline-offset-4"
        >
          {pl.backToTournament}
        </a>
      </div>
    );
  } else if (tournament.status === 'error') {
    content = <Notice text={pl.loadTournamentFailed} />;
  } else if (match.status === 'error') {
    content = <Notice text={pl.loadMatchFailed} />;
  } else if (tournament.data === null || match.data === null) {
    content = loadingText;
  } else {
    content = (
      <>
        {(tournament.refreshFailed || match.refreshFailed) && <Notice text={pl.publicRefreshFailed} tone="status" appearance="soft" />}
        <MatchPage view={tournament.data} data={match.data} />
      </>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PublicBrand />
      <main className="flex min-h-0 flex-1 flex-col gap-(--space-6) overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:px-(--space-page) lg:pt-6">
        {content}
      </main>
    </div>
  );
}

// Statystyki i przebieg legów zawsze z rozegranych rzutek, więc pokazują mecz tak, jak go rozegrano.
function MatchPage({ view, data }: { view: PublicTournamentView; data: PublicTournamentMatch }) {
  const fixture = view.fixtures.find((entry) => entry.id === data.fixtureId);
  const players = data.match.players;
  const names = new Map(players.map((player) => [player.id, player.name]));
  const [first, second] = players;
  return (
    <>
      <a
        href={publicTournamentHref(view.id)}
        className="inline-flex min-h-11 items-center gap-2 self-start font-display text-lg font-bold text-(--color-text-sub)"
      >
        <span aria-hidden="true" className="text-2xl leading-none">
          ‹
        </span>
        <span className="sr-only">{pl.backToTournament}</span> {view.name}
      </a>
      <div className="grid grid-cols-1 content-start gap-(--space-6) lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start lg:gap-(--space-page)">
        <div className="min-w-0 lg:col-span-2">
          <TournamentMatchHeader match={data.match} label={data.label} legNumber={Math.max(1, data.legs.legs.length)} fixture={fixture} />
        </div>
        {first && second && <MatchComparisonTable players={[first, second]} summary={data.summary} error={false} />}
        <LegHistory legs={data.legs} error={false} names={names} />
      </div>
    </>
  );
}
