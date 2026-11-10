import { pl } from '../i18n/pl';
import { UndoIcon } from './icons';
import { SHORTCUT_BADGE } from './KeypadKey';

export interface UndoButtonProps {
  onUndo(): void;
  disabled: boolean;
  // Pozostały czas na cofnięcie w zakończonej grze, np. 4:12.
  countdown?: string | null;
  // Rozmiar i położenie od rodzica.
  className?: string;
}

export function UndoButton({ onUndo, disabled, countdown = null, className = '' }: UndoButtonProps) {
  return (
    <button
      type="button"
      onClick={onUndo}
      disabled={disabled}
      aria-keyshortcuts="Backspace"
      className={`relative flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-(--radius-button) bg-transparent px-2 font-display text-[19px] leading-tight font-semibold text-(--color-text) tabular-nums shadow-(--shadow-outline) disabled:opacity-40 ${className}`}
    >
      <UndoIcon />
      {countdown === null ? pl.undo : pl.undoWithTime(countdown)}
      <span aria-hidden="true" className={SHORTCUT_BADGE}>
        {pl.shortcutBackspace}
      </span>
    </button>
  );
}
