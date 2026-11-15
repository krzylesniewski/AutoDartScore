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

const names = 'truncate font-display text-[22px] font-bold sm:text-2xl';

export function StartBar({ setup, players, canStart, error, onStart }: StartBarProps) {
  return (
    <section
      aria-label={pl.startBar}
      className="flex shrink-0 flex-col gap-3 border-t border-(--color-border) bg-linear-to-b from-(--color-bg-mid) to-(--color-bg) px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8 lg:min-h-24 lg:flex-row lg:items-center lg:gap-5.5 lg:bg-none lg:px-(--space-page) lg:pt-0 lg:pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Players players={players} />
        <span className="hidden min-w-0 truncate text-lg text-(--color-text-muted) sm:block">{setupLine(setup)}</span>
      </div>
      {error && (
        <p className="flex shrink-0 items-center gap-2.5 font-display text-xl font-bold text-(--color-text)">
          <WarningIcon className="text-(--color-accent)" />
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!canStart}
        onClick={onStart}
        className="sc-btn sc-btn--primary h-14 w-full shrink-0 rounded-(--radius-card) px-10 font-display text-[28px] font-extrabold tracking-[0.06em] uppercase lg:h-17 lg:w-auto xl:h-15"
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
