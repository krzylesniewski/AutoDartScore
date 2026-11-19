import { useId } from 'react';
import { pl } from '../i18n/pl';
import { CheckIcon } from './icons';

export interface TournamentToggleProps {
  name: string;
  hint: string;
  enabled: boolean;
  // Podany powód wyłącza przełącznik i stoi pod nim.
  unavailableReason?: string | null;
  onChange(next: boolean): void;
}

const pillBase = 'inline-flex h-8 shrink-0 items-center gap-1 rounded-(--radius-pill) font-display text-[17px] leading-none';

// Jak SoundToggleCard: stan niesie aria-pressed i pigułka z tekstem, a nazwą przycisku zostaje sama nazwa.
// Niedostępny przełącznik pokazuje się jako wyłączony, bo tak idzie do serwera.
export function TournamentToggle({ name, hint, enabled, unavailableReason = null, onChange }: TournamentToggleProps) {
  const id = useId();
  const available = unavailableReason === null;
  const on = enabled && available;
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-pressed={on}
        disabled={!available}
        aria-labelledby={`${id}-name`}
        aria-describedby={available ? `${id}-hint` : `${id}-hint ${id}-reason`}
        onClick={() => onChange(!enabled)}
        className={`flex min-h-16 w-full items-center gap-3 rounded-(--radius-card) px-4 py-2.5 text-left text-(--color-text) disabled:opacity-40 ${
          on
            ? 'bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) shadow-(--shadow-card)'
            : 'bg-(--color-surface-softer) shadow-(--shadow-inset-line)'
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={`${id}-name`} className={`font-display text-[22px] leading-none ${on ? 'font-extrabold' : 'font-bold'}`}>
            {name}
          </span>
          <span id={`${id}-hint`} className="text-sm text-(--color-text-muted) sm:text-[15px]">
            {hint}
          </span>
        </span>
        {on ? (
          <span aria-hidden="true" className={`${pillBase} bg-(--color-text) pr-3 pl-2 font-extrabold text-(--color-text-inverse)`}>
            <CheckIcon className="text-base" />
            {pl.toggleOn}
          </span>
        ) : (
          <span aria-hidden="true" className={`${pillBase} px-3 font-bold text-(--color-text-sub) shadow-(--shadow-outline)`}>
            {pl.toggleOff}
          </span>
        )}
      </button>
      {!available && (
        <p id={`${id}-reason`} className="text-sm text-(--color-text-muted) sm:text-[15px]">
          {unavailableReason}
        </p>
      )}
    </div>
  );
}
