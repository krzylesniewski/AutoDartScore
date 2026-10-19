import type { DomainEvent } from '@autoscore/schema';
import { pl } from './pl.js';
import { spokenNumber } from './spoken-number.js';

export interface Announcement {
  readonly kind: 'score' | 'bust' | 'winner' | 'game_shot';
  readonly text: string;
  // Ścieżka nagrania względem folderu języka, na przykład scores/100.mp3. null oznacza brak nagrania, wtedy czytamy text.
  readonly clip: string | null;
}

const MAX_TURN_TOTAL = 180;

// Trzema rzutkami nie da się zdobyć tych sum, więc nie mają nagrań.
const UNREACHABLE_TURN_TOTALS: readonly number[] = [163, 166, 169, 172, 173, 175, 176, 178, 179];

const WINNER_CLIPS = ['events/winner_1.mp3', 'events/winner_2.mp3'] as const;
const BUST_CLIPS = ['events/bust_1.mp3', 'events/bust_2.mp3', 'events/bust_3.mp3'] as const;
const GAME_SHOT_CLIP = 'events/game_shot.mp3';

export const EVENT_CLIPS: readonly string[] = [...BUST_CLIPS, GAME_SHOT_CLIP, ...WINNER_CLIPS];

function pick(variants: readonly [string, ...string[]], random: () => number): string {
  const index = Math.min(Math.floor(random() * variants.length), variants.length - 1);
  return variants[index] ?? variants[0];
}

function scoreClip(total: number): string | null {
  if (total < 0 || total > MAX_TURN_TOTAL || UNREACHABLE_TURN_TOTALS.includes(total)) {
    return null;
  }
  return `scores/${total}.mp3`;
}

// Jedna rzutka daje najwyżej jeden komunikat. Zwycięzca i game shot zastępują sumę tury, którą zamknęli.
// random zwraca liczbę z [0, 1) i wybiera wariant nagrania.
export function announcementFor(events: readonly DomainEvent[], random: () => number): Announcement | null {
  if (events.some((event) => event.type === 'match_won' || (event.type === 'player_finished' && event.place === 1))) {
    return { kind: 'winner', text: pl.winner, clip: pick(WINNER_CLIPS, random) };
  }
  if (events.some((event) => event.type === 'bust')) {
    return { kind: 'bust', text: pl.bust, clip: pick(BUST_CLIPS, random) };
  }
  if (events.some((event) => event.type === 'leg_won' || event.type === 'player_finished')) {
    return { kind: 'game_shot', text: pl.gameShot, clip: GAME_SHOT_CLIP };
  }
  const turn = events.find((event) => event.type === 'turn_completed');
  if (turn) {
    return { kind: 'score', text: spokenNumber(turn.total), clip: scoreClip(turn.total) };
  }
  return null;
}
