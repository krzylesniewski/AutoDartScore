import { useId } from 'react';
import { avatarColorClass } from '../game/avatar-color';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';

export interface AvatarColorPickerProps {
  value: number | null; // null: kolor jeszcze niewybrany
  onChange(color: number): void;
  name: string;
  avatar: string;
}

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const preview = 'flex size-18 shrink-0 items-center justify-center rounded-full font-display text-[38px] font-bold';

// Natywne radio daje strzałki i Tab bez własnej obsługi klawiatury. Zaznaczenie ma obwódkę i ✓, więc kolor nie jest jedyną wskazówką.
// Fokus to druga obwódka 7-9 px od pola, poza obwódką zaznaczenia (2-5 px), więc widać go też na zaznaczonym polu.
// Kolumny zależą od szerokości pola, a nie okna: 8 kolumn tylko wtedy, gdy się mieszczą. Odstęp 10 px mieści fokus bez nachodzenia na sąsiednie pole.
export function AvatarColorPicker({ value, onChange, name, avatar }: AvatarColorPickerProps) {
  const group = useId();
  const shown = avatar.trim() || null;
  return (
    <div className="flex flex-wrap items-center gap-4">
      {value === null ? (
        <span aria-hidden="true" className={`${preview} bg-(--color-surface-button) text-(--color-text)`}>
          {shown ?? name.trim().charAt(0).toUpperCase()}
        </span>
      ) : (
        <Avatar name={name.trim()} avatar={shown} color={value} size="preview" />
      )}
      <fieldset className="@container flex min-w-0 flex-1 basis-52 flex-col gap-2">
        <legend className={`${label} mb-2`}>{pl.playerColor}</legend>
        <div className="grid grid-cols-[repeat(4,2.75rem)] gap-2.5 @min-[422px]:grid-cols-[repeat(8,2.75rem)]">
          {pl.avatarColorNames.map((colorName, index) => {
            const color = index + 1;
            const checked = value === color;
            return (
              <label key={color} className="relative flex size-11 cursor-pointer">
                <input
                  type="radio"
                  name={group}
                  value={color}
                  checked={checked}
                  aria-label={colorName}
                  onChange={() => onChange(color)}
                  className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-full focus-visible:outline-none"
                />
                <span
                  aria-hidden="true"
                  className={`pointer-events-none flex size-11 items-center justify-center rounded-full font-display text-2xl font-bold text-(--color-on-avatar) ring-offset-2 ring-offset-(--color-surface) peer-checked:ring-3 peer-checked:ring-(--color-text) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-7 peer-focus-visible:outline-(--color-text) ${avatarColorClass(color)}`}
                >
                  {checked ? '✓' : ''}
                </span>
              </label>
            );
          })}
        </div>
        {value === null && <p className="text-(--color-text-muted)">{pl.playerColorAuto}</p>}
      </fieldset>
    </div>
  );
}
