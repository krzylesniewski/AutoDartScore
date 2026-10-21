import type { Player } from '@autoscore/schema';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiRequestError, updatePlayer } from '../api/client';
import { pl } from '../i18n/pl';
import { AvatarColorPicker } from './AvatarColorPicker';
import { WarningIcon } from './icons';

export interface EditPlayerDialogProps {
  player: Player;
  onSaved(player: Player): void;
  onCancel(): void;
}

const button = 'flex h-(--button-height) items-center justify-center rounded-(--radius-card) border-(length:--border-width) px-5 font-display text-(length:--text-button) font-semibold disabled:opacity-40';
const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const input = 'min-h-12 rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-bg) px-3 text-xl';

export function EditPlayerDialog({ player, onSaved, onCancel }: EditPlayerDialogProps) {
  const titleId = useId();
  const nameErrorId = useId();
  const [name, setName] = useState(player.name);
  const [avatar, setAvatar] = useState(player.avatar ?? '');
  const [color, setColor] = useState(player.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInput.current?.focus();
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

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNameError(null);
    try {
      // Puste pole avatara usuwa avatar.
      onSaved(await updatePlayer(player.id, { name: name.trim(), avatar: avatar.trim() || null, color }));
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === 'player_name_taken') {
        setNameError(pl.playerNameTaken(name.trim()));
      } else {
        setError(caught instanceof ApiRequestError ? caught.message : pl.requestFailed);
      }
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-(--color-bg)/80 p-(--space-page)">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface) p-6"
      >
        <h2 id={titleId} className="font-display text-(length:--text-heading) font-bold uppercase">
          {pl.editProfile}
        </h2>
        <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className={label}>{pl.playerName}</span>
            <input
              ref={nameInput}
              value={name}
              maxLength={40}
              aria-invalid={nameError ? 'true' : undefined}
              aria-describedby={nameError ? nameErrorId : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
              className={input}
            />
          </label>
          {nameError && (
            <p id={nameErrorId} className="flex items-center gap-2 font-display text-xl text-(--color-accent)">
              <WarningIcon />
              {nameError}
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className={label}>{pl.playerAvatar}</span>
            <input value={avatar} maxLength={16} onChange={(event) => setAvatar(event.target.value)} className={`${input} w-28`} />
          </label>
          <AvatarColorPicker value={color} onChange={setColor} name={name} avatar={avatar} />
          {error && (
            <p className="flex items-center gap-2 font-display text-xl text-(--color-accent)">
              <WarningIcon />
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button type="submit" disabled={saving || name.trim() === ''} className={`${button} border-(--color-text) bg-(--color-text) text-(--color-text-inverse)`}>
              {pl.save}
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
