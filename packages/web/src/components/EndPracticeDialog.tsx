import { useEffect, useId, useRef, type FormEvent } from 'react';
import { pl } from '../i18n/pl';
import { CornerRings } from './CornerRings';
import { StopIcon } from './icons';

export interface EndPracticeDialogProps {
  onConfirm(): void;
  onCancel(): void;
}

export function EndPracticeDialog({ onConfirm, onCancel }: EndPracticeDialogProps) {
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

  function confirm(event: FormEvent): void {
    event.preventDefault();
    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-(--color-bg)/80 p-(--space-page)">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-full w-full max-w-160 flex-col gap-5 overflow-x-hidden overflow-y-auto rounded-(--radius-panel) bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) px-5 pt-6 pb-5 shadow-(--shadow-card) sm:px-8 sm:pt-7.5 sm:pb-7"
      >
        {/* overflow-x-hidden przycina tarczę w rogu, żeby nie dodała przewijania w poziomie. */}
        <CornerRings className="-top-20 -right-20 size-60" />
        <h2 id={titleId} className="relative flex items-center gap-3.5 font-display text-[32px] leading-none font-black tracking-[0.01em] uppercase sm:text-[40px]">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-(--color-surface-soft) text-2xl">
            <StopIcon />
          </span>
          {pl.endPracticeTitle}
        </h2>
        <p className="relative text-[17px] leading-snug text-(--color-text-sub)">{pl.endPracticeText}</p>
        <form onSubmit={confirm} className="relative mt-1.5 grid grid-cols-2 gap-3">
          <button type="submit" className="sc-btn sc-btn--primary h-15 rounded-(--radius-button) text-[26px]">
            {pl.endPractice}
          </button>
          <button type="button" onClick={onCancel} className="sc-btn h-15 text-[24px] font-bold">
            {pl.cancel}
          </button>
        </form>
      </div>
    </div>
  );
}
