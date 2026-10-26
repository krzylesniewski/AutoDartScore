import type { AchievementKind, DomainEvent } from '@autoscore/schema';
import { pl } from './pl.js';
import { spokenNumber } from './spoken-number.js';

export interface AnnouncementPart {
  readonly text: string;
  // Ścieżka nagrania względem folderu języka, na przykład scores/100.mp3. null oznacza brak nagrania, wtedy czytamy text.
  readonly clip: string | null;
}

export interface Announcement {
  // Rodzaj głównego odczytu, czyli pierwszej części.
  readonly kind: 'score' | 'bust' | 'winner' | 'game_shot';
  readonly parts: readonly [AnnouncementPart, ...AnnouncementPart[]];
}

const MAX_TURN_TOTAL = 180;

// Trzema rzutkami nie da się zdobyć tych sum, więc nie mają nagrań.
const UNREACHABLE_TURN_TOTALS: readonly number[] = [163, 166, 169, 172, 173, 175, 176, 178, 179];

const WINNER_CLIPS = ['events/winner_1.mp3', 'events/winner_2.mp3'] as const;
const BUST_CLIPS = ['events/bust_1.mp3', 'events/bust_2.mp3', 'events/bust_3.mp3'] as const;
const GAME_SHOT_CLIP = 'events/game_shot.mp3';
type RecordedPart = AnnouncementPart & { readonly clip: string };

const ZERO_VARIANTS: readonly [RecordedPart, ...RecordedPart[]] = [
  { text: pl.zero1, clip: 'events/zero_1.mp3' },
  { text: pl.zero2, clip: 'events/zero_2.mp3' },
];

// Kolejność kluczy to kolejność odczytu osiągnięć.
export const ACHIEVEMENT_CLIPS: Readonly<Record<AchievementKind, string>> = {
  first_100: 'events/first_100.mp3',
  first_120: 'events/first_120.mp3',
  first_140: 'events/first_140.mp3',
  first_180: 'events/first_180.mp3',
  turn_record: 'events/achievement_turn_record.mp3',
  checkout_record: 'events/achievement_checkout_record.mp3',
  shortest_leg: 'events/achievement_shortest_leg.mp3',
  longest_leg: 'events/achievement_longest_leg.mp3',
};

const ACHIEVEMENT_TEXTS: Readonly<Record<AchievementKind, string>> = {
  first_100: pl.first100,
  first_120: pl.first120,
  first_140: pl.first140,
  first_180: pl.first180,
  turn_record: pl.achievementTurnRecord,
  checkout_record: pl.achievementCheckoutRecord,
  shortest_leg: pl.achievementShortestLeg,
  longest_leg: pl.achievementLongestLeg,
};

const ACHIEVEMENT_ORDER = Object.keys(ACHIEVEMENT_CLIPS) as AchievementKind[];

export const EVENT_CLIPS: readonly string[] = [
  ...BUST_CLIPS,
  GAME_SHOT_CLIP,
  ...WINNER_CLIPS,
  ...ZERO_VARIANTS.map((variant) => variant.clip),
  ...Object.values(ACHIEVEMENT_CLIPS),
];

function pick<T>(variants: readonly [T, ...T[]], random: () => number): T {
  const index = Math.min(Math.floor(random() * variants.length), variants.length - 1);
  return variants[index] ?? variants[0];
}

function scoreClip(total: number): string | null {
  if (total < 0 || total > MAX_TURN_TOTAL || UNREACHABLE_TURN_TOTALS.includes(total)) {
    return null;
  }
  return `scores/${total}.mp3`;
}

function mainPart(events: readonly DomainEvent[], random: () => number): { kind: Announcement['kind']; part: AnnouncementPart } | null {
  if (events.some((event) => event.type === 'match_won' || (event.type === 'player_finished' && event.place === 1))) {
    return { kind: 'winner', part: { text: pl.winner, clip: pick(WINNER_CLIPS, random) } };
  }
  if (events.some((event) => event.type === 'bust')) {
    return { kind: 'bust', part: { text: pl.bust, clip: pick(BUST_CLIPS, random) } };
  }
  if (events.some((event) => event.type === 'leg_won' || event.type === 'player_finished')) {
    return { kind: 'game_shot', part: { text: pl.gameShot, clip: GAME_SHOT_CLIP } };
  }
  const turn = events.find((event) => event.type === 'turn_completed');
  if (turn) {
    return { kind: 'score', part: { text: spokenNumber(turn.total), clip: scoreClip(turn.total) } };
  }
  return null;
}

// Jedna rzutka daje najwyżej jeden komunikat. Zwycięzca i game shot zastępują sumę tury, którą zamknęli.
// Po głównym odczycie idzie komentarz do zerowej tury, a potem po jednej części na rodzaj osiągnięcia.
// Nagrania osiągnięć nie mają imienia, więc dwa longest_leg z jednego lega dają jedną część.
// random zwraca liczbę z [0, 1) i wybiera wariant nagrania.
export function announcementFor(
  events: readonly DomainEvent[],
  achievements: readonly AchievementKind[],
  random: () => number,
): Announcement | null {
  const main = mainPart(events, random);
  if (!main) {
    return null;
  }
  const parts: [AnnouncementPart, ...AnnouncementPart[]] = [main.part];
  if (main.kind === 'score' && events.some((event) => event.type === 'turn_completed' && event.total === 0)) {
    parts.push(pick(ZERO_VARIANTS, random));
  }
  for (const kind of ACHIEVEMENT_ORDER) {
    if (achievements.includes(kind)) {
      parts.push({ text: ACHIEVEMENT_TEXTS[kind], clip: ACHIEVEMENT_CLIPS[kind] });
    }
  }
  return { kind: main.kind, parts };
}
