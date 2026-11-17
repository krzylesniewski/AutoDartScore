import { TOURNAMENT_PLAYER_LIMITS, type StartingScore, type TournamentAdvance, type TournamentFormat } from '@autoscore/schema';
import { useId, type ReactNode } from 'react';
import type { GameKind } from '../game/game-kind';
import {
  changeTournamentFormat,
  extrasAvailable,
  FORMAT_LABELS,
  legsPhases,
  MAX_LEGS,
  MIN_LEGS,
  phaseLabel,
  pickTournamentPlayer,
  stepLegs,
  type TournamentSetup,
} from '../game/tournament-setup';
import { pl } from '../i18n/pl';
import { GameTypeTiles } from './GameTypeTiles';
import { PlayerPicker, type PlayerList } from './PlayerPicker';
import { TournamentToggle } from './TournamentToggle';
import { WarningIcon } from './icons';

const FORMATS: readonly TournamentFormat[] = ['league', 'cup', 'group_playoff'];

const STARTING_SCORES: readonly StartingScore[] = [301, 501, 701];
const ADVANCE: readonly TournamentAdvance[] = [2, 4, 8];

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const sublabel = 'font-display text-xl font-bold text-(--color-text-sub)';

export interface TournamentFormProps {
  setup: TournamentSetup;
  players: PlayerList;
  onKindChange(kind: GameKind): void;
  onChange(update: (current: TournamentSetup) => TournamentSetup): void;
  onNewPlayer(): void;
}

function playersHint(setup: TournamentSetup): string {
  const { min, max } = TOURNAMENT_PLAYER_LIMITS[setup.format];
  const count = setup.playerIds.length;
  return count === 0 ? pl.tournamentPlayerCount(min, max) : pl.playersSelected(count, max);
}

export function TournamentForm({ setup, players, onKindChange, onChange, onNewPlayer }: TournamentFormProps) {
  const nameId = useId();
  const nameErrorId = useId();
  const nameEmpty = setup.name.trim() === '';
  const available = extrasAvailable(setup);

  return (
    // Odstęp 4 px z ujemnym marginesem mieści pierścień fokusu kafla przy krawędzi przewijanej kolumny.
    <div className="-m-1 flex shrink-0 flex-col gap-5.5 p-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <h1 className="font-display text-[clamp(2.5rem,4vw,4rem)] leading-[0.9] font-black tracking-[0.01em]">{pl.newGame}</h1>

      <GameTypeTiles kind="tournament" onKindChange={onKindChange} />

      <div className="flex flex-col gap-2.5">
        <label htmlFor={nameId} className={label}>
          {pl.tournamentName}
        </label>
        <input
          id={nameId}
          type="text"
          value={setup.name}
          maxLength={60}
          aria-invalid={nameEmpty}
          aria-describedby={nameEmpty ? nameErrorId : undefined}
          onChange={(event) => {
            const name = event.target.value;
            onChange((current) => ({ ...current, name }));
          }}
          className="h-13 w-full min-w-0 rounded-(--radius-card) bg-(--color-surface-softer) px-4 font-display text-2xl font-bold text-(--color-text) shadow-(--shadow-inset-line)"
        />
        {nameEmpty && (
          <p id={nameErrorId} className="flex items-center gap-2 font-display text-lg text-(--color-text)">
            <WarningIcon className="text-(--color-accent)" />
            {pl.tournamentNameRequired}
          </p>
        )}
      </div>

      <Choice legend={pl.tournamentFormat} legendClassName={label}>
        {FORMATS.map((format) => (
          <ChoiceButton
            key={format}
            selected={setup.format === format}
            onSelect={() => onChange((current) => changeTournamentFormat(current, format))}
          >
            {FORMAT_LABELS[format]}
          </ChoiceButton>
        ))}
      </Choice>

      <div className="flex flex-col gap-2.5">
        <PlayerPicker
          players={players}
          selectedIds={setup.playerIds}
          max={TOURNAMENT_PLAYER_LIMITS[setup.format].max}
          hint={playersHint(setup)}
          onToggle={(playerId) => onChange((current) => pickTournamentPlayer(current, playerId))}
          onNewPlayer={onNewPlayer}
        />
        <p className="text-sm text-(--color-text-muted) sm:text-[17px]">
          {setup.format === 'cup' ? pl.tournamentDrawCup : pl.tournamentDrawRoundRobin}
        </p>
      </div>

      <section aria-labelledby={`${nameId}-rules`} className="flex flex-col gap-4">
        <h2 id={`${nameId}-rules`} className={label}>
          {pl.tournamentRules}
        </h2>
        <Choice legend={pl.startingScore} legendClassName={sublabel}>
          {STARTING_SCORES.map((value) => (
            <ChoiceButton
              key={value}
              selected={setup.startingScore === value}
              onSelect={() => onChange((current) => ({ ...current, startingScore: value }))}
            >
              {value}
            </ChoiceButton>
          ))}
        </Choice>
        {setup.format === 'group_playoff' && (
          <Choice legend={pl.advance} legendClassName={sublabel} description={pl.advancePairs[setup.advance]}>
            {ADVANCE.map((value) => (
              <ChoiceButton
                key={value}
                selected={setup.advance === value}
                onSelect={() => onChange((current) => ({ ...current, advance: value }))}
              >
                {value}
              </ChoiceButton>
            ))}
          </Choice>
        )}
      </section>

      {setup.format !== 'league' && (
        <section aria-labelledby={`${nameId}-extras`} className="flex flex-col gap-2.5">
          <h2 id={`${nameId}-extras`} className={label}>
            {pl.extraMatches}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TournamentToggle
              name={pl.phaseThirdPlace}
              hint={pl.thirdPlaceHint}
              unavailableReason={available.thirdPlace ? null : pl.thirdPlaceUnavailable}
              enabled={setup.thirdPlaceMatch}
              onChange={(thirdPlaceMatch) => onChange((current) => ({ ...current, thirdPlaceMatch }))}
            />
            {setup.format === 'group_playoff' && (
              <TournamentToggle
                name={pl.phaseConsolation}
                hint={pl.consolationHint}
                unavailableReason={available.consolation ? null : pl.consolationUnavailable}
                enabled={setup.consolation}
                onChange={(consolation) => onChange((current) => ({ ...current, consolation }))}
              />
            )}
          </div>
        </section>
      )}

      <section aria-labelledby={`${nameId}-legs`} className="flex flex-col gap-2.5">
        <h2 id={`${nameId}-legs`} className={label}>
          {pl.matchLength}
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {legsPhases(setup).map((phase) => (
            <LegsRow
              key={phase}
              name={phaseLabel(phase, setup.format)}
              value={setup.legsToWin[phase]}
              onStep={(delta) => onChange((current) => stepLegs(current, phase, delta))}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

// Opis stoi poza legend, żeby nazwą grupy została sama legenda.
function Choice({
  legend,
  legendClassName,
  description,
  children,
}: {
  legend: string;
  legendClassName: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={description ? id : undefined} className="flex min-w-0 flex-col">
      <legend className={`mb-2 ${legendClassName}`}>{legend}</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="sc-seg min-w-0 sm:w-fit">{children}</div>
        {description && (
          <p id={id} className="text-[15px] text-(--color-text-muted) sm:text-[17px]">
            {description}
          </p>
        )}
      </div>
    </fieldset>
  );
}

function ChoiceButton({ selected, onSelect, children }: { selected: boolean; onSelect(): void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className="flex-auto px-3 whitespace-nowrap sm:min-w-16">
      {children}
    </button>
  );
}

function LegsRow({ name, value, onStep }: { name: string; value: number; onStep(delta: number): void }) {
  const stepper = 'sc-btn sc-btn--outline sc-btn--icon shrink-0 text-2xl font-bold';
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-(--radius-card) bg-(--color-surface-softer) py-1.5 pr-1.5 pl-4 shadow-(--shadow-inset-line)">
      <span className="min-w-0 flex-1 truncate font-display text-xl font-bold">{name}</span>
      <button type="button" aria-label={pl.fewerLegs(name)} disabled={value <= MIN_LEGS} onClick={() => onStep(-1)} className={stepper}>
        −
      </button>
      <span className="w-6 text-center font-display text-2xl font-extrabold tabular-nums">{value}</span>
      <button type="button" aria-label={pl.moreLegs(name)} disabled={value >= MAX_LEGS} onClick={() => onStep(1)} className={stepper}>
        +
      </button>
    </li>
  );
}
