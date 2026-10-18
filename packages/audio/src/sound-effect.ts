import type { DomainEvent } from '@autoscore/schema';

export type SoundEffect = 'bust' | 'fanfare_short' | 'fanfare_long';

// Najwyżej jeden efekt na rzutkę, w tej samej kolejności co komunikat głosowy: wygrana, bust, wygrany leg.
export function soundEffectFor(events: readonly DomainEvent[]): SoundEffect | null {
  if (events.some((event) => event.type === 'match_won' || (event.type === 'player_finished' && event.place === 1))) {
    return 'fanfare_long';
  }
  if (events.some((event) => event.type === 'bust')) {
    return 'bust';
  }
  if (events.some((event) => event.type === 'leg_won' || (event.type === 'player_finished' && event.place > 1))) {
    return 'fanfare_short';
  }
  return null;
}
