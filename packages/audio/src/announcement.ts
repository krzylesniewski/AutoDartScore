import type { DomainEvent } from '@autoscore/schema';
import { pl } from './pl.js';
import { spokenNumber } from './spoken-number.js';

export interface Announcement {
  readonly kind: 'score' | 'bust' | 'winner';
  readonly text: string;
}

// Jedna rzutka daje najwyżej jeden komunikat. Zwycięzca zastępuje sumę tury, którą zamknął.
export function announcementFor(events: readonly DomainEvent[]): Announcement | null {
  if (events.some((event) => event.type === 'match_won' || (event.type === 'player_finished' && event.place === 1))) {
    return { kind: 'winner', text: pl.winner };
  }
  if (events.some((event) => event.type === 'bust')) {
    return { kind: 'bust', text: pl.bust };
  }
  const turn = events.find((event) => event.type === 'turn_completed');
  if (turn) {
    return { kind: 'score', text: spokenNumber(turn.total) };
  }
  return null;
}
