import type { Hit, ReviewedThrow } from '@autoscore/schema';
import { useId } from 'react';
import { hitLabel } from '../game/hit-label';
import { reviewOptions } from '../game/review-options';
import { pl } from '../i18n/pl';
import { WarningIcon } from './icons';

export interface PendingThrowPanelProps {
  entry: ReviewedThrow;
  slot: number;
  busy: boolean;
  disabled: boolean;
  correcting: boolean;
  // Tura z odczytu jest skończona, więc klawiatura przyjmuje tylko poprawkę.
  turnClosed: boolean;
  onConfirm(hit: Hit): void;
  onCorrect(): void;
  onCancelCorrection(): void;
}

const button =
  'flex min-h-11 items-center justify-center gap-2 rounded-(--radius-card) border-(length:--border-width) px-3 py-1 text-center font-display text-(length:--text-button) leading-tight font-semibold disabled:opacity-40';

export function PendingThrowPanel({ entry, slot, busy, disabled, correcting, turnClosed, onConfirm, onCorrect, onCancelCorrection }: PendingThrowPanelProps) {
  const titleId = useId();
  const off = busy || disabled;
  const reading = hitLabel(entry.value);

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-2 rounded-(--radius-card) border-(length:--border-width) border-(--color-accent) bg-(--color-surface) p-3 lg:px-4 lg:py-2"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id={titleId} className="flex items-center gap-2 font-display text-xl leading-tight font-bold">
          <WarningIcon className="shrink-0 text-(--color-accent)" />
          {pl.pendingTitle(slot)}
        </h2>
        {entry.review && <span className="text-(--color-text-muted)">{pl.reviewReason[entry.review.reason]}</span>}
        <span className="font-display text-lg font-semibold">{pl.reviewReading(reading)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={off}
          onClick={() => onConfirm(entry.value)}
          className={`${button} border-(--color-accent) bg-(--color-accent) text-(--color-on-accent)`}
        >
          {pl.confirmThrow(reading)}
        </button>
        {reviewOptions(entry).map((candidate) => (
          <button
            key={`${candidate.segment}-${candidate.multiplier}`}
            type="button"
            disabled={off}
            onClick={() => onConfirm({ segment: candidate.segment, multiplier: candidate.multiplier })}
            className={`${button} border-(--color-border-strong) bg-(--color-surface-button) tabular-nums`}
          >
            {hitLabel(candidate)}{' '}
            <span className="text-base font-normal text-(--color-text-muted)">{pl.candidatePercent(Math.round(candidate.probability * 100))}</span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={correcting}
          disabled={off}
          onClick={correcting ? onCancelCorrection : onCorrect}
          className={`${button} ${correcting ? 'border-(--color-text) bg-(--color-text) text-(--color-text-inverse)' : 'border-(--color-border-strong) bg-(--color-surface-button)'}`}
        >
          {pl.correctWithKeypad}
        </button>
      </div>
      {correcting ? (
        <p className="text-(--color-text-muted)">{pl.correctingHint(slot)}</p>
      ) : (
        turnClosed && (
          <p className="flex items-center gap-2 font-display text-lg leading-tight">
            <WarningIcon className="shrink-0 text-(--color-accent)" />
            {pl.turnClosedAwaitingReview}
          </p>
        )
      )}
    </section>
  );
}
