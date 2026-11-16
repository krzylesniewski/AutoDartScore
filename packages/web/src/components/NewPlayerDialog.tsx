import type { Player } from '@autoscore/schema';
import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiRequestError, createPlayer } from '../api/client';
import { apiErrorText } from '../api/error-text';
import { pl } from '../i18n/pl';
import { AvatarColorPicker } from './AvatarColorPicker';
import { AvatarEmojiPicker } from './AvatarEmojiPicker';
import { Dialog } from './Dialog';
import { WarningIcon } from './icons';

export interface NewPlayerDialogProps {
  onCreated(player: Player): void;
  onCancel(): void;
}

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const input = 'h-14 rounded-(--radius-button) border-0 bg-(--color-bg)/55 px-4 shadow-(--shadow-outline)';

// Każdy nowy gracz jest zapisywany. API nadal przyjmuje gości, ale UI ich nie tworzy.
export function NewPlayerDialog({ onCreated, onCancel }: NewPlayerDialogProps) {
  const titleId = useId();
  const nameErrorId = useId();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [color, setColor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNameError(null);
    try {
      const trimmedAvatar = avatar.trim();
      // Bez wyboru kolor dobiera serwer.
      onCreated(
        await createPlayer({
          name: name.trim(),
          guest: false,
          ...(trimmedAvatar ? { avatar: trimmedAvatar } : {}),
          ...(color === null ? {} : { color }),
        }),
      );
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === 'player_name_taken') {
        setNameError(pl.playerNameTaken(name.trim()));
      } else {
        setError(apiErrorText(caught));
      }
      setSaving(false);
    }
  }

  return (
    <Dialog labelledBy={titleId} className="gap-5.5" initialFocus={nameInput} busy={saving} onClose={onCancel}>
      <h2 id={titleId} className="relative font-display text-[32px] leading-none font-black tracking-[0.01em] uppercase sm:text-[40px]">
        {pl.newPlayerTitle}
      </h2>
      <form onSubmit={(event) => void save(event)} className="relative flex flex-col gap-5">
        <label className="flex flex-col gap-2">
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
            className={`${input} text-[22px] aria-invalid:inset-ring-2 aria-invalid:inset-ring-(--color-accent)`}
          />
        </label>
        {nameError && (
          <p id={nameErrorId} className="-mt-2.5 flex items-center gap-2.5 font-display text-xl font-bold text-(--color-text)">
            <WarningIcon className="text-(--color-accent)" />
            {nameError}
          </p>
        )}
        <AvatarEmojiPicker value={avatar} onChange={setAvatar} />
        <AvatarColorPicker value={color} onChange={setColor} name={name} avatar={avatar} />
        {error && (
          <p role="alert" className="flex items-center gap-2.5 font-display text-xl font-bold text-(--color-text)">
            <WarningIcon className="text-(--color-accent)" />
            {error}
          </p>
        )}
        <div className="mt-1.5 grid grid-cols-2 gap-3">
          <button
            type="submit"
            disabled={saving || name.trim() === ''}
            className="sc-btn sc-btn--primary h-15 rounded-(--radius-button) text-[26px]"
          >
            {pl.addPlayer}
          </button>
          <button type="button" disabled={saving} onClick={onCancel} className="sc-btn h-15 text-[24px] font-bold">
            {pl.cancel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
