import { isSingleEmoji } from '@autoscore/schema';
import { useId, useState } from 'react';
import { AVATAR_EMOJI, AVATAR_EMOJI_GROUPS } from '../game/avatar-emoji';
import { pl } from '../i18n/pl';
import { WarningIcon } from './icons';

export interface AvatarEmojiPickerProps {
  value: string; // '' to brak emoji: avatar pokazuje inicjał
  onChange(avatar: string): void;
}

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';
const groupLabel = 'text-sm text-(--color-text-muted)';
const input = 'h-11 w-20 rounded-(--radius-button) border-0 bg-(--color-bg)/55 px-3 text-center text-2xl shadow-(--shadow-outline)';
// Zaznaczenie: krem w środku i obwódka, więc nie zależy od samego koloru. Fokus jak w wyborze koloru: druga obwódka poza zaznaczeniem.
const tile =
  'pointer-events-none flex size-11 items-center justify-center rounded-full bg-(--color-surface-soft) text-2xl leading-none ring-offset-2 ring-offset-(--color-surface) shadow-(--shadow-inset-line) peer-checked:bg-(--color-text) peer-checked:ring-3 peer-checked:ring-(--color-text) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-7 peer-focus-visible:outline-(--color-text)';
const radio = 'peer absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-full focus-visible:outline-none';

// Natywne radio daje strzałki i Tab bez własnej obsługi klawiatury, jak w AvatarColorPicker.
export function AvatarEmojiPicker({ value, onChange }: AvatarEmojiPickerProps) {
  const group = useId();
  const customId = useId();
  const customErrorId = useId();
  const current = value.trim();
  const preset = current === '' || AVATAR_EMOJI.includes(current);
  const [custom, setCustom] = useState(preset ? '' : current);
  const [customError, setCustomError] = useState(false);

  function pick(avatar: string): void {
    setCustom('');
    setCustomError(false);
    onChange(avatar);
  }

  function typeCustom(text: string): void {
    setCustom(text);
    const trimmed = text.trim();
    if (trimmed === '') {
      setCustomError(false);
      if (!preset) {
        onChange('');
      }
      return;
    }
    const valid = isSingleEmoji(trimmed);
    setCustomError(!valid);
    if (valid) {
      onChange(trimmed);
    }
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className={`${label} mb-2`}>{pl.playerAvatar}</legend>
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative flex h-11 cursor-pointer">
          <input type="radio" name={group} value="" checked={current === ''} onChange={() => pick('')} className={radio} />
          <span
            className={`${tile} w-auto gap-1.5 px-4 font-display text-lg font-bold peer-checked:text-(--color-text-inverse)`}
          >
            {pl.avatarNone}
            <span className="font-body text-sm font-normal opacity-70">({pl.avatarNoneHint})</span>
          </span>
        </label>
      </div>
      {AVATAR_EMOJI_GROUPS.map((emojis, index) => (
        <div key={pl.avatarGroups[index]} className="flex flex-col gap-1.5">
          <span className={groupLabel}>{pl.avatarGroups[index]}</span>
          <div className="flex flex-wrap gap-2.5">
            {emojis.map((emoji) => (
              <label key={emoji} className="relative flex size-11 cursor-pointer">
                <input type="radio" name={group} value={emoji} checked={current === emoji} aria-label={emoji} onChange={() => pick(emoji)} className={radio} />
                <span aria-hidden="true" className={tile}>
                  {emoji}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={customId} className={groupLabel}>
          {pl.avatarCustom}
        </label>
        <input
          id={customId}
          value={custom}
          maxLength={16}
          onChange={(event) => typeCustom(event.target.value)}
          aria-invalid={customError}
          aria-describedby={customError ? customErrorId : undefined}
          className={`${input} ${!preset && current !== '' && !customError ? 'ring-3 ring-(--color-text)' : ''}`}
        />
        {customError && (
          <p id={customErrorId} className="flex items-center gap-2 text-(--color-text)">
            <WarningIcon className="text-(--color-accent)" />
            {pl.avatarCustomInvalid}
          </p>
        )}
      </div>
    </fieldset>
  );
}
