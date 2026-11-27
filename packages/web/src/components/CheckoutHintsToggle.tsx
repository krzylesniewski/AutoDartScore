import { pl } from '../i18n/pl';
import { SoundToggleCard } from './SoundToggleCard';
import { TargetIcon } from './icons';

export interface CheckoutHintsToggleProps {
  enabled: boolean;
  onChange(next: boolean): void;
}

// Ta sama karta przełącznika co w sekcji dźwięku. Stan pokazuje pigułka z tekstem, nie sam kolor ikony.
export function CheckoutHintsToggle({ enabled, onChange }: CheckoutHintsToggleProps) {
  return (
    <SoundToggleCard
      enabled={enabled}
      name={pl.checkoutHints}
      onText={pl.checkoutHintsOn}
      offText={pl.checkoutHintsOff}
      icon={<TargetIcon className={enabled ? 'text-(--color-text)' : 'text-(--color-text-sub)'} />}
      onChange={onChange}
    />
  );
}
