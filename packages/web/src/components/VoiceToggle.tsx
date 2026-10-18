import { pl } from '../i18n/pl';
import { SpeakerIcon, SpeakerOffIcon } from './icons';

export interface VoiceToggleProps {
  enabled: boolean;
  onChange(next: boolean): void;
}

// Stan czyta czytnik z aria-pressed, a tekst obok nazwy jest tylko dla oka, żeby nazwa przycisku została "Głos".
export function VoiceToggle({ enabled, onChange }: VoiceToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
      className="flex min-h-12 items-center gap-2 rounded-(--radius-chip) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-4 text-(length:--text-button) text-(--color-text-muted)"
    >
      {enabled ? <SpeakerIcon className="text-(--color-text)" /> : <SpeakerOffIcon />}
      <span>
        {pl.voice}
        <span aria-hidden="true">: {enabled ? pl.voiceOn : pl.voiceOff}</span>
      </span>
    </button>
  );
}
