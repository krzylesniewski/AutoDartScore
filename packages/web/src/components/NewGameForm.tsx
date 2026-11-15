import type { BestOf, CheckoutRange, MatchType, Player, PracticeMode, StartingScore } from '@autoscore/schema';
import { useId, type ReactNode } from 'react';
import { avatarRingClasses } from '../game/avatar-ring';
import { PLAYER_COUNT, type GameSetup } from '../game/game-setup';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { CornerRings } from './CornerRings';
import { CheckIcon, PlayersIcon, StarIcon, TargetIcon, WarningIcon } from './icons';

const TYPES: readonly { value: MatchType; label: string; description: string; Icon: typeof TargetIcon }[] = [
  { value: 'match', label: pl.typeMatch, description: pl.typeMatchDescription, Icon: PlayersIcon },
  { value: 'casual', label: pl.typeCasual, description: pl.typeCasualDescription, Icon: StarIcon },
  { value: 'practice', label: pl.typePractice, description: pl.typePracticeDescription, Icon: TargetIcon },
];

const PRACTICE_MODES: readonly { value: PracticeMode; label: string }[] = [
  { value: 'free_run', label: pl.freeRun },
  { value: 'solo_501', label: pl.solo501 },
  { value: 'checkouts', label: pl.checkoutPractice },
];

const CHECKOUT_RANGES: readonly CheckoutRange[] = ['2-50', '51-100'];

const STARTING_SCORES: readonly StartingScore[] = [301, 501, 701];
const BEST_OF: readonly BestOf[] = [1, 3, 5];

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const tile = 'flex min-w-0 items-center rounded-(--radius-card) disabled:opacity-40';
const raised = 'bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) shadow-(--shadow-card)';
const flat = 'bg-(--color-surface-softer) shadow-(--shadow-inset-line)';

export type PlayerList = { status: 'loading' } | { status: 'error' } | { status: 'ready'; players: readonly Player[] };

export interface NewGameFormProps {
  setup: GameSetup;
  players: PlayerList;
  onTypeChange(type: MatchType): void;
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
  const full = max > 1 && count >= max;

  return (
    // Odstęp 4 px z ujemnym marginesem mieści pierścień fokusu kafla przy krawędzi przewijanej kolumny.
    <div className="-m-1 flex shrink-0 flex-col gap-5.5 p-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <h1 className="font-display text-[clamp(2.5rem,4vw,4rem)] leading-[0.9] font-black tracking-[0.01em]">{pl.newGame}</h1>

      {/* fieldset ma domyślnie min-inline-size: min-content, więc bez min-w-0 kafle nie zwężają się na tablecie. */}
      <fieldset className="flex min-w-0 flex-col">
        <legend className={`mb-2.5 ${label}`}>{pl.gameType}</legend>
        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
          {TYPES.map((option) => (
            <TypeTile
              key={option.value}
              name={option.label}
              description={option.description}
              icon={<option.Icon />}
              selected={setup.type === option.value}
              onSelect={() => props.onTypeChange(option.value)}
            />
          ))}
        </div>
      </fieldset>

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
              const selected = setup.playerIds.includes(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={!selected && full}
                  onClick={() => props.onPlayerToggle(player.id)}
                  className={`${tile} @container relative h-18 gap-2.5 pr-7 pl-3 @2xs:gap-3.5 @2xs:pr-4 @2xs:pl-4 ${selected ? `${raised} inset-ring-2 ${avatarRingClasses(player.color).insetRing}` : flat}`}
                >
                  <Avatar name={player.name} avatar={player.avatar} color={player.color} size="tile" />
                  {/* Avatar ma zostać pierwszym, a imię ostatnim dzieckiem kafla. Znaczek stoi między nimi, a na koniec przenosi go order-last.
                      W wąskim kaflu (telefon, 3 kolumny na tablecie) znaczek w rogu zostawia miejsce na imię. */}
                  {selected && <CheckBadge className="absolute top-1.5 right-1.5 order-last size-5.5 text-sm @2xs:static @2xs:size-7 @2xs:text-base" />}
                  <span className="min-w-0 flex-1 truncate text-left font-display text-[22px] font-bold xl:text-2xl">{player.name}</span>
                </button>
              );
            })}
          <button
            type="button"
            onClick={props.onNewPlayer}
            className={`${tile} h-18 justify-center border border-dashed border-(--color-border) bg-transparent px-3.5 font-display text-[22px] font-bold text-(--color-text-sub)`}
          >
            {pl.newPlayer}
          </button>
        </div>
        <p aria-live="polite" className="text-sm text-(--color-text-muted) sm:text-[17px]">
          {hint(setup, count >= min && count <= max)}
        </p>
      </fieldset>

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
              <Segment key={option.value} selected={setup.practiceMode === option.value} onSelect={() => props.onPracticeModeChange(option.value)}>
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
          <span className="flex shrink-0 items-center justify-center text-[26px] @xs:size-15 @xs:rounded-full @xs:bg-(--color-surface-soft) @xs:text-[34px]">{icon}</span>
          {selected && <CheckBadge className="size-5.5 text-sm sm:size-7.5 sm:text-lg @xs:order-last @xs:self-start" />}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5 @xs:flex-1 @xs:gap-1">
          <span id={`${id}-name`} className="font-display text-[22px] leading-none font-extrabold sm:text-[26px] @xs:text-[34px]">
            {name}
          </span>
          <span id={`${id}-description`} className={`text-xs leading-[1.25] sm:text-[15px] ${selected ? 'text-(--color-text-sub)' : 'text-(--color-text-muted)'}`}>
            {description}
          </span>
        </span>
      </span>
    </button>
  );
}

// Stan niesie aria-pressed, więc znaczek jest ukryty przed czytnikami ekranu.
function CheckBadge({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-(--color-accent) text-(--color-on-accent) ${className}`}>
      <CheckIcon />
    </span>
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
    <button type="button" aria-pressed={selected} onClick={onSelect} className="h-12 flex-1 px-4 text-[22px] whitespace-nowrap lg:h-15 xl:h-13">
      {children}
    </button>
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
