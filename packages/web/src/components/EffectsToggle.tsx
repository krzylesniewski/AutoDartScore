import { pl } from '../i18n/pl';
import { EffectsIcon, EffectsOffIcon } from './icons';

export interface EffectsToggleProps {
  enabled: boolean;
  onChange(next: boolean): void;
}

// Stan czyta czytnik z aria-pressed, a tekst obok nazwy jest tylko dla oka, żeby nazwa przycisku została "Efekty dźwiękowe".
export function EffectsToggle({ enabled, onChange }: EffectsToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
      className="flex min-h-12 items-center gap-2 rounded-(--radius-chip) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-4 text-(length:--text-button) text-(--color-text-muted)"
    >
      {enabled ? <EffectsIcon className="text-(--color-text)" /> : <EffectsOffIcon />}
      <span>
        {pl.effects}
        <span aria-hidden="true">: {enabled ? pl.effectsOn : pl.effectsOff}</span>
      </span>
    </button>
  );
}
