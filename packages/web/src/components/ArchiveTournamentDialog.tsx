import type { TournamentListItem } from '@autoscore/schema';
import { useId, useRef, useState, type FormEvent } from 'react';
import { archiveTournament } from '../api/client';
import { apiErrorText } from '../api/error-text';
import { pl } from '../i18n/pl';
import { Dialog } from './Dialog';
import { WarningIcon } from './icons';

export interface ArchiveTournamentDialogProps {
  tournament: TournamentListItem;
  onArchived(id: string): void;
  onCancel(): void;
}

// Bez expectedSeq, bo lista turniejów nie zna eventSeq.
export function ArchiveTournamentDialog({ tournament, onArchived, onCancel }: ArchiveTournamentDialogProps) {
  const titleId = useId();
  const textId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function confirm(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (pending.current) {
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      await archiveTournament(tournament.id);
      onArchived(tournament.id);
    } catch (caught) {
      setError(apiErrorText(caught));
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog labelledBy={titleId} describedBy={textId} className="gap-5.5" busy={saving} onClose={onCancel}>
      <h2 id={titleId} className="relative font-display text-[32px] leading-none font-black tracking-[0.01em] uppercase sm:text-[40px]">
        {pl.archiveTournamentTitle}
      </h2>
      <p id={textId} className="relative text-[17px] text-(--color-text-sub)">
        {pl.archiveTournamentText(tournament.name)}
      </p>
      <form onSubmit={(event) => void confirm(event)} className="relative flex flex-col gap-5">
        {error && (
          <p role="alert" className="flex items-center gap-2.5 font-display text-xl font-bold text-(--color-text)">
            <WarningIcon className="shrink-0 text-(--color-accent)" />
            {error}
          </p>
        )}
        <div className="mt-1.5 grid grid-cols-2 gap-3">
          <button type="submit" disabled={saving} className="sc-btn sc-btn--primary h-15 rounded-(--radius-button) text-[26px]">
            {pl.archive}
          </button>
          <button type="button" disabled={saving} onClick={onCancel} className="sc-btn h-15 text-[24px] font-bold">
            {pl.cancel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
