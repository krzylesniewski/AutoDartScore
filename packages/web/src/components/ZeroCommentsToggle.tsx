import { pl } from '../i18n/pl';
import { SoundToggleCard } from './SoundToggleCard';
import { CommentIcon, CommentOffIcon } from './icons';

export interface ZeroCommentsToggleProps {
  enabled: boolean;
  disabled: boolean;
  onChange(next: boolean): void;
}

// Komentarz jest częścią głosu, więc bez głosu przycisk jest nieaktywny, ale nadal pokazuje zapisany wybór.
export function ZeroCommentsToggle({ enabled, disabled, onChange }: ZeroCommentsToggleProps) {
  return (
    <SoundToggleCard
      enabled={enabled}
      disabled={disabled}
      name={pl.zeroComments}
      onText={pl.zeroCommentsOn}
      offText={pl.zeroCommentsOff}
      icon={enabled ? <CommentIcon className="text-(--color-text)" /> : <CommentOffIcon className="text-(--color-text-sub)" />}
      onChange={onChange}
    />
  );
}
