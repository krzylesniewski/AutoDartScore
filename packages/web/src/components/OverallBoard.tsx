import type { OverallPlayer, StatsOverall } from '@autoscore/schema';
import type { ReactNode } from 'react';
import { formatAverage, formatDifference } from '../game/format-stat';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { ArrowDownIcon, ArrowUpIcon } from './icons';

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const surface = 'rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface)';

function statsHref(playerId: string): string {
  return `#/stats/${encodeURIComponent(playerId)}`;
}

interface Group {
  readonly id: string;
  readonly title: string;
  readonly icon: ReactNode;
  readonly players: readonly OverallPlayer[];
}

// Serwer sortuje graczy, więc grupy tylko dzielą listę i zachowują jej kolejność.
function groups(players: readonly OverallPlayer[]): readonly Group[] {
  return [
    { id: 'overall-above', title: pl.overallAbove, icon: <ArrowUpIcon />, players: players.filter((player) => player.difference !== null && player.difference >= 0) },
    { id: 'overall-below', title: pl.overallBelow, icon: <ArrowDownIcon />, players: players.filter((player) => player.difference !== null && player.difference < 0) },
    { id: 'overall-no-leg', title: pl.overallNoLeg, icon: null, players: players.filter((player) => player.average === null) },
  ];
}

// Łączne liczby z wszystkich gier liczonych do statystyk i gracze podzieleni średnią ogólną.
export function OverallBoard({ overall }: { overall: StatsOverall }) {
  const tiles = [
    { term: pl.overallDarts, value: String(overall.darts) },
    { term: pl.overallAverage, value: formatAverage(overall.average) },
    { term: pl.overallGames, value: String(overall.games) },
    { term: pl.overallLegs, value: String(overall.legs) },
  ];
  return (
    <div className="flex flex-col gap-5 xl:min-h-0 xl:flex-1">
      <dl className="grid shrink-0 grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {tiles.map(({ term, value }) => (
          <div key={term} className={`flex min-w-0 flex-col gap-1 px-4 py-3 sm:px-5 sm:py-4 ${surface}`}>
            <dt className={label}>{term}</dt>
            <dd className="font-display text-4xl leading-none font-bold tabular-nums sm:text-5xl">{value}</dd>
          </div>
        ))}
      </dl>
      <div
        className={`@container flex flex-col gap-4 px-5 pt-4 pb-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto [scrollbar-color:var(--color-border-strong)_var(--color-surface-header)] ${surface}`}
      >
        {groups(overall.players)
          .filter((group) => group.players.length > 0)
          .map((group) => (
            <section key={group.id} aria-labelledby={group.id} className="flex flex-col">
              <h2 id={group.id} className="flex items-center gap-2 font-display text-[26px] leading-tight font-bold">
                {group.icon}
                {group.title}
              </h2>
              <ol>
                {group.players.map((player) => (
                  <li key={player.playerId}>
                    <a href={statsHref(player.playerId)} className="block">
                      <Row player={player} />
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          ))}
      </div>
    </div>
  );
}

// W wąskiej karcie średnia, różnica i lotki przechodzą pod imię.
function Row({ player }: { player: OverallPlayer }) {
  return (
    <div className="flex min-h-13 items-center gap-3.5 border-b border-(--color-border) py-1.5 @max-xs:gap-2.5">
      <Avatar name={player.name} avatar={player.avatar} color={player.color} />
      <span className="flex min-w-0 flex-1 items-center gap-3.5 @max-sm:flex-col @max-sm:items-stretch @max-sm:gap-0.5">
        <span className="min-w-0 flex-1 truncate text-[21px] font-semibold">{player.name}</span>
        <span className="flex shrink-0 flex-wrap items-baseline gap-x-3.5 tabular-nums @max-sm:gap-x-3">
          <span className="font-display text-[32px] leading-none font-bold @max-sm:text-[26px]">{formatAverage(player.average)}</span>
          {player.difference !== null && <span className="font-display text-xl leading-none font-semibold">{formatDifference(player.difference)}</span>}
          <span className="text-[15px] text-(--color-text-muted)">{pl.overallDartCount(player.darts)}</span>
        </span>
      </span>
    </div>
  );
}
