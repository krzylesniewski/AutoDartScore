import { pl } from '../i18n/pl';
import { SoundToggleCard } from './SoundToggleCard';
import { EffectsIcon, EffectsOffIcon } from './icons';

export interface EffectsToggleProps {
  enabled: boolean;
  onChange(next: boolean): void;
  // icon: od lg okrągły przycisk z samą ikoną, poniżej lg wiersz menu z ikoną i tekstem. card: karta na ekranie ustawień.
  variant?: 'chip' | 'icon' | 'card';
}

const chipClass = 'flex min-h-11 items-center gap-2 rounded-(--radius-pill) bg-(--color-surface-soft) px-4 font-display text-lg font-semibold text-(--color-text-sub)';

// Utility poniżej lg nadpisują .sc-btn--icon, bo komponenty Sceny są w niższej warstwie. Ikony mają h-[1em] w-[1em], więc 20 px daje im text-[20px].
const iconToggleClass = 'sc-btn sc-btn--icon shrink-0 max-lg:h-12 max-lg:w-full max-lg:justify-start max-lg:px-4 max-lg:rounded-(--radius-button)';

// Stan czyta czytnik z aria-pressed, a tekst obok nazwy jest tylko dla oka, żeby nazwa przycisku została "Efekty dźwiękowe".
export function EffectsToggle({ enabled, onChange, variant = 'chip' }: EffectsToggleProps) {
  if (variant === 'card') {
    return (
      <SoundToggleCard
        enabled={enabled}
        name={pl.effects}
        onText={pl.effectsOn}
        offText={pl.effectsOff}
        icon={enabled ? <EffectsIcon className="text-(--color-text)" /> : <EffectsOffIcon className="text-(--color-text-sub)" />}
        onChange={onChange}
      />
    );
  }
  if (variant === 'icon') {
    return (
      <button type="button" aria-pressed={enabled} onClick={() => onChange(!enabled)} className={iconToggleClass}>
        {enabled ? <EffectsIcon className="text-[20px] text-(--color-text)" /> : <EffectsOffIcon className="text-[20px] text-(--color-text-muted)" />}
        <span className="lg:sr-only">
          {pl.effects}
          <span aria-hidden="true">: {enabled ? pl.effectsOn : pl.effectsOff}</span>
        </span>
      </button>
    );
  }
  return (
    <button type="button" aria-pressed={enabled} onClick={() => onChange(!enabled)} className={chipClass}>
      {enabled ? <EffectsIcon className="text-(--color-text)" /> : <EffectsOffIcon />}
      <span>
        {pl.effects}
        <span aria-hidden="true">: {enabled ? pl.effectsOn : pl.effectsOff}</span>
      </span>
    </button>
  );
}
