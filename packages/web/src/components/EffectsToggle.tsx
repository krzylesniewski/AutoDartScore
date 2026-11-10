import { pl } from '../i18n/pl';
import { EffectsIcon, EffectsOffIcon } from './icons';

export interface EffectsToggleProps {
  enabled: boolean;
  onChange(next: boolean): void;
  // Od lg okrągły przycisk z samą ikoną, poniżej lg wiersz menu z ikoną i tekstem.
  iconFromLg?: boolean;
}

const toggleClass =
  'flex min-h-12 items-center gap-2 rounded-(--radius-chip) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-4 text-(length:--text-button) text-(--color-text-muted)';

// Utility poniżej lg nadpisują .sc-btn--icon, bo komponenty Sceny są w niższej warstwie. Ikony mają h-[1em] w-[1em], więc 20 px daje im text-[20px].
const iconToggleClass = 'sc-btn sc-btn--icon shrink-0 max-lg:h-12 max-lg:w-full max-lg:justify-start max-lg:px-4 max-lg:rounded-(--radius-button)';

// Stan czyta czytnik z aria-pressed, a tekst obok nazwy jest tylko dla oka, żeby nazwa przycisku została "Efekty dźwiękowe".
export function EffectsToggle({ enabled, onChange, iconFromLg = false }: EffectsToggleProps) {
  if (iconFromLg) {
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
    <button type="button" aria-pressed={enabled} onClick={() => onChange(!enabled)} className={toggleClass}>
      {enabled ? <EffectsIcon className="text-(--color-text)" /> : <EffectsOffIcon />}
      <span>
        {pl.effects}
        <span aria-hidden="true">: {enabled ? pl.effectsOn : pl.effectsOff}</span>
      </span>
    </button>
  );
}
