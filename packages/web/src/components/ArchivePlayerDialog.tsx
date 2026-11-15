import { useId, type FormEvent } from 'react';
import { pl } from '../i18n/pl';
import { Dialog } from './Dialog';

export interface ArchivePlayerDialogProps {
  name: string;
  onConfirm(): void;
  onCancel(): void;
}

export function ArchivePlayerDialog({ name, onConfirm, onCancel }: ArchivePlayerDialogProps) {
  const titleId = useId();

  function confirm(event: FormEvent): void {
    event.preventDefault();
    onConfirm();
  }

  return (
    <Dialog labelledBy={titleId} className="gap-5.5" onClose={onCancel}>
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
    </Dialog>
  );
}
