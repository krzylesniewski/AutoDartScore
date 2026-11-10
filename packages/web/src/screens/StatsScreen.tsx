import type { MatchListItem, Player, PlayerForm, PlayerStats, StatsFilter, StatsOverall, StatsRankings } from '@autoscore/schema';
import { Fragment, useEffect, useState, type DependencyList } from 'react';
import { ApiRequestError, getOverall, getPlayerForm, getPlayerStats, getRankings, listMatches, listPlayers } from '../api/client';
import { AppNav } from '../components/AppNav';
import { Avatar } from '../components/Avatar';
import { FormChart } from '../components/FormChart';
import { HeadToHeadPanel } from '../components/HeadToHeadPanel';
import { MatchHistoryList } from '../components/MatchHistoryList';
import { OverallBoard } from '../components/OverallBoard';
import { PlayerProfile } from '../components/PlayerProfile';
import { RankingBoard } from '../components/RankingBoard';
import { WarningIcon } from '../components/icons';
import { formatAverage, formatBestLeg, formatDoublesParts, formatNumber } from '../game/format-stat';
import { pl } from '../i18n/pl';

const RANKING_HREF = '#/stats';

interface FilterOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

const FILTERS: readonly FilterOption<StatsFilter>[] = [
  { value: 'all', label: pl.filterAll },
  { value: 'match', label: pl.filterMatch },
  { value: 'casual', label: pl.typeCasual },
  { value: 'practice', label: pl.typePractice },
];

// Overall to widok ekranu rankingu, a nie filtr statystyk, więc karta gracza go nie ma.
type RankingView = StatsFilter | 'overall';

const RANKING_VIEWS: readonly FilterOption<RankingView>[] = [...FILTERS, { value: 'overall', label: pl.filterOverall }];

const label = 'font-display text-[15px] font-bold tracking-[0.18em] text-(--color-text-muted) uppercase';
const title = 'font-display text-[length:clamp(2.5rem,10vw,4rem)] leading-[0.9] font-black tracking-[0.01em]';
const panelHeading = 'font-display text-[26px] leading-tight font-extrabold';
// Poniżej sm przyciski filtra dzielą szerokość paska. Bez min-w-0 przycisk nie jest węższy od etykiety,
// a pięć przycisków przewija się w pasku zamiast przycinać.
const segment = 'min-h-12 whitespace-nowrap rounded-(--radius-button) px-5 font-display text-xl max-sm:flex-1 max-sm:px-3 max-sm:text-lg';
const selectedStyle = 'bg-(--color-text) font-extrabold text-(--color-text-inverse) shadow-(--shadow-selected)';

function segmentStyle(selected: boolean): string {
  return `${segment} ${selected ? selectedStyle : 'bg-transparent font-bold text-(--color-text)'}`;
}

function chipStyle(selected: boolean): string {
  return `flex min-h-11 max-w-full items-center gap-2 rounded-(--radius-button) pr-4 pl-2 font-display text-[19px] ${selected ? selectedStyle : 'bg-(--color-surface-soft) font-bold text-(--color-text) shadow-(--shadow-inset-line)'}`;
}

function statsHref(playerId: string): string {
  return `#/stats/${encodeURIComponent(playerId)}`;
}

function statItems(stats: PlayerStats): { term: string; value: string; detail?: string }[] {
  const doubles = formatDoublesParts(stats);
  return [
    { term: pl.dartsThrown, value: String(stats.dartsThrown) },
    { term: pl.statAverage, value: formatAverage(stats.average) },
    { term: pl.statFirst9, value: formatAverage(stats.first9Average) },
    { term: pl.stat180, value: String(stats.scores180) },
    { term: pl.stat140, value: String(stats.scores140) },
    { term: pl.stat100, value: String(stats.scores100) },
    { term: pl.stat60, value: String(stats.scores60) },
    { term: pl.statHighestCheckout, value: formatNumber(stats.highestCheckout) },
    { term: pl.statDoubles, value: doubles.value, ...(doubles.detail === null ? {} : { detail: doubles.detail }) },
    { term: pl.statBestLeg, value: formatBestLeg(stats.bestLegDarts) },
    { term: pl.statLegsWon, value: String(stats.legsWon) },
    { term: pl.statMatchesWon, value: `${stats.matchesWon}/${stats.matchesPlayed}` },
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

interface FilterButtonsProps<T extends string> {
  options: readonly FilterOption<T>[];
  filter: T;
  onChange(filter: NoInfer<T>): void;
  labelledBy: string;
  // Opcja, przed którą stoi kreska oddzielająca, np. Overall jako widok, a nie filtr.
  dividerBefore?: NoInfer<T>;
}

function FilterButtons<T extends string>({ options, filter, onChange, labelledBy, dividerBefore }: FilterButtonsProps<T>) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="sc-seg w-fit flex-wrap max-sm:w-full max-sm:flex-nowrap max-sm:overflow-x-auto">
      {options.map((option) => (
        <Fragment key={option.value}>
          {option.value === dividerBefore && <span aria-hidden="true" className="mx-1 my-2 w-px shrink-0 self-stretch bg-(--color-border)" />}
          <button type="button" aria-pressed={filter === option.value} onClick={() => onChange(option.value)} className={segmentStyle(filter === option.value)}>
            {option.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}

type RankingData = { view: 'overall'; overall: StatsOverall } | { view: 'ranking'; rankings: StatsRankings };

function loadView(view: RankingView): Promise<RankingData> {
  if (view === 'overall') {
    return getOverall().then((overall) => ({ view: 'overall', overall }));
  }
  return getRankings(view).then((rankings) => ({ view: 'ranking', rankings }));
}

function Ranking() {
  const [view, setView] = useState<RankingView>('all');
  const data = useLoaded<RankingData>(() => loadView(view), pl.statsFailed, [view]);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-(--space-6) overflow-auto px-4 pt-4 pb-6 sm:px-8 lg:px-(--space-page) lg:pt-6 xl:overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-8">
        <div className="flex flex-col gap-2">
          <h1 className={title}>{pl.stats}</h1>
          {data.status === 'ready' && (
            <p className="text-[17px] text-(--color-text-sub)">
              {data.value.view === 'overall' ? pl.overallSubtitle : pl.rankingSubtitle(data.value.rankings.games, data.value.rankings.legs)}
            </p>
          )}
        </div>
        <section aria-labelledby="ranking-filter" className="flex flex-col gap-2 max-sm:w-full sm:items-end">
          <h2 id="ranking-filter" className={`${label} sm:mr-1.5`}>
            {pl.gameType}
          </h2>
          <FilterButtons options={RANKING_VIEWS} filter={view} onChange={setView} labelledBy="ranking-filter" dividerBefore="overall" />
        </section>
      </div>
      {data.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
      {data.status === 'error' && <ErrorText text={data.message} />}
      {data.status === 'ready' && <RankingContent data={data.value} />}
    </main>
  );
}

function RankingContent({ data }: { data: RankingData }) {
  const empty = data.view === 'overall' ? data.overall.darts === 0 : data.rankings.games === 0;
  if (empty) {
    return <p className="font-display text-2xl text-(--color-text-muted)">{pl.noGamesInFilter}</p>;
  }
  return data.view === 'overall' ? <OverallBoard overall={data.overall} /> : <RankingBoard rankings={data.rankings} />;
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
  const current = known.find((player) => player.id === playerId);

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
    <main className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6 xl:max-w-none xl:px-(--space-page)">
        <div className="flex flex-wrap items-baseline justify-between gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-2">
          <a href={RANKING_HREF} className="inline-flex min-h-11 items-center gap-1 font-display text-xl font-bold text-(--color-text-sub) underline underline-offset-4 sm:order-last">
            <span aria-hidden="true" className="sm:hidden">←</span>
            {pl.ranking}
          </a>
          <h1 className={title}>{pl.stats}</h1>
        </div>

        {current && <PlayerProfile player={current} onChanged={() => setVersion((value) => value + 1)} />}

        <section className="flex flex-col gap-2">
          <h2 className={label}>{pl.players}</h2>
          {players.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
          {players.status === 'error' && <ErrorText text={players.message} />}
          {players.status === 'ready' && players.value.length === 0 && <p className="text-(--color-text-muted)">{pl.noPlayers}</p>}
          {players.status === 'ready' && (
            <div className="flex flex-wrap gap-2 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:p-1">
              {players.value.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  aria-pressed={player.id === playerId}
                  onClick={() => {
                    window.location.hash = statsHref(player.id);
                  }}
                  className={`${chipStyle(player.id === playerId)} max-sm:shrink-0`}
                >
                  <Avatar name={player.name} avatar={player.avatar} color={player.color} />
                  <span className="min-w-0 truncate">{player.name}</span>
                  {player.archivedAt !== null && <span className="text-base font-semibold opacity-75">{pl.archived}</span>}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 id="stats-filter" className={label}>
            {pl.statsFilter}
          </h2>
          <FilterButtons options={FILTERS} filter={filter} onChange={setFilter} labelledBy="stats-filter" />
        </section>

        {/* Na monitorze dwie kolumny jak w makiecie, niżej jedna w tej samej kolejności. */}
        <div className="flex flex-col gap-5 sm:gap-6 xl:grid xl:grid-cols-[minmax(0,9fr)_minmax(0,7fr)] xl:items-start">
          <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
            <StatsCard stats={stats} />

            <section aria-labelledby="player-form" className="sc-panel">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="player-form" className={panelHeading}>
                  {pl.form}
                </h2>
                <span className="text-sm text-(--color-text-muted)">{pl.formSubtitle}</span>
              </div>
              {form.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
              {form.status === 'error' && <ErrorText text={form.message} />}
              {form.status === 'ready' && <FormChart points={form.value.points} />}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
            {current && <HeadToHeadPanel key={playerId} player={current} opponents={known.filter((player) => player.id !== playerId)} />}

            <section aria-labelledby="player-history" className="sc-panel sc-panel--flat gap-2.5">
              <h2 id="player-history" className={panelHeading}>
                {pl.playerHistory}
              </h2>
              {history.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
              {history.status === 'error' && <ErrorText text={history.message} />}
              {history.status === 'ready' && <MatchHistoryList games={history.value} now={new Date()} />}
            </section>
          </div>
        </div>
      </div>
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
  // Na telefonie jedna lista w płaskim panelu, od sm osobne kafelki.
  return (
    <dl className="grid grid-cols-1 max-sm:rounded-(--radius-card) max-sm:bg-(--color-surface-softer) max-sm:px-5 max-sm:py-1 max-sm:shadow-(--shadow-inset-line) sm:grid-cols-3 sm:gap-2.5 xl:grid-cols-4">
      {statItems(stats.value).map(({ term, value, detail }) => (
        <div
          key={term}
          className="flex flex-col gap-1 max-sm:flex-row max-sm:items-baseline max-sm:justify-between max-sm:gap-4 max-sm:border-b max-sm:border-(--color-border) max-sm:py-2.5 max-sm:last:border-b-0 sm:min-h-20 sm:justify-between sm:rounded-(--radius-card) sm:bg-(--color-surface-softer) sm:px-4.5 sm:py-3 sm:shadow-(--shadow-inset-line)"
        >
          <dt className="min-w-0 font-display text-sm font-bold tracking-(--tracking-label) text-(--color-text-muted) uppercase">{term}</dt>
          <dd className="font-display text-[32px] leading-none font-extrabold whitespace-nowrap tabular-nums max-sm:shrink-0 max-sm:text-right max-sm:text-2xl">
            {value}
            {detail && <span className="text-lg font-semibold text-(--color-text-muted) max-sm:block max-sm:text-base max-sm:font-normal"> {detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 font-display text-xl text-(--color-text)">
      <WarningIcon className="text-(--color-accent)" />
      {text}
    </p>
  );
}
