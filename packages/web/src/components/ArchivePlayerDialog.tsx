import { useEffect, useId, useRef, type FormEvent } from 'react';
import { pl } from '../i18n/pl';
import { CornerRings } from './CornerRings';

export interface ArchivePlayerDialogProps {
  name: string;
  onConfirm(): void;
  onCancel(): void;
}

export function ArchivePlayerDialog({ name, onConfirm, onCancel }: ArchivePlayerDialogProps) {
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
        className="relative flex w-full max-w-160 flex-col gap-5.5 overflow-hidden rounded-(--radius-panel) bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) px-5 pt-6 pb-5 shadow-(--shadow-card) sm:px-8 sm:pt-7.5 sm:pb-7"
      >
        <CornerRings className="-top-20 -right-20 size-60" />
        <h2 id={titleId} className="relative font-display text-[32px] leading-none font-black tracking-[0.01em] uppercase sm:text-[40px]">
          {pl.archiveTitle}
        </h2>
        <p className="relative text-[17px] text-(--color-text-sub)">{pl.archiveText(name)}</p>
        <form onSubmit={confirm} className="relative mt-1.5 grid grid-cols-2 gap-3">
          <button type="submit" className="sc-btn sc-btn--primary h-15 rounded-(--radius-button) text-[26px]">
            {pl.archive}
          </button>
          <button type="button" onClick={onCancel} className="sc-btn h-15 text-[24px] font-bold">
            {pl.cancel}
          </button>
        </form>
      </div>
    </div>
  );
}
