import { z } from 'zod';

// Typ gry: mecz 1v1, zabawa 2-4 graczy z rankingiem miejsc albo trening jednego gracza.
export const MatchType = z.enum(['match', 'casual', 'practice']);
export type MatchType = z.infer<typeof MatchType>;

export const PracticeMode = z.enum(['free_run', 'solo_501']);
export type PracticeMode = z.infer<typeof PracticeMode>;

export const Placement = z.object({
  playerId: z.string().min(1),
  place: z.int().min(1).max(4),
});
export type Placement = z.infer<typeof Placement>;

export const StartingScore = z.union([z.literal(301), z.literal(501), z.literal(701)]);
export type StartingScore = z.infer<typeof StartingScore>;

// Liczba legów w meczu 1v1. Nieparzysta, więc zawsze jest zwycięzca.
export const BestOf = z.union([z.literal(1), z.literal(3), z.literal(5)]);
export type BestOf = z.infer<typeof BestOf>;

export const MatchStatus = z.enum(['in_progress', 'abandoned', 'finished']);
export type MatchStatus = z.infer<typeof MatchStatus>;
