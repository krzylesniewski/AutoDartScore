import { pl } from '../i18n/pl';
import { SpeakerIcon, SpeakerOffIcon } from './icons';

export interface VoiceToggleProps {
  enabled: boolean;
  onChange(next: boolean): void;
}

export function VoiceToggle({ enabled, onChange }: VoiceToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
      className="flex min-h-12 items-center gap-2 self-end rounded-card border border-line bg-surface-raised px-5 font-display text-xl uppercase"
    >
      {enabled ? <SpeakerIcon /> : <SpeakerOffIcon />}
      {pl.voice}
    </button>
  );
}
