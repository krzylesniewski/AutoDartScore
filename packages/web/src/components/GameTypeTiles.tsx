import { useId, type ReactNode } from 'react';
import type { GameKind } from '../game/game-kind';
import { pl } from '../i18n/pl';
import { CornerRings } from './CornerRings';
import { CheckIcon, PlayersIcon, StarIcon, TargetIcon, TrophyIcon } from './icons';

const KINDS: readonly { value: GameKind; label: string; description: string; Icon: typeof TargetIcon }[] = [
  { value: 'match', label: pl.typeMatch, description: pl.typeMatchDescription, Icon: PlayersIcon },
  { value: 'casual', label: pl.typeCasual, description: pl.typeCasualDescription, Icon: StarIcon },
  { value: 'practice', label: pl.typePractice, description: pl.typePracticeDescription, Icon: TargetIcon },
  { value: 'tournament', label: pl.typeTournament, description: pl.typeTournamentDescription, Icon: TrophyIcon },
];

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const raised = 'bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) shadow-(--shadow-card)';
const flat = 'bg-(--color-surface-softer) shadow-(--shadow-inset-line)';

export interface GameTypeTilesProps {
  kind: GameKind;
  onKindChange(kind: GameKind): void;
}

export function GameTypeTiles({ kind, onKindChange }: GameTypeTilesProps) {
  return (
    // fieldset ma domyślnie min-inline-size: min-content, więc bez min-w-0 kafle nie zwężają się na tablecie.
    <fieldset className="flex min-w-0 flex-col">
      <legend className={`mb-2.5 ${label}`}>{pl.gameType}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3.5">
        {KINDS.map((option) => (
          <TypeTile
            key={option.value}
            name={option.label}
            description={option.description}
            icon={<option.Icon />}
            selected={kind === option.value}
            onSelect={() => onKindChange(option.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

interface TypeTileProps {
  name: string;
  description: string;
  icon: ReactNode;
  selected: boolean;
  onSelect(): void;
}

// Opis idzie przez aria-describedby, żeby nazwą przycisku została sama nazwa typu.
// Układ zależy od szerokości kafla, a nie okna: pionowy w wąskiej kolumnie, poziomy od 20rem.
function TypeTile({ name, description, icon, selected, onSelect }: TypeTileProps) {
  const id = useId();
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-labelledby={`${id}-name`}
      aria-describedby={`${id}-description`}
      onClick={onSelect}
      className={`@container relative h-26 min-w-0 overflow-hidden rounded-(--radius-card) text-left text-(--color-text) sm:h-29 ${selected ? `${raised} inset-ring-2 inset-ring-(--color-accent)` : flat}`}
    >
      {selected && <CornerRings className="-top-11 -right-11 size-30 @xs:-top-15 @xs:-right-15 @xs:size-50" />}
      <span className="relative flex h-full flex-col justify-between p-2.5 @xs:flex-row @xs:items-center @xs:justify-start @xs:gap-4.5 @xs:px-5.5 @xs:py-4.5">
        <span className="flex items-start justify-between @xs:contents">
          <span className="flex shrink-0 items-center justify-center text-[26px] @xs:size-15 @xs:rounded-full @xs:bg-(--color-surface-soft) @xs:text-[34px]">
            {icon}
          </span>
          {selected && <CheckBadge className="size-5.5 text-sm sm:size-7.5 sm:text-lg @xs:order-last @xs:self-start" />}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5 @xs:flex-1 @xs:gap-1">
          <span id={`${id}-name`} className="font-display text-[22px] leading-none font-extrabold sm:text-[26px] @xs:text-[34px]">
            {name}
          </span>
          <span
            id={`${id}-description`}
            className={`text-xs leading-[1.25] sm:text-[15px] ${selected ? 'text-(--color-text-sub)' : 'text-(--color-text-muted)'}`}
          >
            {description}
          </span>
        </span>
      </span>
    </button>
  );
}

// Stan niesie aria-pressed, więc znaczek jest ukryty przed czytnikami ekranu. Używa go też kafel gracza.
export function CheckBadge({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-(--color-accent) text-(--color-on-accent) ${className}`}
    >
      <CheckIcon />
    </span>
  );
}
