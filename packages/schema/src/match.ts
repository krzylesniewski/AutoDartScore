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
