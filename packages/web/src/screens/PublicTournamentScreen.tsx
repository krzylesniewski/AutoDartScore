import type { PublicTournamentView } from '@autoscore/schema';
import { useId, useState } from 'react';
import { getPublicTournament, getPublicTournamentStats } from '../api/client';
import { usePublicPoll } from '../api/use-public-poll';
import type { RunningLegs } from '../api/use-running-legs';
import { useTournamentStats } from '../api/use-tournament-stats';
import { MatchHrefContext } from '../components/match-href-context';
import { Notice } from '../components/Notice';
import { PlacementsCard } from '../components/PlacementsCard';
import { PlayoffBracket } from '../components/PlayoffBracket';
import { PublicBrand } from '../components/PublicBrand';
import { PublicMatchList } from '../components/PublicMatchList';
import { PublicPodium } from '../components/PublicPodium';
import { StandingsTable } from '../components/StandingsTable';
import { TournamentStatsPanel } from '../components/TournamentStatsPanel';
import { TournamentTabs, type TournamentTab } from '../components/TournamentTabs';
import { publicTournamentMatchHref } from '../game/tournament-match-href';
import { FORMAT_LABELS } from '../game/tournament-setup';
import { pl } from '../i18n/pl';

export interface PublicTournamentScreenProps {
  tournamentId: string;
}

type TabId = 'results' | 'table' | 'playoff' | 'stats';

// Publiczny podgląd nie pyta o legi trwających meczów. Wynik na żywo jest na publicznej stronie meczu.
const NO_LIVE: ReadonlyMap<string, RunningLegs> = new Map();

function formatTabs(view: PublicTournamentView): TournamentTab<TabId>[] {
  switch (view.format) {
    case 'league':
      return [{ id: 'table', label: pl.tabTable }];
    case 'group_playoff':
      return [
        { id: 'table', label: pl.tabGroup },
        { id: 'playoff', label: pl.tabPlayoff },
      ];
    default:
      return [{ id: 'playoff', label: pl.tabBracket }];
  }
}

function tabsFor(view: PublicTournamentView): TournamentTab<TabId>[] {
  return [{ id: 'results', label: pl.tabResults }, ...formatTabs(view), { id: 'stats', label: pl.tabStats }];
}

function metaLine(view: PublicTournamentView): string {
  const status = view.status === 'finished' ? pl.publicStatusFinished : pl.publicStatusInProgress;
  return [status, FORMAT_LABELS[view.format], pl.publicPlayers(view.players.length), String(view.config.startingScore)].join(' · ');
}

// Bez logowania, bez nawigacji aplikacji i bez żadnej komendy. Dane przychodzą z publicznego API co 10 s.
export function PublicTournamentScreen({ tournamentId }: PublicTournamentScreenProps) {
  const { status, data, refreshFailed } = usePublicPoll(() => getPublicTournament(tournamentId), [tournamentId]);

  return (
    <div className="flex h-full flex-col">
      <PublicBrand />
      <main className="flex min-h-0 flex-1 flex-col gap-(--space-6) overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:px-(--space-page) lg:pt-6">
        {status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {status === 'not_found' && <Notice text={pl.publicNotShared} />}
        {status === 'error' && <Notice text={pl.loadTournamentFailed} />}
        {status === 'ready' && data && (
          <MatchHrefContext value={publicTournamentMatchHref}>
            {refreshFailed && <Notice text={pl.publicRefreshFailed} tone="status" appearance="soft" />}
            <Tournament view={data} />
          </MatchHrefContext>
        )}
      </main>
    </div>
  );
}

function Tournament({ view }: { view: PublicTournamentView }) {
  const baseId = useId();
  const [tab, setTab] = useState<TabId>('results');
  const tabId = (id: TabId) => `${baseId}-tab-${id}`;
  const panelId = (id: TabId) => `${baseId}-panel-${id}`;

  return (
    <>
      <header className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-[length:clamp(2.5rem,8vw,3.5rem)] leading-[0.9] font-black break-words">{view.name}</h1>
          <p className="text-[15px] text-(--color-text-sub) tabular-nums">{metaLine(view)}</p>
        </div>
        <TournamentTabs<TabId> tabs={tabsFor(view)} selected={tab} onSelect={setTab} tabId={tabId} panelId={panelId} />
      </header>
      <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} tabIndex={0} className="min-w-0">
        <Panel view={view} tab={tab} />
      </div>
    </>
  );
}

function Panel({ view, tab }: { view: PublicTournamentView; tab: TabId }) {
  switch (tab) {
    case 'results':
      return (
        <div className="grid grid-cols-1 content-start gap-(--space-page) lg:grid-cols-2 lg:items-start">
          <div className="flex min-w-0 flex-col gap-(--space-page)">
            {view.status === 'finished' && <PublicPodium view={view} />}
            <PublicMatchList view={view} />
          </div>
          {view.format !== 'cup' && <StandingsTable view={view} variant="short" />}
        </div>
      );
    case 'table':
      return <StandingsTable view={view} />;
    case 'playoff':
      return (
        <div className="flex min-w-0 flex-col gap-(--space-page)">
          <PlayoffBracket view={view} live={NO_LIVE} />
          <PlacementsCard view={view} />
        </div>
      );
    default:
      return <PublicStats view={view} />;
  }
}

// Montuje się dopiero na zakładce „Statystyki”. Każdy odpytany widok to nowy obiekt, więc statystyki odświeżają się razem z nim.
function PublicStats({ view }: { view: PublicTournamentView }) {
  const { status, stats } = useTournamentStats(view, getPublicTournamentStats);
  if (status === 'loading') {
    return <p className="text-(--color-text-muted)">{pl.loading}</p>;
  }
  return (
    <div className="flex flex-col gap-(--space-6)">
      {status === 'error' && <Notice text={pl.loadTournamentStatsFailed} />}
      {stats && <TournamentStatsPanel view={view} stats={stats} />}
    </div>
  );
}
