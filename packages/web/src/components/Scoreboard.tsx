import type { MatchSnapshot, MatchSnapshotPlayer } from '@autoscore/schema';
import { scoreboardOrder } from '../game/scoreboard-order';
import { pl } from '../i18n/pl';
import { PlaceIcon, PlusIcon, ThrowingIcon } from './icons';

const MAX_PLAYERS = 4;

// Wysokości w px, bo obrót kolejki przesuwa wiersze przez translateY. Zawierają odstęp pod wierszem (pb).
const sizes = {
  large2: {
    rowHeight: 248,
    slotHeight: 76,
    row: 'gap-4 pb-3',
    card: 'gap-4 px-5',
    avatar: 'size-21 text-4xl',
    name: 'text-(length:--text-player-name-2p)',
    score: 'text-(length:--text-score-2p)',
    meta: 'text-(length:--text-label)',
    nameBlock: 'flex-col gap-1',
  },
  large4: {
    rowHeight: 164,
    slotHeight: 76,
    row: 'gap-4 pb-3',
    card: 'gap-4 px-5',
    avatar: 'size-15 text-3xl',
    name: 'text-(length:--text-player-name-4p)',
    score: 'text-(length:--text-score-4p)',
    meta: 'text-(length:--text-label)',
    nameBlock: 'flex-col gap-1',
  },
  compact: {
    rowHeight: 52,
    slotHeight: 52,
    row: 'gap-2 pb-1',
    card: 'gap-2 px-2',
    avatar: 'size-8 text-lg',
    name: 'text-lg',
    score: 'text-3xl',
    meta: 'text-xs',
    nameBlock: 'flex-row items-center gap-2',
  },
} as const;

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
  const slotsTop = players.length * style.rowHeight;
  const nextId = nextPlayerId(state);

  return (
    <section aria-label={pl.scoreboard} className="flex flex-col gap-2">
      {size === 'large' && (
        <div className="flex items-baseline justify-between gap-4">
          <span className={label}>{pl.throwQueue}</span>
          {rotate && <span className="text-(--color-text-muted)">{pl.throwerOnTop}</span>}
        </div>
      )}
      {state.type === 'match' && state.legsToWin !== null && (
        <p className={label}>
          {pl.legs} {pl.legsTarget(state.legsToWin)}
        </p>
      )}
      <ol className="relative" style={{ height: slotsTop + freeSlots * style.slotHeight }}>
        {players.map((player, index) => (
          <li
            key={player.id}
            aria-current={player.id === state.currentPlayerId ? 'true' : undefined}
            className={`absolute inset-x-0 top-0 transition-transform duration-300 ease-out motion-reduce:transition-none ${style.row}`}
            style={{ height: style.rowHeight, transform: `translateY(${index * style.rowHeight}px)` }}
          >
            <PlayerRow player={player} state={state} style={style} next={player.id === nextId} />
          </li>
        ))}
        {Array.from({ length: freeSlots }, (_, slot) => (
          <li
            key={`slot-${slot}`}
            className={`absolute inset-x-0 top-0 ${style.row}`}
            style={{ height: style.slotHeight, transform: `translateY(${slotsTop + slot * style.slotHeight}px)` }}
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
  return (
    <div
      className={`flex h-full items-center rounded-(--radius-card) border-(length:--border-width) ${style.card} ${
        throwing ? 'border-(--color-accent) bg-(--color-surface-active)' : 'border-(--color-border) bg-(--color-surface)'
      }`}
    >
      <span className="flex w-[1em] text-(length:--text-label) text-(--color-accent)">{throwing && <ThrowingIcon />}</span>
      <span
        className={`flex shrink-0 items-center justify-center rounded-full font-display font-bold text-(--color-on-avatar) ${style.avatar} ${AVATAR_COLORS[colorIndex] ?? AVATAR_COLORS[0]}`}
      >
        {player.avatar ?? player.name.charAt(0).toUpperCase()}
      </span>
      <span className={`flex min-w-0 flex-1 items-start ${style.nameBlock}`}>
        <span className={`max-w-full truncate font-display leading-tight font-semibold ${style.name}`}>{player.name}</span>
        {throwing && (
          <span className="rounded-(--radius-chip) bg-(--color-accent) px-2 font-display text-xl font-bold uppercase tracking-(--tracking-label) text-(--color-on-accent)">
            {pl.throwing}
          </span>
        )}
        {next && <span className={`font-display font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted) ${style.meta}`}>{pl.next}</span>}
      </span>
      {player.legsWon !== null && (
        <span className={`flex flex-col items-center font-display ${style.meta}`}>
          <span className="uppercase tracking-(--tracking-label) text-(--color-text-muted)">{pl.legs}</span>
          <span className="text-2xl font-bold">{player.legsWon}</span>
        </span>
      )}
      {player.place !== null ? (
        <span className="flex items-center gap-1 rounded-(--radius-chip) bg-(--color-text) px-3 py-1 font-display text-2xl font-bold text-(--color-text-inverse)">
          <PlaceIcon />
          {pl.place(player.place)}
        </span>
      ) : state.freeRun ? (
        <FreeRunCounter freeRun={state.freeRun} style={style} />
      ) : (
        <span
          className={`font-display leading-none font-bold tabular-nums ${style.score} ${throwing ? 'text-(--color-text)' : 'text-(--color-text-muted)'}`}
        >
          {player.remaining}
        </span>
      )}
    </div>
  );
}

function FreeRunCounter({ freeRun, style }: { freeRun: NonNullable<MatchSnapshot['freeRun']>; style: Style }) {
  const items = [
    [pl.total, String(freeRun.totalPoints)],
    [pl.dartsThrown, String(freeRun.dartsThrown)],
    [pl.average, freeRun.average.toFixed(1)],
  ] as const;
  return (
    <dl className="flex gap-5 font-display">
      {items.map(([term, value]) => (
        <div key={term} className="flex flex-col items-end">
          <dt className={`uppercase tracking-(--tracking-label) text-(--color-text-muted) ${style.meta}`}>{term}</dt>
          <dd className={`font-bold tabular-nums ${style.name}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
