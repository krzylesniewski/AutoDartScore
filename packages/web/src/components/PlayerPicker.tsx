import type { Player } from '@autoscore/schema';
import { avatarRingClasses } from '../game/avatar-ring';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { CheckBadge } from './GameTypeTiles';
import { WarningIcon } from './icons';

export type PlayerList = { status: 'loading' } | { status: 'error' } | { status: 'ready'; players: readonly Player[] };

export interface PlayerPickerProps {
  players: PlayerList;
  selectedIds: readonly string[];
  max: number;
  hint: string;
  onToggle(playerId: string): void;
  onNewPlayer(): void;
}

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const tile = 'flex min-w-0 items-center rounded-(--radius-card) disabled:opacity-40';
const raised = 'bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) shadow-(--shadow-card)';
const flat = 'bg-(--color-surface-softer) shadow-(--shadow-inset-line)';

export function PlayerPicker({ players, selectedIds, max, hint, onToggle, onNewPlayer }: PlayerPickerProps) {
  const full = max > 1 && selectedIds.length >= max;

  return (
    <fieldset className="flex shrink-0 flex-col gap-2.5 xl:min-h-0 xl:shrink">
      <legend className={`mb-2.5 ${label}`}>{players.status === 'ready' ? pl.playersCount(players.players.length) : pl.players}</legend>
      {players.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
      {players.status === 'error' && <ErrorText text={pl.loadPlayersFailed} />}
      {players.status === 'ready' && players.players.length === 0 && <p className="text-(--color-text-muted)">{pl.noPlayers}</p>}
      {/* Po trzech rzędach lista przewija się w środku, żeby nie spychała punktów i legów pod pasek ze Startem.
          box-content zostawia max-h-61 na same kafle, a 4 px na pierścień fokusu dochodzi z zewnątrz. */}
      <div className="-m-1 box-content grid max-h-61 min-h-18 grid-cols-2 content-start gap-3.5 overflow-y-auto p-1 lg:grid-cols-3 xl:grid-cols-4">
        {players.status === 'ready' &&
          players.players.map((player) => {
            const selected = selectedIds.includes(player.id);
            return (
              <button
                key={player.id}
                type="button"
                aria-pressed={selected}
                disabled={!selected && full}
                onClick={() => onToggle(player.id)}
                className={`${tile} @container relative h-18 gap-2.5 pr-7 pl-3 @2xs:gap-3.5 @2xs:pr-4 @2xs:pl-4 ${selected ? `${raised} inset-ring-2 ${avatarRingClasses(player.color).insetRing}` : flat}`}
              >
                <Avatar name={player.name} avatar={player.avatar} color={player.color} size="tile" />
                {/* Avatar ma zostać pierwszym, a imię ostatnim dzieckiem kafla. Znaczek stoi między nimi, a na koniec przenosi go order-last.
                    W wąskim kaflu (telefon, 3 kolumny na tablecie) znaczek w rogu zostawia miejsce na imię. */}
                {selected && (
                  <CheckBadge className="absolute top-1.5 right-1.5 order-last size-5.5 text-sm @2xs:static @2xs:size-7 @2xs:text-base" />
                )}
                <span className="min-w-0 flex-1 truncate text-left font-display text-[22px] font-bold xl:text-2xl">{player.name}</span>
              </button>
            );
          })}
        <button
          type="button"
          onClick={onNewPlayer}
          className={`${tile} h-18 justify-center border border-dashed border-(--color-border) bg-transparent px-3.5 font-display text-[22px] font-bold text-(--color-text-sub)`}
        >
          {pl.newPlayer}
        </button>
      </div>
      <p aria-live="polite" className="text-sm text-(--color-text-muted) sm:text-[17px]">
        {hint}
      </p>
    </fieldset>
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2.5 font-display text-xl font-bold text-(--color-text)">
      <WarningIcon className="text-(--color-accent)" />
      {text}
    </p>
  );
}
