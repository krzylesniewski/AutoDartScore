import type { Player } from '@autoscore/schema';
import type { GameSetup } from '../game/game-setup';
import { setupLine } from '../game/setup-line';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { WarningIcon } from './icons';

export interface StartBarProps {
  setup: GameSetup;
  players: readonly Player[];
  canStart: boolean;
  error: string | null;
  onStart(): void;
}

const names = 'truncate font-display text-2xl font-bold';

export function StartBar({ setup, players, canStart, error, onStart }: StartBarProps) {
  return (
    <section
      aria-label={pl.startBar}
      className="flex shrink-0 flex-col gap-3 border-t border-(--color-border-subtle) bg-(--color-surface-header) px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8 lg:min-h-22 lg:flex-row lg:items-center lg:gap-6 lg:px-10 lg:pt-0 lg:pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Players players={players} />
        <span className="hidden min-w-0 truncate text-lg text-(--color-text-muted) sm:block">{setupLine(setup)}</span>
      </div>
      {error && (
        <p className="flex shrink-0 items-center gap-2 font-display text-xl text-(--color-accent)">
          <WarningIcon />
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!canStart}
        onClick={onStart}
        className="h-14 w-full shrink-0 rounded-(--radius-card) bg-(--color-accent) px-9 font-display text-[28px] font-bold tracking-[0.06em] text-(--color-on-accent) uppercase disabled:opacity-40 lg:h-17 lg:w-auto xl:h-15"
      >
        {pl.startGame}
      </button>
    </section>
  );
}

function Players({ players }: { players: readonly Player[] }) {
  const [first, second] = players;
  if (!first) {
    return <span className="shrink-0 text-lg text-(--color-text-muted)">{pl.noPlayersSelected}</span>;
  }
  if (!second) {
    return (
      <span className="flex min-w-0 items-center gap-3.5">
        <Avatar name={first.name} avatar={first.avatar} color={first.color} size="medium" />
        <span className={names}>{first.name}</span>
      </span>
    );
  }
  if (players.length === 2) {
    return (
      <span className="flex min-w-0 items-center gap-3.5">
        <Avatar name={first.name} avatar={first.avatar} color={first.color} size="medium" />
        <span className={names}>
          {first.name} {pl.versus} {second.name}
        </span>
        <Avatar name={second.name} avatar={second.avatar} color={second.color} size="medium" />
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-3.5">
      <span className="flex items-center gap-1.5">
        {players.map((player) => (
          <Avatar key={player.id} name={player.name} avatar={player.avatar} color={player.color} size="medium" />
        ))}
      </span>
      <span className={names}>{pl.startBarPlayers(players.length)}</span>
    </span>
  );
}
