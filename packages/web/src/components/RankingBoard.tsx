import type { RankedPlayer, RankingEntry, StatsRankings } from '@autoscore/schema';
import { formatAverage } from '../game/format-stat';
import { podiumSlots } from '../game/podium';
import { recordBarPercent } from '../game/record-bar';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { CardRings } from './CardRings';
import { Podium } from './Podium';

const tileCard =
  '@container relative flex min-h-0 flex-col gap-1 overflow-hidden rounded-(--radius-panel) bg-(--color-surface-softer) px-5.5 py-4.5 shadow-(--shadow-inset-line)';
const scrollbar = '[scrollbar-color:var(--color-border)_transparent]';

function statsHref(playerId: string): string {
  return `#/stats/${encodeURIComponent(playerId)}`;
}

interface Tile {
  readonly title: string;
  readonly unit: string;
  readonly entries: readonly RankingEntry[];
  readonly format: (value: number) => string;
  readonly empty?: string | undefined;
  readonly lowerIsBetter?: boolean;
}

function tiles(rankings: StatsRankings): readonly Tile[] {
  return [
    { title: pl.tileBestLeg, unit: pl.tileBestLegUnit, entries: rankings.bestLegAverage, format: formatAverage },
    { title: pl.statHighestCheckout, unit: pl.tileCheckoutUnit, entries: rankings.highestCheckout, format: String },
    { title: pl.tileShortestLeg, unit: pl.tileShortestLegUnit, entries: rankings.shortestLeg, format: String, lowerIsBetter: true },
    {
      title: pl.tileHighestTurn,
      unit: pl.tileHighestTurnUnit,
      entries: rankings.highestTurn,
      format: String,
      empty: rankings.filter === 'casual' || rankings.filter === 'practice' ? pl.tileOnlyMatches : undefined,
    },
  ];
}

// Podium i dalsze miejsca po średniej oraz cztery kafelki z pierwszą piątką.
export function RankingBoard({ rankings }: { rankings: StatsRankings }) {
  const { podium, rest } = podiumSlots(rankings.players);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:min-h-0 xl:flex-1">
      <section aria-labelledby="ranking-average" className="sc-panel @container min-h-0">
        <CardRings className="-right-15 -bottom-15 size-60" />
        <h2 id="ranking-average" className="relative font-display text-[26px] leading-tight font-extrabold">
          {pl.statAverage}
        </h2>
        {podium.length > 0 && <Podium slots={podium} />}
        {rest.length > 0 && (
          <ol aria-label={pl.furtherPlaces} className={`relative pr-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto ${scrollbar}`}>
            {rest.map((player) => (
              <li key={player.playerId}>
                <RestRow player={player} />
              </li>
            ))}
          </ol>
        )}
        <p className="relative mt-auto border-t border-(--color-border) pt-2.5 text-sm text-(--color-text-muted)">{pl.averageFootnote}</p>
      </section>
      <div className="grid min-h-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:grid-rows-2">
        {tiles(rankings).map((tile) => {
          const best = tile.entries[0]?.value ?? 0;
          return (
            <section key={tile.title} aria-label={tile.title} className={tileCard}>
              <CardRings className="-top-12 -right-12 size-44" />
              <div className="relative mb-2 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl leading-tight font-extrabold">{tile.title}</h2>
                <span className="text-[13px] text-(--color-text-muted)">{tile.unit}</span>
              </div>
              <ol className={`relative flex flex-col gap-0.5 xl:min-h-0 xl:overflow-y-auto ${scrollbar}`}>
                {tile.entries.map((entry) => (
                  <li key={entry.playerId}>
                    <TileRow entry={entry} value={tile.format(entry.value)} bar={recordBarPercent(entry.value, best, tile.lowerIsBetter ?? false)} />
                  </li>
                ))}
              </ol>
              {tile.entries.length < 3 && <p className="relative py-2 text-(--color-text-muted)">{tile.empty ?? pl.tooFewPlayers}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Legi przechodzą pod imię w wąskiej karcie.
function RestRow({ player }: { player: RankedPlayer }) {
  return (
    <a href={statsHref(player.playerId)} className="flex min-h-14 items-center gap-3.5 border-t border-(--color-border) px-1 text-(--color-text) @max-xs:gap-2.5">
      <span className="w-8 shrink-0 font-display text-2xl font-extrabold text-(--color-text-muted) tabular-nums">{player.position === null ? '' : `${player.position}.`}</span>
      <Avatar name={player.name} avatar={player.avatar} color={player.color} size="medium" />
      <span className="flex min-w-0 flex-1 items-center gap-3.5 @max-sm:flex-col @max-sm:items-stretch @max-sm:gap-0 @max-sm:leading-tight">
        <span className="min-w-0 flex-1 truncate font-display text-[22px] font-bold">{player.name}</span>
        <span className="shrink-0 text-sm text-(--color-text-muted)">{pl.legsCount(player.legs)}</span>
      </span>
      <span className="shrink-0 font-display text-[30px] leading-none font-extrabold tabular-nums @max-xs:text-[26px]">{formatAverage(player.average)}</span>
    </a>
  );
}

interface TileRowProps {
  entry: RankingEntry;
  value: string;
  bar: number;
}

// Lider ma złoty numer „1.” i większą wartość, więc kolor nie jest jedynym wyróżnieniem.
// Pasek za wierszem pokazuje wynik względem lidera. Treść nad nim ma relative, żeby nie schowała się pod paskiem.
function TileRow({ entry, value, bar }: TileRowProps) {
  const leader = entry.position === 1;
  return (
    <div data-leader={leader || undefined} className="relative flex min-h-14 items-center overflow-hidden rounded-(--radius-button) px-3">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 bg-linear-to-r to-transparent ${leader ? 'from-(--color-accent-glow) opacity-55' : 'from-(--color-surface-soft)'}`}
        style={{ width: `${bar}%` }}
      />
      <span className="relative flex min-w-0 flex-1 items-center gap-3 @max-xs:gap-2.5">
        <span className={`w-7 shrink-0 font-display text-[21px] font-extrabold tabular-nums ${leader ? 'text-(--color-gold)' : 'text-(--color-text-muted)'}`}>{`${entry.position}.`}</span>
        <Avatar name={entry.name} avatar={entry.avatar} color={entry.color} />
        <span className="min-w-0 flex-1 truncate font-display text-[21px] font-bold">{entry.name}</span>
        <span
          className={`shrink-0 font-display leading-none tabular-nums ${leader ? 'text-[34px] font-black text-(--color-text) @max-xs:text-[28px]' : 'text-[26px] font-bold text-(--color-text-sub) @max-xs:text-[22px]'}`}
        >
          {value}
        </span>
      </span>
    </div>
  );
}
