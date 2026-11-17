import { z } from 'zod';
import { PlayerId } from './player.js';

// Typ gry: mecz 1v1, zabawa 2-4 graczy z rankingiem miejsc albo trening jednego gracza.
export const MatchType = z.enum(['match', 'casual', 'practice']);
export type MatchType = z.infer<typeof MatchType>;

export const PracticeMode = z.enum(['free_run', 'solo_501', 'checkouts']);
export type PracticeMode = z.infer<typeof PracticeMode>;

// Zakres losowanych wyników w treningu checkoutów.
export const CheckoutRange = z.enum(['2-50', '51-100']);
export type CheckoutRange = z.infer<typeof CheckoutRange>;

// Zasada losowania celów w treningu checkoutów. Serwer ją zapisuje, ale nie wysyła w odpowiedziach API.
export const CheckoutRule = z.enum(['new_each_attempt', 'repeat_on_miss']);
export type CheckoutRule = z.infer<typeof CheckoutRule>;

export const CheckoutTarget = z.int().min(2).max(100);
export type CheckoutTarget = z.infer<typeof CheckoutTarget>;

export const CheckoutAttempt = z.object({
  target: CheckoutTarget,
  success: z.boolean(),
});
export type CheckoutAttempt = z.infer<typeof CheckoutAttempt>;

export const DARTS_PER_TURN = 3;

export const Placement = z.object({
  playerId: PlayerId,
  place: z.int().min(1).max(4),
});
export type Placement = z.infer<typeof Placement>;

export const StartingScore = z.union([z.literal(301), z.literal(501), z.literal(701)]);
export type StartingScore = z.infer<typeof StartingScore>;
export const STARTING_SCORES: readonly StartingScore[] = StartingScore.options.map((option) => option.value);

// Liczba legów w meczu 1v1. Nieparzysta, więc zawsze jest zwycięzca.
export const BestOf = z.union([z.literal(1), z.literal(3), z.literal(5)]);
export type BestOf = z.infer<typeof BestOf>;

// Długość meczu 1v1: do N wygranych legów.
export const LegsToWin = z.int().min(1).max(9);
export type LegsToWin = z.infer<typeof LegsToWin>;

export const MatchStatus = z.enum(['in_progress', 'abandoned', 'ended', 'finished']);
export type MatchStatus = z.infer<typeof MatchStatus>;
