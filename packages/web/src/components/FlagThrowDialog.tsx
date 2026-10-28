import type { ReviewedThrow } from '@autoscore/schema';
import { useEffect, useId, useRef } from 'react';
import { hitLabel } from '../game/hit-label';
import { pl } from '../i18n/pl';
import { FlagIcon } from './icons';

export interface FlagThrowDialogProps {
  throws: readonly { slot: number; entry: ReviewedThrow }[];
  onPick(throwId: string): void;
  onCancel(): void;
}

const button =
  'flex min-h-(--button-height) items-center justify-center gap-2 rounded-(--radius-card) border-(length:--border-width) px-5 font-display text-(length:--text-button) font-semibold';

export function FlagThrowDialog({ throws, onPick, onCancel }: FlagThrowDialogProps) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-(--color-bg)/80 p-(--space-page)">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex w-full max-w-xl flex-col gap-4 rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface) p-6"
      >
        <h2 id={titleId} className="font-display text-(length:--text-heading) leading-tight font-bold uppercase">
          {pl.flagThrowTitle}
        </h2>
        <div className="flex flex-col gap-3">
          {throws.map(({ slot, entry }) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPick(entry.id)}
              className={`${button} border-(--color-accent) bg-(--color-bg)`}
            >
              <FlagIcon />
              {pl.flagThrowOption(slot, hitLabel(entry.value))}
            </button>
          ))}
          <button type="button" onClick={onCancel} className={`${button} border-(--color-border-strong) bg-(--color-surface-button)`}>
            {pl.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
