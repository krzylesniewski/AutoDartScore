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

const key = 'min-h-12 min-w-12 rounded-card border border-line font-display text-2xl font-semibold disabled:opacity-40';

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
    <section aria-label={pl.keypad} className="flex flex-col gap-2">
      <div role="group" aria-label={pl.multiplier} className="grid grid-cols-3 gap-2">
        {MULTIPLIERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={multiplier === value}
            disabled={disabled}
            onClick={() => setMultiplier(value)}
            className={`${key} ${multiplier === value ? 'border-board-green bg-board-green text-cream' : 'bg-surface text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {SEGMENTS.map((segment) => (
          <button key={segment} type="button" disabled={disabled} onClick={() => hit(segment, multiplier)} className={`${key} bg-surface-raised`}>
            {segment}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || multiplier === 3}
          onClick={() => hit(BULL_SEGMENT, multiplier === 2 ? 2 : 1)}
          className={`${key} bg-surface-raised`}
        >
          {multiplier === 2 ? pl.bull : BULL_SEGMENT}
        </button>
        <button type="button" disabled={disabled} onClick={() => hit(MISS_SEGMENT, 0)} className={`${key} bg-surface text-muted`}>
          {pl.miss}
        </button>
      </div>
    </section>
  );
}
