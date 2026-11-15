import type { Player } from '@autoscore/schema';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiRequestError, updatePlayer } from '../api/client';
import { pl } from '../i18n/pl';
import { AvatarColorPicker } from './AvatarColorPicker';
import { AvatarEmojiPicker } from './AvatarEmojiPicker';
import { CornerRings } from './CornerRings';
import { WarningIcon } from './icons';

export interface EditPlayerDialogProps {
  player: Player;
  onSaved(player: Player): void;
  onCancel(): void;
}

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const input = 'h-14 rounded-(--radius-button) border-0 bg-(--color-bg)/55 px-4 shadow-(--shadow-outline)';

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
      // Puste pole avatara usuwa avatar. Niezmieniony avatar nie idzie do serwera, bo starszy avatar z tekstem nie przeszedłby sprawdzenia emoji.
      const nextAvatar = avatar.trim() || null;
      onSaved(await updatePlayer(player.id, { name: name.trim(), ...(nextAvatar === player.avatar ? {} : { avatar: nextAvatar }), color }));
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
        className="relative flex max-h-full w-full max-w-160 flex-col gap-5.5 overflow-x-hidden overflow-y-auto rounded-(--radius-panel) bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) px-5 pt-6 pb-5 shadow-(--shadow-card) sm:px-8 sm:pt-7.5 sm:pb-7"
      >
        {/* overflow-x-hidden przycina tarczę w rogu, żeby nie dodała przewijania w poziomie. */}
        <CornerRings className="-top-20 -right-20 size-60" />
        <h2 id={titleId} className="relative font-display text-[32px] leading-none font-black tracking-[0.01em] uppercase sm:text-[40px]">
          {pl.editProfile}
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
            <p className="flex items-center gap-2.5 font-display text-xl font-bold text-(--color-text)">
              <WarningIcon className="text-(--color-accent)" />
              {error}
            </p>
          )}
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            <button type="submit" disabled={saving || name.trim() === ''} className="sc-btn sc-btn--primary h-15 rounded-(--radius-button) text-[26px]">
              {pl.save}
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
