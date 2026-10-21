import type { BestOf, MatchType, Player, PracticeMode, StartingScore } from '@autoscore/schema';
import { useId, type ReactNode } from 'react';
import { PLAYER_COUNT, type GameSetup } from '../game/game-setup';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { PlayersIcon, StarIcon, TargetIcon, WarningIcon } from './icons';

const TYPES: readonly { value: MatchType; label: string; description: string; Icon: typeof TargetIcon }[] = [
  { value: 'match', label: pl.typeMatch, description: pl.typeMatchDescription, Icon: PlayersIcon },
  { value: 'casual', label: pl.typeCasual, description: pl.typeCasualDescription, Icon: StarIcon },
  { value: 'practice', label: pl.typePractice, description: pl.typePracticeDescription, Icon: TargetIcon },
];

const PRACTICE_MODES: readonly { value: PracticeMode; label: string }[] = [
  { value: 'free_run', label: pl.freeRun },
  { value: 'solo_501', label: pl.solo501 },
];

const STARTING_SCORES: readonly StartingScore[] = [301, 501, 701];
const BEST_OF: readonly BestOf[] = [1, 3, 5];

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const tile = 'flex min-w-0 items-center rounded-(--radius-card) border-(length:--border-width) disabled:opacity-40';

export type PlayerList = { status: 'loading' } | { status: 'error' } | { status: 'ready'; players: readonly Player[] };

export interface NewGameFormProps {
  setup: GameSetup;
  players: PlayerList;
  onTypeChange(type: MatchType): void;
  onPlayerToggle(playerId: string): void;
  onStartingScoreChange(value: StartingScore): void;
  onBestOfChange(value: BestOf): void;
  onPracticeModeChange(value: PracticeMode): void;
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
    <div className="flex shrink-0 flex-col gap-5.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <h1 className="sr-only">{pl.newGame}</h1>

      {/* fieldset ma domyślnie min-inline-size: min-content, więc bez min-w-0 kafle nie zwężają się na tablecie. */}
      <fieldset className="flex min-w-0 flex-col">
        <legend className={`mb-2.5 ${label}`}>{pl.gameType}</legend>
        <div className="flex flex-col gap-3.5 sm:flex-row">
          {TYPES.map((option) => (
            <TypeTile
              key={option.value}
              name={option.label}
              description={option.description}
              icon={<option.Icon className="text-[34px]" />}
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
        {/* Po trzech rzędach lista przewija się w środku, żeby nie spychała punktów i legów pod pasek ze Startem. */}
        <div className="grid max-h-61 min-h-18 grid-cols-2 content-start gap-3.5 overflow-y-auto lg:grid-cols-3 xl:grid-cols-4">
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
                  className={`${tile} h-18 gap-3 px-3.5 ${selected ? 'border-(--color-text) bg-(--color-surface-active)' : 'border-(--color-border-strong) bg-(--color-surface)'}`}
                >
                  <Avatar name={player.name} avatar={player.avatar} color={player.color} size="tile" />
                  <span className="truncate font-display text-[22px] font-semibold">{player.name}</span>
                </button>
              );
            })}
          <button
            type="button"
            onClick={props.onNewPlayer}
            className={`${tile} h-18 justify-center border-dashed border-(--color-border-strong) px-3.5 font-display text-[22px] font-semibold text-(--color-text-muted)`}
          >
            {pl.newPlayer}
          </button>
        </div>
        <p aria-live="polite" className="text-[17px] text-(--color-text-muted)">
          {hint(setup, count >= min && count <= max)}
        </p>
      </fieldset>

      <div className="flex flex-col gap-5 lg:max-xl:rounded-(--radius-card) lg:max-xl:border-(length:--border-width) lg:max-xl:border-(--color-border) lg:max-xl:bg-(--color-surface) lg:max-xl:p-7 xl:flex-row xl:flex-wrap xl:gap-x-8 xl:gap-y-5">
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
function TypeTile({ name, description, icon, selected, onSelect }: TypeTileProps) {
  const id = useId();
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-labelledby={`${id}-name`}
      aria-describedby={`${id}-description`}
      onClick={onSelect}
      className={`${tile} h-16 flex-1 gap-4 px-4.5 text-left sm:h-23 ${selected ? 'border-(--color-text) bg-(--color-text) text-(--color-text-inverse)' : 'border-(--color-border-strong) bg-(--color-surface) text-(--color-text)'}`}
    >
      {icon}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span id={`${id}-name`} className="font-display text-[26px] leading-[1.1] font-bold">
          {name}
        </span>
        <span id={`${id}-description`} className={`truncate text-[15px] ${selected ? 'text-(--color-text-inverse)' : 'text-(--color-text-muted)'}`}>
          {description}
        </span>
      </span>
    </button>
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
      <div className="flex overflow-hidden rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface)">{children}</div>
    </fieldset>
  );
}

function Segment({ selected, onSelect, children }: { selected: boolean; onSelect(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`h-12 flex-1 border-(--color-border) lg:h-15 xl:h-12 px-4 font-display text-[21px] font-semibold whitespace-nowrap not-first:border-l-(length:--border-width) ${selected ? 'bg-(--color-text) text-(--color-text-inverse)' : 'text-(--color-text)'}`}
    >
      {children}
    </button>
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 font-display text-xl text-(--color-accent)">
      <WarningIcon />
      {text}
    </p>
  );
}
