import type { BestOf, CheckoutRange, PracticeMode, StartingScore } from '@autoscore/schema';
import { useId, type ReactNode } from 'react';
import type { GameKind } from '../game/game-kind';
import { PLAYER_COUNT, type GameSetup } from '../game/game-setup';
import { pl } from '../i18n/pl';
import { GameTypeTiles } from './GameTypeTiles';
import { PlayerPicker, type PlayerList } from './PlayerPicker';

const PRACTICE_MODES: readonly { value: PracticeMode; label: string }[] = [
  { value: 'free_run', label: pl.freeRun },
  { value: 'solo_501', label: pl.solo501 },
  { value: 'checkouts', label: pl.checkoutPractice },
];

const CHECKOUT_RANGES: readonly CheckoutRange[] = ['2-50', '51-100'];

const STARTING_SCORES: readonly StartingScore[] = [301, 501, 701];
const BEST_OF: readonly BestOf[] = [1, 3, 5];

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';

export interface NewGameFormProps {
  setup: GameSetup;
  players: PlayerList;
  onKindChange(kind: GameKind): void;
  onPlayerToggle(playerId: string): void;
  onStartingScoreChange(value: StartingScore): void;
  onBestOfChange(value: BestOf): void;
  onPracticeModeChange(value: PracticeMode): void;
  onCheckoutRangeChange(value: CheckoutRange): void;
  onNewPlayer(): void;
}

function hint(setup: GameSetup, valid: boolean): string {
  const count = setup.playerIds.length;
  if (count === 0) {
    return pl.playerCountHint[setup.type];
  }
  const selected = pl.playersSelected(count, PLAYER_COUNT[setup.type].max);
  return valid && setup.type !== 'practice' ? `${selected}${pl.drawHint}` : selected;
}

export function NewGameForm(props: NewGameFormProps) {
  const { setup, players } = props;
  const { min, max } = PLAYER_COUNT[setup.type];
  const count = setup.playerIds.length;

  return (
    // Odstęp 4 px z ujemnym marginesem mieści pierścień fokusu kafla przy krawędzi przewijanej kolumny.
    <div className="-m-1 flex shrink-0 flex-col gap-5.5 p-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <h1 className="font-display text-[clamp(2.5rem,4vw,4rem)] leading-[0.9] font-black tracking-[0.01em]">{pl.newGame}</h1>

      <GameTypeTiles kind={setup.type} onKindChange={props.onKindChange} />

      <PlayerPicker
        players={players}
        selectedIds={setup.playerIds}
        max={max}
        hint={hint(setup, count >= min && count <= max)}
        onToggle={props.onPlayerToggle}
        onNewPlayer={props.onNewPlayer}
      />

      <div className="flex flex-col gap-5 lg:max-xl:rounded-(--radius-panel) lg:max-xl:bg-linear-to-b lg:max-xl:from-(--color-surface-raised) lg:max-xl:to-(--color-surface) lg:max-xl:p-7 lg:max-xl:shadow-(--shadow-panel) xl:flex-row xl:flex-wrap xl:gap-x-8 xl:gap-y-5">
        {setup.type !== 'practice' && (
          <Segmented legend={pl.startingScore} description={pl.startingScoreHint}>
            {STARTING_SCORES.map((value) => (
              <Segment key={value} selected={setup.startingScore === value} onSelect={() => props.onStartingScoreChange(value)}>
                {value}
              </Segment>
            ))}
          </Segmented>
        )}
        {setup.type === 'match' && (
          <Segmented legend={pl.bestOf} description={pl.bestOfHint}>
            {BEST_OF.map((value) => (
              <Segment key={value} selected={setup.bestOf === value} onSelect={() => props.onBestOfChange(value)}>
                {pl.bestOfOption(value)}
              </Segment>
            ))}
          </Segmented>
        )}
        {setup.type === 'practice' && (
          <Segmented legend={pl.practiceMode} description={pl.practiceModeHint}>
            {PRACTICE_MODES.map((option) => (
              <Segment
                key={option.value}
                selected={setup.practiceMode === option.value}
                onSelect={() => props.onPracticeModeChange(option.value)}
              >
                {option.label}
              </Segment>
            ))}
          </Segmented>
        )}
        {setup.type === 'practice' && setup.practiceMode === 'checkouts' && (
          <Segmented legend={pl.checkoutRange} description={pl.checkoutRangeHint}>
            {CHECKOUT_RANGES.map((value) => (
              <Segment key={value} selected={setup.checkoutRange === value} onSelect={() => props.onCheckoutRangeChange(value)}>
                {value}
              </Segment>
            ))}
          </Segmented>
        )}
      </div>
    </div>
  );
}

// Opis stoi poza legend, żeby nazwą grupy została sama legenda.
function Segmented({ legend, description, children }: { legend: string; description?: string; children: ReactNode }) {
  const id = useId();
  return (
    <fieldset aria-describedby={description ? id : undefined} className="flex w-full max-w-full flex-col xl:w-82.5">
      <legend className={`mb-2.5 ${label}`}>{legend}</legend>
      {description && (
        <p id={id} className="mb-2.5 text-[15px] text-(--color-text-muted) xl:hidden">
          {description}
        </p>
      )}
      <div className="sc-seg">{children}</div>
    </fieldset>
  );
}

function Segment({ selected, onSelect, children }: { selected: boolean; onSelect(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="h-12 flex-1 px-4 text-[22px] whitespace-nowrap lg:h-15 xl:h-13"
    >
      {children}
    </button>
  );
}
