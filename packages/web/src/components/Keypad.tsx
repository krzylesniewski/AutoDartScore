import { BULL_SEGMENT, MISS_SEGMENT, type Hit } from '@autoscore/schema';
import { useState } from 'react';
import { pl } from '../i18n/pl';

type Multiplier = 1 | 2 | 3;

const MULTIPLIERS: readonly { value: Multiplier; label: string }[] = [
  { value: 1, label: pl.multiplierSingle },
  { value: 2, label: pl.multiplierDouble },
  { value: 3, label: pl.multiplierTreble },
];

const SEGMENTS = Array.from({ length: 20 }, (_, index) => index + 1);

const key =
  'h-(--button-height) rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) font-display text-(length:--text-heading) font-bold disabled:opacity-40';
const segmentKey = `${key} bg-(--color-surface-button) text-(--color-text)`;

export interface KeypadProps {
  onHit(hit: Hit): void;
  disabled: boolean;
}

export function Keypad({ onHit, disabled }: KeypadProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);

  function hit(segment: number, value: Hit['multiplier']): void {
    onHit({ segment, multiplier: value });
    setMultiplier(1);
  }

  return (
    <section aria-label={pl.keypad} className="grid grid-cols-10 gap-2">
      <div role="group" aria-label={pl.multiplier} className="col-span-6 grid grid-cols-3 gap-2">
        {MULTIPLIERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={multiplier === value}
            disabled={disabled}
            onClick={() => setMultiplier(value)}
            className={`${key} ${
              multiplier === value ? 'border-(--color-text) bg-(--color-text) text-(--color-text-inverse)' : 'bg-(--color-surface-button) text-(--color-text-muted)'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || multiplier === 3}
        onClick={() => hit(BULL_SEGMENT, multiplier === 2 ? 2 : 1)}
        className={`col-span-2 ${segmentKey}`}
      >
        {multiplier === 2 ? pl.bull : BULL_SEGMENT}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => hit(MISS_SEGMENT, 0)}
        className={`col-span-2 ${key} bg-(--color-surface) text-(--color-text-muted)`}
      >
        {pl.miss}
      </button>
      {SEGMENTS.map((segment) => (
        <button key={segment} type="button" disabled={disabled} onClick={() => hit(segment, multiplier)} className={segmentKey}>
          {segment}
        </button>
      ))}
    </section>
  );
}
