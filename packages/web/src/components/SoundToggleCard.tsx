import type { ReactNode } from 'react';
import { CheckIcon } from './icons';

export interface SoundToggleCardProps {
  enabled: boolean;
  disabled?: boolean;
  name: string;
  onText: string;
  offText: string;
  // Ikona w kolorze stanu, bo przełącznik zna tylko jej wariant włączony i wyłączony.
  icon: ReactNode;
  onChange(next: boolean): void;
}

const pillBase = 'inline-flex h-9.5 shrink-0 items-center gap-1.5 rounded-(--radius-pill) font-display text-[19px] leading-none';

// Przełącznik dźwięku na ekranie ustawień. Stan czyta czytnik z aria-pressed, a pigułka stanu jest tylko dla oka,
// więc nazwa przycisku zostaje gołą nazwą. Wypełnienie, ✓ i tekst pigułki pokazują stan, nie sam kolor.
export function SoundToggleCard({ enabled, disabled = false, name, onText, offText, icon, onChange }: SoundToggleCardProps) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`flex min-h-18 w-full items-center gap-4 rounded-(--radius-card) px-5 py-3 text-left text-(--color-text) disabled:opacity-40 lg:min-h-26 lg:gap-4.5 lg:px-6 ${
        enabled ? 'bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) shadow-(--shadow-card)' : 'bg-(--color-surface-softer) shadow-(--shadow-inset-line)'
      }`}
    >
      <span className="flex size-13 shrink-0 items-center justify-center rounded-full bg-(--color-surface-soft) text-[26px]">{icon}</span>
      <span className={`min-w-0 flex-1 font-display text-2xl leading-none lg:text-[30px] ${enabled ? 'font-extrabold' : 'font-bold'}`}>{name}</span>
      {enabled ? (
        <span aria-hidden="true" className={`${pillBase} bg-(--color-text) pr-3.5 pl-2.5 font-extrabold text-(--color-text-inverse)`}>
          <CheckIcon className="text-lg" />
          {onText}
        </span>
      ) : (
        <span aria-hidden="true" className={`${pillBase} px-3.5 font-bold text-(--color-text-sub) shadow-(--shadow-outline)`}>
          {offText}
        </span>
      )}
    </button>
  );
}
