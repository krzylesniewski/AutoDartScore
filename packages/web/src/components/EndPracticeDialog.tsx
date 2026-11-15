import { useId, type FormEvent } from 'react';
import { pl } from '../i18n/pl';
import { Dialog } from './Dialog';
import { StopIcon } from './icons';

export interface EndPracticeDialogProps {
  onConfirm(): void;
  onCancel(): void;
}

export function EndPracticeDialog({ onConfirm, onCancel }: EndPracticeDialogProps) {
  const titleId = useId();

  function confirm(event: FormEvent): void {
    event.preventDefault();
    onConfirm();
  }

  return (
    <Dialog labelledBy={titleId} className="gap-5" onClose={onCancel}>
      <h2 id={titleId} className="relative flex items-center gap-3.5 font-display text-[32px] leading-none font-black tracking-[0.01em] uppercase sm:text-[40px]">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-(--color-surface-soft) text-2xl">
          <StopIcon />
        </span>
        {pl.endPracticeTitle}
      </h2>
      <p className="relative text-[17px] leading-snug text-(--color-text-sub)">{pl.endPracticeText}</p>
      <form onSubmit={confirm} className="relative mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="submit" className="sc-btn sc-btn--primary h-15 rounded-(--radius-button) text-[26px]">
          {pl.endPractice}
        </button>
        <button type="button" onClick={onCancel} className="sc-btn h-15 text-[24px] font-bold">
          {pl.cancel}
        </button>
      </form>
    </Dialog>
  );
}
