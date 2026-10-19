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
  'rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) font-display text-(length:--text-heading) font-bold disabled:opacity-40';
const segmentKey = `${key} bg-(--color-surface-button) text-(--color-text)`;
// Jedna siatka na 10 kolumn. Poniżej xl 25 i Miss schodzą pod 1-20, a mnożnik zajmuje cały wiersz.
const multiplierRow = 'col-span-10 grid grid-cols-3 gap-2 xl:col-span-6';
const multiplierHeight = 'h-13 lg:h-[58px] xl:h-(--button-height)';
const segmentCell = 'col-span-2 h-14 lg:col-span-1 lg:h-[78px] xl:h-(--button-height)';
const lastRowCell = 'order-last col-span-5 h-14 lg:h-[62px] xl:order-none xl:col-span-2 xl:h-(--button-height)';

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
      <div role="group" aria-label={pl.multiplier} className={multiplierRow}>
        {MULTIPLIERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={multiplier === value}
            disabled={disabled}
            onClick={() => setMultiplier(value)}
            className={`${multiplierHeight} ${key} ${
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
        className={`${lastRowCell} ${segmentKey}`}
      >
        {multiplier === 2 ? pl.bull : BULL_SEGMENT}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => hit(MISS_SEGMENT, 0)}
        className={`${lastRowCell} ${key} bg-(--color-surface) text-(--color-text-muted)`}
      >
        {pl.miss}
      </button>
      {SEGMENTS.map((segment) => (
        <button key={segment} type="button" disabled={disabled} onClick={() => hit(segment, multiplier)} className={`${segmentCell} ${segmentKey}`}>
          {segment}
        </button>
      ))}
    </section>
  );
}
