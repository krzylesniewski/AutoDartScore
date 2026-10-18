import { useEffect, useId, useRef, type FormEvent } from 'react';
import { pl } from '../i18n/pl';

export interface ArchivePlayerDialogProps {
  name: string;
  onConfirm(): void;
  onCancel(): void;
}

const button = 'flex h-(--button-height) items-center justify-center rounded-(--radius-card) border-(length:--border-width) px-5 font-display text-(length:--text-button) font-semibold';

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
        className="flex w-full max-w-xl flex-col gap-4 rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface) p-6"
      >
        <h2 id={titleId} className="font-display text-(length:--text-heading) font-bold uppercase">
          {pl.archiveTitle}
        </h2>
        <p className="text-lg text-(--color-text-muted)">{pl.archiveText(name)}</p>
        <form onSubmit={confirm} className="grid grid-cols-2 gap-3">
          <button type="submit" className={`${button} border-(--color-accent) bg-(--color-accent) text-(--color-on-accent)`}>
            {pl.archive}
          </button>
          <button type="button" onClick={onCancel} className={`${button} border-(--color-border-strong) bg-(--color-surface-button)`}>
            {pl.cancel}
          </button>
        </form>
      </div>
    </div>
  );
}
