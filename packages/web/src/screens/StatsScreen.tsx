import type { Player, PlayerStats, StatsFilter } from '@autoscore/schema';
import { useEffect, useState } from 'react';
import { ApiRequestError, getPlayerStats, listPlayers } from '../api/client';
import { WarningIcon } from '../components/icons';
import { formatAverage, formatBestLeg, formatDoubles, formatNumber } from '../game/format-stat';
import { pl } from '../i18n/pl';

const NEW_GAME_HREF = '#/new';

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

export function StatsScreen({ playerId }: { playerId: string | null }) {
  const [players, setPlayers] = useState<Loaded<Player[]>>({ status: 'loading' });
  const [filter, setFilter] = useState<StatsFilter>('all');
  const [stats, setStats] = useState<Loaded<PlayerStats>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    listPlayers().then(
      (value) => {
        if (!cancelled) {
          setPlayers({ status: 'ready', value });
        }
      },
      () => {
        if (!cancelled) {
          setPlayers({ status: 'error', message: pl.loadPlayersFailed });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = playerId ?? (players.status === 'ready' ? (players.value[0]?.id ?? null) : null);

  useEffect(() => {
    if (selected === null) {
      return;
    }
    let cancelled = false;
    setStats({ status: 'loading' });
    getPlayerStats(selected, filter).then(
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
  }, [selected, filter]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-5xl font-bold uppercase">{pl.stats}</h1>
        <a href={NEW_GAME_HREF} className="font-display text-xl font-semibold uppercase text-(--color-text) underline">
          {pl.newGame}
        </a>
      </div>

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
                aria-pressed={player.id === selected}
                onClick={() => {
                  window.location.hash = statsHref(player.id);
                }}
                className={`${choiceStyle(player.id === selected)} flex items-center gap-2`}
              >
                {player.avatar && <span aria-hidden="true">{player.avatar}</span>}
                {player.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={label}>{pl.statsFilter}</h2>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)} className={choiceStyle(filter === option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {selected !== null && <StatsCard stats={stats} />}
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
