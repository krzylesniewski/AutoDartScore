import { pl } from '../i18n/pl';
import { CommentIcon, CommentOffIcon } from './icons';

export interface ZeroCommentsToggleProps {
  enabled: boolean;
  disabled: boolean;
  onChange(next: boolean): void;
}

// Komentarz jest częścią głosu, więc bez głosu przycisk jest nieaktywny, ale nadal pokazuje zapisany wybór.
// Stan czyta czytnik z aria-pressed, a tekst obok nazwy jest tylko dla oka, żeby nazwa przycisku została "Komentarze do zera".
export function ZeroCommentsToggle({ enabled, disabled, onChange }: ZeroCommentsToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className="flex min-h-12 items-center gap-2 rounded-(--radius-chip) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-4 text-(length:--text-button) text-(--color-text-muted) disabled:opacity-40"
    >
      {enabled ? <CommentIcon className="text-(--color-text)" /> : <CommentOffIcon />}
      <span>
        {pl.zeroComments}
        <span aria-hidden="true">: {enabled ? pl.zeroCommentsOn : pl.zeroCommentsOff}</span>
      </span>
    </button>
  );
}
