import type { GameSetup } from '../game/game-setup';
import { setupLine } from '../game/setup-line';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import type { GameSetupSummaryProps } from './GameSetupSummary';
import { WarningIcon } from './icons';

export interface StartBarProps {
  setup: GameSetup;
  players: GameSetupSummaryProps['players'];
  canStart: boolean;
  error: string | null;
  onStart(): void;
}

const names = 'truncate font-display text-2xl font-bold';

export function StartBar({ setup, players, canStart, error, onStart }: StartBarProps) {
  return (
    <section aria-label={pl.startBar} className="flex h-22 shrink-0 items-center gap-6 border-t border-(--color-border-subtle) bg-(--color-surface-header) px-10">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Players players={players} />
        <span className="min-w-0 truncate text-lg text-(--color-text-muted)">{setupLine(setup)}</span>
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
        className="h-15 shrink-0 rounded-(--radius-card) bg-(--color-accent) px-9 font-display text-[28px] font-bold tracking-[0.06em] text-(--color-on-accent) uppercase disabled:opacity-40"
      >
        {pl.startGame}
      </button>
    </section>
  );
}

function Players({ players }: { players: GameSetupSummaryProps['players'] }) {
  const [first, second] = players;
  if (!first) {
    return <span className="shrink-0 text-lg text-(--color-text-muted)">{pl.noPlayersSelected}</span>;
  }
  if (!second) {
    return (
      <span className="flex min-w-0 items-center gap-3.5">
        <Avatar name={first.player.name} avatar={first.player.avatar} colorIndex={first.colorIndex} size="medium" />
        <span className={names}>{first.player.name}</span>
      </span>
    );
  }
  if (players.length === 2) {
    return (
      <span className="flex min-w-0 items-center gap-3.5">
        <Avatar name={first.player.name} avatar={first.player.avatar} colorIndex={first.colorIndex} size="medium" />
        <span className={names}>
          {first.player.name} {pl.versus} {second.player.name}
        </span>
        <Avatar name={second.player.name} avatar={second.player.avatar} colorIndex={second.colorIndex} size="medium" />
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-3.5">
      <span className="flex items-center gap-1.5">
        {players.map(({ player, colorIndex }) => (
          <Avatar key={player.id} name={player.name} avatar={player.avatar} colorIndex={colorIndex} size="medium" />
        ))}
      </span>
      <span className={names}>{pl.startBarPlayers(players.length)}</span>
    </span>
  );
}
