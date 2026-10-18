import type { BestOf, MatchType, Player, PracticeMode, StartingScore } from '@autoscore/schema';
import type { FormEvent, ReactNode } from 'react';
import { PLAYER_COUNT, type GameSetup } from '../game/game-setup';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { WarningIcon } from './icons';

const TYPES: readonly { value: MatchType; label: string }[] = [
  { value: 'match', label: pl.typeMatch },
  { value: 'casual', label: pl.typeCasual },
  { value: 'practice', label: pl.typePractice },
];

const PRACTICE_MODES: readonly { value: PracticeMode; label: string }[] = [
  { value: 'free_run', label: pl.freeRun },
  { value: 'solo_501', label: pl.solo501 },
];

const STARTING_SCORES: readonly StartingScore[] = [301, 501, 701];
const BEST_OF: readonly BestOf[] = [1, 3, 5];

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const choice = 'flex min-h-13 items-center rounded-(--radius-card) border-(length:--border-width) font-display text-[22px] font-semibold disabled:opacity-40';

function choiceStyle(selected: boolean): string {
  return `${choice} ${selected ? 'border-(--color-text) bg-(--color-text) text-(--color-text-inverse)' : 'border-(--color-border-strong) bg-(--color-surface) text-(--color-text)'}`;
}

export type PlayerList = { status: 'loading' } | { status: 'error' } | { status: 'ready'; players: readonly Player[] };

export interface NewGameFormProps {
  setup: GameSetup;
  players: PlayerList;
  canStart: boolean;
  error: string | null;
  onTypeChange(type: MatchType): void;
  onPlayerToggle(playerId: string): void;
  onStartingScoreChange(value: StartingScore): void;
  onBestOfChange(value: BestOf): void;
  onPracticeModeChange(value: PracticeMode): void;
  onNewPlayer(): void;
  onStart(): void;
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
  const { setup, players, canStart, error } = props;
  const { min, max } = PLAYER_COUNT[setup.type];
  const count = setup.playerIds.length;
  const full = max > 1 && count >= max;

  function submit(event: FormEvent): void {
    event.preventDefault();
    props.onStart();
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-5">
      <h1 className="font-display text-[56px] leading-none font-bold uppercase">{pl.newGame}</h1>

      <Group legend={pl.gameType}>
        {TYPES.map((option) => (
          <button key={option.value} type="button" aria-pressed={setup.type === option.value} onClick={() => props.onTypeChange(option.value)} className={`${choiceStyle(setup.type === option.value)} px-5`}>
            {option.label}
          </button>
        ))}
      </Group>

      <fieldset className="flex min-h-0 shrink flex-col gap-3">
        <legend className={`mb-3 ${label}`}>{players.status === 'ready' ? pl.playersCount(players.players.length) : pl.players}</legend>
        {players.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
        {players.status === 'error' && <ErrorText text={pl.loadPlayersFailed} />}
        {players.status === 'ready' && players.players.length === 0 && <p className="text-(--color-text-muted)">{pl.noPlayers}</p>}
        {/* Przewijanie po około trzech rzędach, żeby długa lista graczy nie spychała przycisku startu. */}
        <div className="flex max-h-46 min-h-13 flex-wrap content-start gap-3 overflow-y-auto">
          {players.status === 'ready' &&
            players.players.map((player, index) => {
              const selected = setup.playerIds.includes(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={!selected && full}
                  onClick={() => props.onPlayerToggle(player.id)}
                  className={`${choiceStyle(selected)} gap-3 pr-5 pl-2`}
                >
                  <Avatar name={player.name} avatar={player.avatar} colorIndex={index} />
                  {player.name}
                </button>
              );
            })}
          <button type="button" onClick={props.onNewPlayer} className={`${choice} border-dashed border-(--color-border-strong) px-5 text-(--color-text-muted)`}>
            {pl.newPlayer}
          </button>
        </div>
        <p aria-live="polite" className="text-[17px] text-(--color-text-muted)">
          {hint(setup, count >= min && count <= max)}
        </p>
      </fieldset>

      <div className="flex flex-wrap gap-x-14 gap-y-5">
        {setup.type !== 'practice' && (
          <Group legend={pl.startingScore}>
            {STARTING_SCORES.map((value) => (
              <button key={value} type="button" aria-pressed={setup.startingScore === value} onClick={() => props.onStartingScoreChange(value)} className={`${choiceStyle(setup.startingScore === value)} min-w-18 justify-center px-4`}>
                {value}
              </button>
            ))}
          </Group>
        )}
        {setup.type === 'match' && (
          <Group legend={pl.bestOf}>
            {BEST_OF.map((value) => (
              <button key={value} type="button" aria-pressed={setup.bestOf === value} onClick={() => props.onBestOfChange(value)} className={`${choiceStyle(setup.bestOf === value)} px-4`}>
                {pl.bestOfOption(value)}
              </button>
            ))}
          </Group>
        )}
        {setup.type === 'practice' && (
          <Group legend={pl.practiceMode}>
            {PRACTICE_MODES.map((option) => (
              <button key={option.value} type="button" aria-pressed={setup.practiceMode === option.value} onClick={() => props.onPracticeModeChange(option.value)} className={`${choiceStyle(setup.practiceMode === option.value)} px-4`}>
                {option.label}
              </button>
            ))}
          </Group>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        {error && <ErrorText text={error} />}
        <button
          type="submit"
          disabled={!canStart}
          className="h-18 w-full shrink-0 rounded-(--radius-card) bg-(--color-accent) font-display text-3xl font-bold tracking-wider text-(--color-on-accent) uppercase disabled:opacity-40"
        >
          {pl.startGame}
        </button>
      </div>
    </form>
  );
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={`mb-3 ${label}`}>{legend}</legend>
      <div className="flex flex-wrap gap-3">{children}</div>
    </fieldset>
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
