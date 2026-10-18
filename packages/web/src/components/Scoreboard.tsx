import type { MatchSnapshot, MatchSnapshotPlayer } from '@autoscore/schema';
import { scoreboardOrder } from '../game/scoreboard-order';
import { pl } from '../i18n/pl';
import { PlaceIcon, ThrowingIcon } from './icons';

const MAX_PLAYERS = 4;

const sizes = {
  large: { rowHeight: 112, row: 'gap-4 px-4', avatar: 'h-16 w-16 text-4xl', name: 'text-3xl', score: 'text-7xl', meta: 'text-lg' },
  compact: { rowHeight: 48, row: 'gap-2 px-2', avatar: 'h-8 w-8 text-lg', name: 'text-lg', score: 'text-3xl', meta: 'text-xs' },
} as const;

export interface ScoreboardProps {
  state: MatchSnapshot;
  size: 'large' | 'compact';
  rotate?: boolean;
}

export function Scoreboard({ state, size, rotate = true }: ScoreboardProps) {
  const style = sizes[size];
  const players = scoreboardOrder(state, rotate);
  const freeSlots = state.type === 'casual' && size === 'large' ? MAX_PLAYERS - state.players.length : 0;
  const rows = players.length + freeSlots;

  return (
    <section aria-label={pl.scoreboard} className="flex flex-col gap-2">
      {state.type === 'match' && state.legsToWin !== null && (
        <p className={`font-display uppercase tracking-wide text-muted ${style.meta}`}>
          {pl.legs} {pl.legsTarget(state.legsToWin)}
        </p>
      )}
      <ol className="relative" style={{ height: rows * style.rowHeight }}>
        {players.map((player, index) => (
          <li
            key={player.id}
            aria-current={player.id === state.currentPlayerId ? 'true' : undefined}
            className="absolute inset-x-0 top-0 pb-1 transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ height: style.rowHeight, transform: `translateY(${index * style.rowHeight}px)` }}
          >
            <PlayerRow player={player} state={state} size={size} />
          </li>
        ))}
        {Array.from({ length: freeSlots }, (_, slot) => (
          <li
            key={`slot-${slot}`}
            className="absolute inset-x-0 top-0 pb-1"
            style={{ height: style.rowHeight, transform: `translateY(${(players.length + slot) * style.rowHeight}px)` }}
          >
            <button
              type="button"
              disabled
              className={`flex h-full w-full items-center rounded-card border-2 border-dashed border-line font-display text-muted ${style.row} ${style.name}`}
            >
              {pl.addPlayerSlot}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface PlayerRowProps {
  player: MatchSnapshotPlayer;
  state: MatchSnapshot;
  size: 'large' | 'compact';
}

function PlayerRow({ player, state, size }: PlayerRowProps) {
  const style = sizes[size];
  const throwing = player.id === state.currentPlayerId;
  return (
    <div
      className={`flex h-full items-center rounded-card border-l-4 ${style.row} ${
        throwing ? 'border-board-green bg-surface-raised' : 'border-transparent bg-surface'
      }`}
    >
      <span className={`flex items-center justify-center rounded-card bg-ink font-display ${style.avatar}`}>
        {player.avatar ?? player.name.charAt(0).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate font-display font-semibold ${style.name}`}>{player.name}</span>
        {throwing && (
          <span className={`flex items-center gap-1 font-display uppercase text-board-green ${style.meta}`}>
            <ThrowingIcon />
            {pl.throwing}
          </span>
        )}
      </span>
      {player.legsWon !== null && (
        <span className={`flex flex-col items-center font-display ${style.meta}`}>
          <span className="uppercase text-muted">{pl.legs}</span>
          <span className="text-cream">{player.legsWon}</span>
        </span>
      )}
      {player.place !== null ? (
        <span className={`flex items-center gap-1 font-display font-semibold text-warning ${style.name}`}>
          <PlaceIcon />
          {pl.place(player.place)}
        </span>
      ) : state.freeRun ? (
        <FreeRunCounter freeRun={state.freeRun} size={size} />
      ) : (
        <span className={`font-display font-bold tabular-nums ${style.score}`}>{player.remaining}</span>
      )}
    </div>
  );
}

function FreeRunCounter({ freeRun, size }: { freeRun: NonNullable<MatchSnapshot['freeRun']>; size: 'large' | 'compact' }) {
  const style = sizes[size];
  const items = [
    [pl.total, String(freeRun.totalPoints)],
    [pl.dartsThrown, String(freeRun.dartsThrown)],
    [pl.average, freeRun.average.toFixed(1)],
  ] as const;
  return (
    <dl className="flex gap-4 font-display">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col items-end">
          <dt className={`uppercase text-muted ${style.meta}`}>{label}</dt>
          <dd className={`font-bold tabular-nums ${style.name}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
