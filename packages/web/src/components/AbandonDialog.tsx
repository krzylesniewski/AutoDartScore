import type { MatchSnapshot } from '@autoscore/schema';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { CornerRings } from './CornerRings';
import { PauseIcon } from './icons';

export interface AbandonDialogProps {
  state: Pick<MatchSnapshot, 'players' | 'currentPlayerId'>;
  onConfirm(playerId: string, reason: string | null): void;
  onCancel(): void;
}

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const input = 'h-14 rounded-(--radius-button) border-0 bg-(--color-bg)/55 px-4 shadow-(--shadow-outline)';
// Globalny pierścień fokusu pomija radio, więc fokus rysuje karta, która je obejmuje.
const playerCard =
  'relative flex h-18 min-w-0 cursor-pointer items-center gap-3 rounded-(--radius-card) px-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--color-focus)';
const checkedCard = 'bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) inset-ring-2 inset-ring-(--color-text)';
const uncheckedCard = 'bg-(--color-surface-softer) shadow-(--shadow-inset-line)';

export function AbandonDialog({ state, onConfirm, onCancel }: AbandonDialogProps) {
  const titleId = useId();
  const textId = useId();
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
        aria-describedby={textId}
        tabIndex={-1}
        className="relative flex max-h-full w-full max-w-160 flex-col gap-5 overflow-x-hidden overflow-y-auto rounded-(--radius-panel) bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) px-5 pt-6 pb-5 shadow-(--shadow-card) sm:px-8 sm:pt-7.5 sm:pb-7"
      >
        {/* overflow-x-hidden przycina tarczę w rogu, żeby nie dodała przewijania w poziomie. */}
        <CornerRings className="-top-20 -right-20 size-60" />
        <h2 id={titleId} className="relative flex items-center gap-3.5 font-display text-[32px] leading-none font-black tracking-[0.01em] uppercase sm:text-[40px]">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-(--color-surface-soft) text-2xl">
            <PauseIcon />
          </span>
          {pl.abandonTitle}
        </h2>
        <p id={textId} className="relative text-[17px] leading-snug text-(--color-text-sub)">
          {pl.abandonText}
        </p>
        <form onSubmit={confirm} className="relative flex flex-col gap-5">
          <fieldset className="flex min-w-0 flex-col">
            <legend className={`mb-2.5 ${label}`}>{pl.abandonedBy}</legend>
            {/* Zaznaczenie ma pierścień, kropkę i grubsze imię, więc kolor nie jest jedyną wskazówką. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {state.players.map((player) => {
                const checked = playerId === player.id;
                return (
                  <label key={player.id} className={`${playerCard} ${checked ? checkedCard : uncheckedCard}`}>
                    <input
                      type="radio"
                      name="abandoned-by"
                      value={player.id}
                      checked={checked}
                      onChange={() => setPlayerId(player.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-(--color-text)' : 'border-(--color-text-muted)'}`}
                    >
                      {checked && <span className="size-3 rounded-full bg-(--color-text)" />}
                    </span>
                    <Avatar name={player.name} avatar={player.avatar} color={player.color} size="medium" />
                    <span className={`min-w-0 truncate font-display text-2xl ${checked ? 'font-bold' : 'font-semibold'}`}>{player.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label className="flex flex-col gap-2">
            <span className={label}>{pl.abandonReason}</span>
            <input value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} className={`${input} text-[22px]`} />
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            <button type="submit" className="sc-btn sc-btn--primary h-15 rounded-(--radius-button) text-[26px]">
              {pl.abandonMatch}
            </button>
            <button type="button" onClick={onCancel} className="sc-btn h-15 text-[24px] font-bold">
              {pl.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
