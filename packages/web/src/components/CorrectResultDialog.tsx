import type { Fixture, TournamentView } from '@autoscore/schema';
import { useId, useRef, useState, type FormEvent } from 'react';
import { correctResult } from '../api/client';
import { apiErrorText } from '../api/error-text';
import { fixtureLabel } from '../game/fixture-label';
import { correctableFixtures, correctionImpact, isValidCorrection, type CorrectionImpact } from '../game/tournament-incidents';
import { slotText } from '../game/tournament-slot';
import { pl } from '../i18n/pl';
import { Dialog } from './Dialog';
import { WarningIcon } from './icons';

export interface CorrectResultDialogProps {
  view: TournamentView;
  onSaved(view: TournamentView): void;
  onFailed(): void;
  onCancel(): void;
}

type Legs = readonly [number, number];

interface Selection {
  readonly fixtureId: string | null;
  readonly legs: Legs;
}

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const input = 'h-14 rounded-(--radius-button) border-0 bg-(--color-bg)/55 px-4 shadow-(--shadow-outline)';

const IMPACT_TEXT: Readonly<Record<CorrectionImpact, string>> = {
  league: pl.correctionImpactLeague,
  group: pl.correctionImpactGroup,
  bracket: pl.correctionImpactBracket,
};

function currentLegs(fixture: Fixture | undefined): Legs {
  return fixture?.result ? fixture.result.legs : [0, 0];
}

// Domyślnie ostatnio rozegrany mecz, bo to on najczęściej ma błędny wynik.
function defaultSelection(fixtures: readonly Fixture[]): Selection {
  const last = fixtures.at(-1);
  return { fixtureId: last?.id ?? null, legs: currentLegs(last) };
}

function sameLegs(first: Legs, second: Legs): boolean {
  return first[0] === second[0] && first[1] === second[1];
}

function winnerId(fixture: Fixture, legs: Legs): string | null {
  const index = legs.indexOf(fixture.legsToWin);
  const slot = index === -1 ? undefined : fixture.slots[index];
  return slot?.kind === 'player' ? slot.playerId : null;
}

function LegsStepper({ name, value, max, onStep }: { name: string; value: number; max: number; onStep(delta: number): void }) {
  const stepper = 'sc-btn sc-btn--outline sc-btn--icon shrink-0 text-2xl font-bold';
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-(--radius-card) bg-(--color-surface-softer) py-1.5 pr-1.5 pl-4 shadow-(--shadow-inset-line)">
      <span className="min-w-0 flex-1 truncate font-display text-xl font-bold">{name}</span>
      <button type="button" aria-label={pl.fewerLegs(name)} disabled={value <= 0} onClick={() => onStep(-1)} className={stepper}>
        −
      </button>
      <span className="w-6 text-center font-display text-2xl font-extrabold tabular-nums">{value}</span>
      <button type="button" aria-label={pl.moreLegs(name)} disabled={value >= max} onClick={() => onStep(1)} className={stepper}>
        +
      </button>
    </li>
  );
}

export function CorrectResultDialog({ view, onSaved, onFailed, onCancel }: CorrectResultDialogProps) {
  const titleId = useId();
  const selectId = useId();
  const textId = useId();
  const fixtures = correctableFixtures(view);
  const [selection, setSelection] = useState<Selection>(() => defaultSelection(fixtures));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const select = useRef<HTMLSelectElement>(null);

  // Aktualizacja na żywo może zabrać wybrany mecz (np. cofnięcie rzutki kończącej). Wtedy wraca wybór domyślny.
  const fixture = fixtures.find((entry) => entry.id === selection.fixtureId);
  if (!fixture && selection.fixtureId !== (fixtures.at(-1)?.id ?? null)) {
    setSelection(defaultSelection(fixtures));
  }

  const legs = selection.legs;
  const valid = fixture !== undefined && isValidCorrection(legs, fixture.legsToWin);
  const unchanged = fixture === undefined || sameLegs(legs, currentLegs(fixture));
  const newWinner = fixture && valid ? winnerId(fixture, legs) : null;
  const winnerChanges = newWinner !== null && newWinner !== fixture?.result?.winnerId;
  const winnerName = view.players.find((player) => player.id === newWinner)?.name ?? '';

  function choose(fixtureId: string): void {
    setSelection({ fixtureId, legs: currentLegs(fixtures.find((entry) => entry.id === fixtureId)) });
  }

  function step(slot: 0 | 1, delta: number): void {
    if (!fixture) {
      return;
    }
    const next = Math.min(fixture.legsToWin, Math.max(0, legs[slot] + delta));
    setSelection({ fixtureId: fixture.id, legs: slot === 0 ? [next, legs[1]] : [legs[0], next] });
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!fixture || pending.current) {
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      onSaved(await correctResult(view.id, fixture.id, legs, view.eventSeq));
    } catch (caught) {
      setError(apiErrorText(caught));
      pending.current = false;
      setSaving(false);
      onFailed();
    }
  }

  return (
    <Dialog
      labelledBy={titleId}
      {...(fixture ? { describedBy: textId } : {})}
      className="gap-5"
      initialFocus={select}
      busy={saving}
      onClose={onCancel}
    >
      <h2 id={titleId} className="relative font-display text-[32px] leading-none font-black tracking-[0.01em] uppercase sm:text-[40px]">
        {pl.correctResult}
      </h2>
      <form onSubmit={(event) => void save(event)} className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={selectId} className={label}>
            {pl.correctionFixture}
          </label>
          {/* scheme-dark, bo natywna lista opcji bierze kolory z systemu, a motyw nie ustawia color-scheme. */}
          <select
            ref={select}
            id={selectId}
            value={fixture?.id ?? ''}
            onChange={(event) => choose(event.target.value)}
            className={`${input} min-w-0 text-lg scheme-dark`}
          >
            {fixtures.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {pl.correctionOption(
                  fixtureLabel(view.format, entry),
                  slotText(view, entry.slots[0]),
                  pl.legsCell(...currentLegs(entry)),
                  slotText(view, entry.slots[1]),
                )}
              </option>
            ))}
          </select>
        </div>
        {fixture && (
          <fieldset className="flex min-w-0 flex-col">
            <legend className={`mb-2.5 ${label}`}>{pl.correctionLegs}</legend>
            <ul className="flex flex-col gap-2.5">
              {([0, 1] as const).map((slot) => (
                <LegsStepper
                  key={slot}
                  name={slotText(view, fixture.slots[slot])}
                  value={legs[slot]}
                  max={fixture.legsToWin}
                  onStep={(delta) => step(slot, delta)}
                />
              ))}
            </ul>
          </fieldset>
        )}
        {fixture && (
          <div id={textId} className="flex flex-col gap-1.5 text-[17px] leading-snug text-(--color-text-sub)">
            <p>{pl.correctionRule(fixture.legsToWin)}</p>
            <p>{IMPACT_TEXT[correctionImpact(view, fixture)]}</p>
            {winnerChanges && <p className="font-semibold text-(--color-text)">{pl.correctionNewWinner(winnerName)}</p>}
            <p>{pl.correctionKeepsThrows}</p>
          </div>
        )}
        {error && (
          <p role="alert" className="flex items-center gap-2.5 font-display text-xl font-bold text-(--color-text)">
            <WarningIcon className="shrink-0 text-(--color-accent)" />
            {error}
          </p>
        )}
        <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="submit"
            disabled={saving || !valid || unchanged}
            className="sc-btn sc-btn--primary h-15 rounded-(--radius-button) text-[26px]"
          >
            {pl.correctResult}
          </button>
          <button type="button" disabled={saving} onClick={onCancel} className="sc-btn h-15 text-[24px] font-bold">
            {pl.cancel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
