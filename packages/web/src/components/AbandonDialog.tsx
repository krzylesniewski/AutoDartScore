import type { MatchSnapshot } from '@autoscore/schema';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { pl } from '../i18n/pl';

export interface AbandonDialogProps {
  state: MatchSnapshot;
  onConfirm(playerId: string, reason: string | null): void;
  onCancel(): void;
}

const button = 'flex h-(--button-height) items-center justify-center rounded-(--radius-card) border-(length:--border-width) px-5 font-display text-(length:--text-button) font-semibold';
const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

export function AbandonDialog({ state, onConfirm, onCancel }: AbandonDialogProps) {
  const titleId = useId();
  const [playerId, setPlayerId] = useState(() => state.currentPlayerId ?? state.players[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const dialog = useRef<HTMLDivElement>(null);

  // Fokus na oknie, a nie na polu powodu, żeby na tablecie nie wyskakiwała klawiatura.
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
    onConfirm(playerId, reason.trim() === '' ? null : reason);
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
          {pl.abandonTitle}
        </h2>
        <p className="text-lg text-(--color-text-muted)">{pl.abandonText}</p>
        <form onSubmit={confirm} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className={`mb-2 ${label}`}>{pl.abandonedBy}</legend>
            {state.players.map((player) => (
              <label key={player.id} className="flex min-h-12 items-center gap-3 font-display text-xl">
                <input type="radio" name="abandoned-by" value={player.id} checked={playerId === player.id} onChange={() => setPlayerId(player.id)} className="h-6 w-6" />
                {player.name}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className={label}>{pl.abandonReason}</span>
            <input
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-12 rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-bg) px-3 text-xl"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button type="submit" className={`${button} border-(--color-accent) bg-(--color-accent) text-(--color-on-accent)`}>
              {pl.abandonMatch}
            </button>
            <button type="button" onClick={onCancel} className={`${button} border-(--color-border-strong) bg-(--color-surface-button)`}>
              {pl.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
