import type { RankingEntry, StatsRankings } from '@autoscore/schema';
import { formatAverage } from '../game/format-stat';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';

const card = 'flex min-h-0 flex-col gap-1.5 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) px-5 pt-4 pb-2';

function statsHref(playerId: string): string {
  return `#/stats/${encodeURIComponent(playerId)}`;
}

interface Tile {
  readonly title: string;
  readonly unit: string;
  readonly entries: readonly RankingEntry[];
  readonly format: (value: number) => string;
  readonly empty?: string | undefined;
}

function tiles(rankings: StatsRankings): readonly Tile[] {
  return [
    { title: pl.tileBestLeg, unit: pl.tileBestLegUnit, entries: rankings.bestLegAverage, format: formatAverage },
    { title: pl.statHighestCheckout, unit: pl.tileCheckoutUnit, entries: rankings.highestCheckout, format: String },
    { title: pl.tileShortestLeg, unit: pl.tileShortestLegUnit, entries: rankings.shortestLeg, format: String },
    {
      title: pl.tileHighestTurn,
      unit: pl.tileHighestTurnUnit,
      entries: rankings.highestTurn,
      format: String,
      empty: rankings.filter === 'casual' || rankings.filter === 'practice' ? pl.tileOnlyMatches : undefined,
    },
  ];
}

// Lista graczy po średniej i cztery kafelki z pierwszą trójką. Gracz ma ten sam kolor avatara w liście i w kafelkach.
export function RankingBoard({ rankings }: { rankings: StatsRankings }) {
  const colorIndex = (playerId: string, fallback: number) => {
    const index = rankings.players.findIndex((player) => player.playerId === playerId);
    return index >= 0 ? index : fallback;
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section aria-labelledby="ranking-average" className={card}>
        <h2 id="ranking-average" className="font-display text-[26px] leading-tight font-bold">
          {pl.statAverage}
        </h2>
        <ol className="min-h-0 flex-1 overflow-y-auto pr-2 [scrollbar-color:var(--color-border-strong)_var(--color-surface-header)]">
          {rankings.players.map((player, index) => (
            <li key={player.playerId}>
              <a href={statsHref(player.playerId)} className="block">
                <Row
                  position={player.position}
                  name={player.name}
                  avatar={player.avatar}
                  colorIndex={index}
                  detail={pl.legsCount(player.legs)}
                  value={formatAverage(player.average)}
                />
              </a>
            </li>
          ))}
        </ol>
        <p className="py-1 text-sm text-(--color-text-muted)">{pl.averageFootnote}</p>
      </section>
      <div className="grid min-h-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:grid-rows-2">
        {tiles(rankings).map((tile) => (
          <section key={tile.title} aria-label={tile.title} className={card}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[26px] leading-tight font-bold">{tile.title}</h2>
              <span className="text-[15px] text-(--color-text-muted)">{tile.unit}</span>
            </div>
            <ol className="min-h-0 overflow-y-auto">
              {tile.entries.map((entry, index) => (
                <li key={entry.playerId}>
                  <Row position={entry.position} name={entry.name} avatar={entry.avatar} colorIndex={colorIndex(entry.playerId, index)} value={tile.format(entry.value)} />
                </li>
              ))}
            </ol>
            {tile.entries.length < 3 && <p className="py-2 text-(--color-text-muted)">{tile.empty ?? pl.tooFewPlayers}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  position: number | null;
  name: string;
  avatar: string | null;
  colorIndex: number;
  detail?: string;
  value: string;
}

// Lider ma pasek w kolorze akcentu, numer "1." i większą wartość, więc kolor nie jest jedynym wyróżnieniem.
function Row({ position, name, avatar, colorIndex, detail, value }: RowProps) {
  const leader = position === 1;
  return (
    <div data-leader={leader || undefined} className="flex h-13 items-center gap-3.5 border-b border-(--color-border)">
      <span aria-hidden="true" className={`h-9 w-1.5 shrink-0 rounded-sm ${leader ? 'bg-(--color-accent)' : ''}`} />
      <span className={`w-8 shrink-0 font-display text-2xl font-bold ${leader ? 'text-(--color-text)' : 'text-(--color-text-muted)'}`}>{position === null ? '' : `${position}.`}</span>
      <Avatar name={name} avatar={avatar} colorIndex={colorIndex} />
      <span className={`min-w-0 flex-1 truncate text-[21px] font-semibold ${leader ? 'text-(--color-text)' : 'text-(--color-text-muted)'}`}>{name}</span>
      {detail && <span className="shrink-0 text-[15px] text-(--color-text-muted)">{detail}</span>}
      <span className={`shrink-0 font-display leading-none font-bold tabular-nums ${leader ? 'text-[44px] text-(--color-text)' : 'text-[32px] text-(--color-text-muted)'}`}>{value}</span>
    </div>
  );
}
