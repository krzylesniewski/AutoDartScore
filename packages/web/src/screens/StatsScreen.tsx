import type { MatchListItem, Player, PlayerForm, PlayerStats, StatsFilter, StatsRankings } from '@autoscore/schema';
import { useEffect, useState, type DependencyList } from 'react';
import { ApiRequestError, getPlayerForm, getPlayerStats, getRankings, listMatches, listPlayers } from '../api/client';
import { AppNav } from '../components/AppNav';
import { FormChart } from '../components/FormChart';
import { HeadToHeadPanel } from '../components/HeadToHeadPanel';
import { MatchHistoryList } from '../components/MatchHistoryList';
import { PlayerProfile } from '../components/PlayerProfile';
import { RankingBoard } from '../components/RankingBoard';
import { WarningIcon } from '../components/icons';
import { formatAverage, formatBestLeg, formatDoubles, formatNumber } from '../game/format-stat';
import { pl } from '../i18n/pl';

const RANKING_HREF = '#/stats';

const FILTERS: readonly { value: StatsFilter; label: string }[] = [
  { value: 'all', label: pl.filterAll },
  { value: 'match', label: pl.filterMatch },
  { value: 'casual', label: pl.typeCasual },
  { value: 'practice', label: pl.typePractice },
];

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const choice = 'min-h-12 rounded-(--radius-card) border-(length:--border-width) px-4 font-display text-xl';

function choiceStyle(selected: boolean): string {
  return `${choice} ${selected ? 'border-(--color-text) bg-(--color-text) text-(--color-text-inverse)' : 'border-(--color-border-strong) bg-(--color-surface) text-(--color-text)'}`;
}

function statsHref(playerId: string): string {
  return `#/stats/${encodeURIComponent(playerId)}`;
}

function statItems(stats: PlayerStats): readonly [string, string][] {
  return [
    [pl.dartsThrown, String(stats.dartsThrown)],
    [pl.statAverage, formatAverage(stats.average)],
    [pl.statFirst9, formatAverage(stats.first9Average)],
    [pl.stat180, String(stats.scores180)],
    [pl.stat140, String(stats.scores140)],
    [pl.stat100, String(stats.scores100)],
    [pl.stat60, String(stats.scores60)],
    [pl.statHighestCheckout, formatNumber(stats.highestCheckout)],
    [pl.statDoubles, formatDoubles(stats)],
    [pl.statBestLeg, formatBestLeg(stats.bestLegDarts)],
    [pl.statLegsWon, String(stats.legsWon)],
    [pl.statMatchesWon, `${stats.matchesWon}/${stats.matchesPlayed}`],
  ];
}

type Loaded<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; message: string };

// Pobiera od nowa przy zmianie deps, a nie load, bo load to nowa funkcja przy każdym renderze.
// Odpowiedź starego zapytania jest pomijana. keepPrevious zostawia poprzednią wartość do czasu nowej odpowiedzi.
function useLoaded<T>(load: () => Promise<T>, errorMessage: string, deps: DependencyList, keepPrevious = false): Loaded<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    setLoaded((previous) => (keepPrevious && previous.status === 'ready' ? previous : { status: 'loading' }));
    load().then(
      (value) => {
        if (!cancelled) {
          setLoaded({ status: 'ready', value });
        }
      },
      () => {
        if (!cancelled) {
          setLoaded({ status: 'error', message: errorMessage });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, deps);
  return loaded;
}

export function StatsScreen({ playerId }: { playerId: string | null }) {
  return (
    <div className="flex h-full flex-col">
      <AppNav current="stats" />
      {playerId === null ? <Ranking /> : <PlayerCard playerId={playerId} />}
    </div>
  );
}

function FilterButtons({ filter, onChange }: { filter: StatsFilter; onChange(filter: StatsFilter): void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {FILTERS.map((option) => (
        <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => onChange(option.value)} className={choiceStyle(filter === option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Ranking() {
  const [filter, setFilter] = useState<StatsFilter>('all');
  const [rankings, setRankings] = useState<Loaded<StatsRankings>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setRankings({ status: 'loading' });
    getRankings(filter).then(
      (value) => {
        if (!cancelled) {
          setRankings({ status: 'ready', value });
        }
      },
      () => {
        if (!cancelled) {
          setRankings({ status: 'error', message: pl.statsFailed });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:px-12 lg:pt-7 lg:pb-8 xl:overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[length:clamp(2.5rem,10vw,3.5rem)] leading-none font-bold uppercase">{pl.stats}</h1>
          {rankings.status === 'ready' && <p className="text-[17px] text-(--color-text-muted)">{pl.rankingSubtitle(rankings.value.games, rankings.value.legs)}</p>}
        </div>
        <section aria-labelledby="ranking-filter" className="flex flex-col gap-2.5">
          <h2 id="ranking-filter" className={label}>
            {pl.gameType}
          </h2>
          <FilterButtons filter={filter} onChange={setFilter} />
        </section>
      </div>
      {rankings.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
      {rankings.status === 'error' && <ErrorText text={rankings.message} />}
      {rankings.status === 'ready' && rankings.value.games === 0 && <p className="font-display text-2xl text-(--color-text-muted)">{pl.noGamesInFilter}</p>}
      {rankings.status === 'ready' && rankings.value.games > 0 && <RankingBoard rankings={rankings.value} />}
    </main>
  );
}

function PlayerCard({ playerId }: { playerId: string }) {
  // Zmiana profilu zwiększa version, co odświeża chipy graczy, profil i historię z nowym imieniem.
  // Lista graczy zostaje na ekranie w trakcie odświeżania, więc profil i wybrany rywal nie znikają.
  const [version, setVersion] = useState(0);
  const players = useLoaded<Player[]>(() => listPlayers({ archived: 'include' }), pl.loadPlayersFailed, [version], true);
  const [filter, setFilter] = useState<StatsFilter>('all');
  const [stats, setStats] = useState<Loaded<PlayerStats>>({ status: 'loading' });
  const form = useLoaded<PlayerForm>(() => getPlayerForm(playerId, filter), pl.formFailed, [playerId, filter]);
  const history = useLoaded<MatchListItem[]>(() => listMatches({ playerId }), pl.loadMatchesFailed, [playerId, version]);
  const known = players.status === 'ready' ? players.value : [];
  const colorIndex = known.findIndex((player) => player.id === playerId);
  const current = known[colorIndex];

  useEffect(() => {
    let cancelled = false;
    setStats({ status: 'loading' });
    getPlayerStats(playerId, filter).then(
      (value) => {
        if (!cancelled) {
          setStats({ status: 'ready', value });
        }
      },
      (caught: unknown) => {
        if (!cancelled) {
          const missing = caught instanceof ApiRequestError && caught.status === 404;
          setStats({ status: 'error', message: missing ? pl.playerNotFound : pl.statsFailed });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [playerId, filter]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 overflow-auto p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-[length:clamp(2.25rem,9vw,3rem)] leading-none font-bold uppercase">{pl.stats}</h1>
        <a href={RANKING_HREF} className="font-display text-xl font-semibold uppercase text-(--color-text) underline">
          {pl.ranking}
        </a>
      </div>

      {current && <PlayerProfile player={current} colorIndex={colorIndex} onChanged={() => setVersion((value) => value + 1)} />}

      <section className="flex flex-col gap-2">
        <h2 className={label}>{pl.players}</h2>
        {players.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {players.status === 'error' && <ErrorText text={players.message} />}
        {players.status === 'ready' && players.value.length === 0 && <p className="text-(--color-text-muted)">{pl.noPlayers}</p>}
        {players.status === 'ready' && (
          <div className="flex flex-wrap gap-2">
            {players.value.map((player) => (
              <button
                key={player.id}
                type="button"
                aria-pressed={player.id === playerId}
                onClick={() => {
                  window.location.hash = statsHref(player.id);
                }}
                className={`${choiceStyle(player.id === playerId)} flex max-w-full items-center gap-2`}
              >
                {player.avatar && <span aria-hidden="true">{player.avatar}</span>}
                <span className="min-w-0 truncate">{player.name}</span>
                {player.archivedAt !== null && <span className="text-base text-(--color-text-muted) uppercase">{pl.archived}</span>}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={label}>{pl.statsFilter}</h2>
        <FilterButtons filter={filter} onChange={setFilter} />
      </section>

      <StatsCard stats={stats} />

      <section aria-labelledby="player-form" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="player-form" className={label}>
            {pl.form}
          </h2>
          <span className="text-[15px] text-(--color-text-muted)">{pl.formSubtitle}</span>
        </div>
        {form.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {form.status === 'error' && <ErrorText text={form.message} />}
        {form.status === 'ready' && <FormChart points={form.value.points} />}
      </section>

      {current && <HeadToHeadPanel key={playerId} player={current} opponents={known.filter((player) => player.id !== playerId)} />}

      <section aria-labelledby="player-history" className="flex flex-col gap-2">
        <h2 id="player-history" className={label}>
          {pl.playerHistory}
        </h2>
        {history.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {history.status === 'error' && <ErrorText text={history.message} />}
        {history.status === 'ready' && <MatchHistoryList games={history.value} now={new Date()} />}
      </section>
    </main>
  );
}

function StatsCard({ stats }: { stats: Loaded<PlayerStats> }) {
  if (stats.status === 'loading') {
    return <p className="text-(--color-text-muted)">{pl.loading}</p>;
  }
  if (stats.status === 'error') {
    return <ErrorText text={stats.message} />;
  }
  if (stats.value.dartsThrown === 0) {
    return <p className="font-display text-2xl text-(--color-text-muted)">{pl.noThrows}</p>;
  }
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) p-5 sm:grid-cols-3">
      {statItems(stats.value).map(([term, value]) => (
        <div key={term} className="flex flex-col gap-1">
          <dt className={label}>{term}</dt>
          <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 font-display text-xl text-(--color-accent)">
      <WarningIcon />
      {text}
    </p>
  );
}
