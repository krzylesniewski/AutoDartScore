import type { MatchSnapshot, MatchSnapshotPlayer } from '@autoscore/schema';
import { scoreboardOrder } from '../game/scoreboard-order';
import { pl } from '../i18n/pl';
import { PlaceIcon, PlusIcon, ThrowingIcon } from './icons';

const MAX_PLAYERS = 4;

// Wysokości są w zmiennych CSS na <ol>, bo obrót kolejki przesuwa wiersze przez translateY o wielokrotność wysokości.
// Zawierają odstęp pod wierszem (pb). Poniżej lg wiersze są niskie, żeby klawiatura zmieściła się na telefonie.
const sizes = {
  large2: {
    heights: '[--row-height:64px] [--slot-height:52px] lg:[--row-height:248px] lg:[--slot-height:76px]',
    row: 'pb-2 lg:pb-3',
    card: 'gap-2 px-3 lg:gap-4 lg:px-5',
    avatar: 'size-10 text-xl lg:size-21 lg:text-4xl lg:@max-md:size-11 lg:@max-md:text-2xl',
    name: 'text-[18px] lg:text-(length:--text-player-name-2p) lg:@max-md:text-2xl',
    score: 'text-[clamp(40px,12cqi,48px)] lg:text-(length:--text-score-2p) lg:@max-md:text-[clamp(64px,30cqi,100px)]',
    meta: 'text-[12px] lg:text-(length:--text-label)',
    nameBlock: 'flex-col gap-0.5 lg:gap-1',
    counter: 'gap-3 lg:gap-5',
    badge: 'leading-tight lg:leading-7',
    legsValue: 'text-xl lg:text-2xl',
    place: 'px-2 text-xl lg:px-3 lg:text-2xl',
    stacked: true,
  },
  large4: {
    heights: '[--row-height:64px] [--slot-height:52px] lg:[--row-height:164px] lg:[--slot-height:76px]',
    row: 'pb-2 lg:pb-3',
    card: 'gap-2 px-3 lg:gap-4 lg:px-5',
    avatar: 'size-10 text-xl lg:size-15 lg:text-3xl lg:@max-md:size-11 lg:@max-md:text-2xl',
    name: 'text-[18px] lg:text-(length:--text-player-name-4p) lg:@max-md:text-2xl',
    score: 'text-[clamp(40px,12cqi,48px)] lg:text-(length:--text-score-4p) lg:@max-md:text-[clamp(56px,21cqi,72px)]',
    meta: 'text-[12px] lg:text-(length:--text-label)',
    nameBlock: 'flex-col gap-0.5 lg:gap-1',
    counter: 'gap-3 lg:gap-5',
    badge: 'leading-tight lg:leading-7',
    legsValue: 'text-xl lg:text-2xl',
    place: 'px-2 text-xl lg:px-3 lg:text-2xl',
    stacked: true,
  },
  compact: {
    heights: '[--row-height:52px] [--slot-height:52px]',
    row: 'gap-2 pb-1',
    card: 'gap-2 px-2',
    avatar: 'size-8 text-lg',
    name: 'text-lg',
    score: 'text-3xl',
    meta: 'text-xs',
    nameBlock: 'flex-row items-center gap-2',
    counter: 'gap-5',
    badge: '',
    legsValue: 'text-2xl',
    place: 'px-3 text-2xl',
    stacked: false,
  },
} as const;

// Wiersz w dwóch liniach (duży wynik, pod nim awatar, imię i legi) tylko od lg w wąskim kontenerze, czyli w kolumnie 340 px tabletu.
// Bramka lg jest potrzebna, bo kolumna telefonu jest równie wąska, a tam zostaje zwarty wiersz poziomy.
const STACKED = {
  card: 'lg:@max-md:grid lg:@max-md:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:@max-md:content-center lg:@max-md:gap-x-3 lg:@max-md:gap-y-2',
  arrow: 'lg:@max-md:col-start-1 lg:@max-md:row-start-1 lg:@max-md:text-2xl',
  avatar: 'lg:@max-md:col-start-2 lg:@max-md:row-start-2',
  nameBlock: 'lg:@max-md:col-start-3 lg:@max-md:row-start-2 lg:@max-md:flex-row lg:@max-md:items-center lg:@max-md:gap-2',
  legs: 'lg:@max-md:hidden',
  value: 'lg:@max-md:col-[2/-1] lg:@max-md:row-start-1 lg:@max-md:justify-self-start',
} as const;

const FLAT = { card: '', arrow: '', avatar: '', nameBlock: '', legs: '', value: '' } as const;

type Size = 'large' | 'compact';
type Style = (typeof sizes)[keyof typeof sizes];

// Pełne nazwy klas, bo Tailwind generuje CSS tylko dla klas zapisanych dosłownie.
const AVATAR_COLORS = ['bg-(--color-avatar-1)', 'bg-(--color-avatar-2)', 'bg-(--color-avatar-3)', 'bg-(--color-avatar-4)'] as const;

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

export interface ScoreboardProps {
  state: MatchSnapshot;
  size: Size;
  rotate?: boolean;
}

export function Scoreboard({ state, size, rotate = true }: ScoreboardProps) {
  const style = styleFor(size, state.players.length);
  const players = scoreboardOrder(state, rotate);
  const freeSlots = state.type === 'casual' && size === 'large' ? MAX_PLAYERS - state.players.length : 0;
  const nextId = nextPlayerId(state);

  return (
    <section aria-label={pl.scoreboard} className="@container flex flex-col gap-2">
      {size === 'large' && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className={label}>{pl.throwQueue}</span>
          {rotate && <span className="text-(--color-text-muted)">{pl.throwerOnTop}</span>}
        </div>
      )}
      {state.type === 'match' && state.legsToWin !== null && (
        <p className={label}>
          {pl.legs} {pl.legsTarget(state.legsToWin)}
        </p>
      )}
      <ol
        className={`relative ${style.heights}`}
        style={{ height: `calc(var(--row-height) * ${players.length} + var(--slot-height) * ${freeSlots})` }}
      >
        {players.map((player, index) => (
          <li
            key={player.id}
            aria-current={player.id === state.currentPlayerId ? 'true' : undefined}
            className={`absolute inset-x-0 top-0 h-(--row-height) transition-transform duration-300 ease-out motion-reduce:transition-none ${style.row}`}
            style={{ transform: `translateY(calc(var(--row-height) * ${index}))` }}
          >
            <PlayerRow player={player} state={state} style={style} next={player.id === nextId} />
          </li>
        ))}
        {Array.from({ length: freeSlots }, (_, slot) => (
          <li
            key={`slot-${slot}`}
            className={`absolute inset-x-0 top-0 h-(--slot-height) ${style.row}`}
            style={{ transform: `translateY(calc(var(--row-height) * ${players.length} + var(--slot-height) * ${slot}))` }}
          >
            <button
              type="button"
              disabled
              className="flex h-full w-full items-center justify-center gap-2 rounded-(--radius-card) border-(length:--border-width) border-dashed border-(--color-border-strong) font-display text-(length:--text-button) font-semibold text-(--color-text-muted)"
            >
              <PlusIcon />
              <span>
                <span>{pl.addPlayerSlot}</span> <span>{state.players.length + slot + 1}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function styleFor(size: Size, playerCount: number): Style {
  if (size === 'compact') {
    return sizes.compact;
  }
  return playerCount <= 2 ? sizes.large2 : sizes.large4;
}

// Następny po rzucającym wśród grających, po kolei z listy graczy i w kółko.
function nextPlayerId(state: MatchSnapshot): string | null {
  const active = state.players.filter((player) => player.place === null);
  const throwerIndex = active.findIndex((player) => player.id === state.currentPlayerId);
  if (state.finished || active.length < 2 || throwerIndex < 0) {
    return null;
  }
  return active[(throwerIndex + 1) % active.length]?.id ?? null;
}

interface PlayerRowProps {
  player: MatchSnapshotPlayer;
  state: MatchSnapshot;
  style: Style;
  next: boolean;
}

function PlayerRow({ player, state, style, next }: PlayerRowProps) {
  const throwing = player.id === state.currentPlayerId;
  const colorIndex = state.players.findIndex((candidate) => candidate.id === player.id);
  const layout = style.stacked ? STACKED : FLAT;
  return (
    <div
      className={`flex h-full items-center rounded-(--radius-card) border-(length:--border-width) ${style.card} ${layout.card} ${
        throwing ? 'border-(--color-accent) bg-(--color-surface-active)' : 'border-(--color-border) bg-(--color-surface)'
      }`}
    >
      <span className={`flex w-[1em] text-(length:--text-label) text-(--color-accent) ${layout.arrow}`}>{throwing && <ThrowingIcon />}</span>
      <span
        className={`flex shrink-0 items-center justify-center rounded-full font-display font-bold text-(--color-on-avatar) ${style.avatar} ${layout.avatar} ${AVATAR_COLORS[colorIndex] ?? AVATAR_COLORS[0]}`}
      >
        {player.avatar ?? player.name.charAt(0).toUpperCase()}
      </span>
      <span className={`flex min-w-0 flex-1 items-start ${style.nameBlock} ${layout.nameBlock}`}>
        <span className={`max-w-full truncate font-display leading-tight font-semibold ${style.name}`}>{player.name}</span>
        {throwing && (
          <span className={`shrink-0 rounded-(--radius-chip) bg-(--color-accent) px-2 font-display text-xl font-bold uppercase tracking-(--tracking-label) text-(--color-on-accent) ${style.badge}`}>
            {pl.throwing}
          </span>
        )}
        {next && <span className={`shrink-0 font-display font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted) ${style.meta}`}>{pl.next}</span>}
      </span>
      {player.legsWon !== null && (
        <span className={`flex flex-col items-center font-display ${style.meta} ${layout.legs}`}>
          <span className="uppercase tracking-(--tracking-label) text-(--color-text-muted)">{pl.legs}</span>
          <span className={`font-bold ${style.legsValue}`}>{player.legsWon}</span>
        </span>
      )}
      {style.stacked && state.type === 'match' && player.legsWon !== null && state.legsToWin !== null && (
        <LegDots won={player.legsWon} target={state.legsToWin} />
      )}
      {player.place !== null ? (
        <span
          className={`flex shrink-0 items-center gap-1 rounded-(--radius-chip) bg-(--color-text) py-1 font-display font-bold text-(--color-text-inverse) ${style.place} ${layout.value}`}
        >
          <PlaceIcon />
          {pl.place(player.place)}
        </span>
      ) : state.freeRun ? (
        <FreeRunCounter freeRun={state.freeRun} style={style} className={layout.value} />
      ) : (
        <span
          className={`font-display leading-none font-bold tabular-nums ${style.score} ${layout.value} ${throwing ? 'text-(--color-text)' : 'text-(--color-text-muted)'}`}
        >
          {player.remaining}
        </span>
      )}
    </div>
  );
}

// Kropki legów widać tylko w wierszu dwuliniowym. W pozostałych układach zostaje blok "Legi N".
function LegDots({ won, target }: { won: number; target: number }) {
  return (
    <span role="img" aria-label={pl.legsWonOf(won, target)} className="hidden gap-1.5 lg:@max-md:col-start-4 lg:@max-md:row-start-2 lg:@max-md:flex">
      {Array.from({ length: target }, (_, index) => (
        <span
          key={index}
          className={`size-3.5 rounded-full border-(length:--border-width) ${index < won ? 'border-(--color-text) bg-(--color-text)' : 'border-(--color-text-muted)'}`}
        />
      ))}
    </span>
  );
}

function FreeRunCounter({ freeRun, style, className }: { freeRun: NonNullable<MatchSnapshot['freeRun']>; style: Style; className: string }) {
  const items = [
    [pl.total, String(freeRun.totalPoints)],
    [pl.dartsThrown, String(freeRun.dartsThrown)],
    [pl.average, freeRun.average.toFixed(1)],
  ] as const;
  return (
    <dl className={`flex shrink-0 font-display ${style.counter} ${className}`}>
      {items.map(([term, value]) => (
        <div key={term} className="flex flex-col items-end">
          <dt className={`uppercase tracking-(--tracking-label) text-(--color-text-muted) ${style.meta}`}>{term}</dt>
          <dd className={`font-bold tabular-nums ${style.name}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
