import type { TournamentView } from '@autoscore/schema';
import { useId, useRef, useState } from 'react';
import { setTournamentSharing } from '../api/client';
import { apiErrorText } from '../api/error-text';
import { isLocalAddress, publicTournamentUrl } from '../game/share-url';
import { pl } from '../i18n/pl';
import { Dialog } from './Dialog';
import { WarningIcon } from './icons';
import { QrCode } from './QrCode';
import { TournamentToggle } from './TournamentToggle';

export interface ShareTournamentDialogProps {
  view: TournamentView;
  onAccept(view: TournamentView): void;
  onFailed(): void;
  onClose(): void;
  // Testy podają adres strony, bo w jsdom hostname to zawsze localhost.
  page?: Pick<Location, 'hostname' | 'origin' | 'pathname'>;
}

type CopyState = 'idle' | 'copied' | 'failed';

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const note = 'flex items-start gap-2.5 text-[17px] leading-snug text-(--color-text-sub)';

export function ShareTournamentDialog({ view, onAccept, onFailed, onClose, page = window.location }: ShareTournamentDialogProps) {
  const titleId = useId();
  const textId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState<CopyState>('idle');
  const pending = useRef(false);
  const field = useRef<HTMLInputElement>(null);

  const local = isLocalAddress(page.hostname);
  const url = publicTournamentUrl(page, view.id);

  // Okno zostaje otwarte, a stan przełącznika idzie za view z propsów, więc zmiana z innego urządzenia też go przestawia.
  async function toggle(next: boolean): Promise<void> {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      onAccept(await setTournamentSharing(view.id, next, view.eventSeq));
    } catch (caught) {
      setError(apiErrorText(caught));
      onFailed();
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  // Schowek wymaga bezpiecznego kontekstu, a http:// po adresie IP nim nie jest. Wtedy zostaje zaznaczony adres do ręcznego skopiowania.
  async function copyLink(): Promise<void> {
    const clipboard = navigator.clipboard as Clipboard | undefined;
    try {
      if (!clipboard) {
        throw new Error('Clipboard unavailable');
      }
      await clipboard.writeText(url);
      setCopy('copied');
    } catch {
      field.current?.focus();
      field.current?.select();
      setCopy('failed');
    }
  }

  let content;
  if (local) {
    content = (
      <p className={note}>
        <WarningIcon className="mt-0.5 shrink-0 text-(--color-accent)" />
        {pl.shareLocalAddress}
      </p>
    );
  } else if (!view.sharing) {
    content = <p className={note}>{pl.sharingOff}</p>;
  } else {
    content = (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <QrCode value={url} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <label className="flex min-w-0 flex-col gap-2">
            <span className={label}>{pl.shareUrl}</span>
            <input
              ref={field}
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="h-12 min-w-0 rounded-(--radius-button) border-0 bg-(--color-bg)/55 px-3 text-base shadow-(--shadow-outline)"
            />
          </label>
          <button type="button" onClick={() => void copyLink()} className="sc-btn sc-btn--outline self-start">
            {pl.copyLink}
          </button>
          <p role="status" className="min-h-6 text-[15px] text-(--color-text-sub)">
            {copy === 'copied' && pl.linkCopied}
            {copy === 'failed' && pl.copyFailed}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Dialog labelledBy={titleId} describedBy={textId} className="gap-5" busy={saving} onClose={onClose}>
      <h2 id={titleId} className="relative font-display text-[32px] leading-none font-black tracking-[0.01em] uppercase sm:text-[40px]">
        {pl.shareTitle}
      </h2>
      <p id={textId} className="relative text-[17px] leading-snug text-(--color-text-sub)">
        {pl.shareText}
      </p>
      {/* Wyłączony fieldset blokuje przełącznik na czas zapisu. unavailableReason pokazałby go jako wyłączony. */}
      <fieldset disabled={saving} className="relative min-w-0">
        <TournamentToggle name={pl.sharing} hint={pl.sharingHint} enabled={view.sharing} onChange={(next) => void toggle(next)} />
      </fieldset>
      <div className="relative">{content}</div>
      {error && (
        <p role="alert" className="relative flex items-center gap-2.5 font-display text-xl font-bold text-(--color-text)">
          <WarningIcon className="shrink-0 text-(--color-accent)" />
          {error}
        </p>
      )}
      <button type="button" disabled={saving} onClick={onClose} className="sc-btn relative h-15 text-[24px] font-bold">
        {pl.close}
      </button>
    </Dialog>
  );
}
