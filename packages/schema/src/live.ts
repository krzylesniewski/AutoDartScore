import { z } from 'zod';
import { Bust, CasualFinished, LegWon, MatchWon, PlayerFinished, TurnCompleted } from './domain-events.js';
import { MatchSnapshot, ThrowRecord } from './match-api.js';

// Wiadomości WebSocket dla jednej gry. eventSeq to seq wpisu w logu, który wywołał wiadomość.
const meta = {
  matchId: z.string().min(1),
  eventSeq: z.int().min(0),
};

export const StateUpdated = z.object({ type: z.literal('state_updated'), ...meta, state: MatchSnapshot });
export type StateUpdated = z.infer<typeof StateUpdated>;

export const ThrowRegistered = z.object({ type: z.literal('throw_registered'), ...meta, throw: ThrowRecord });
export type ThrowRegistered = z.infer<typeof ThrowRegistered>;

export const ThrowUndone = z.object({ type: z.literal('throw_undone'), ...meta, throwId: z.string().min(1) });
export type ThrowUndone = z.infer<typeof ThrowUndone>;

export const AchievementKind = z.enum(['turn_record', 'checkout_record', 'shortest_leg', 'longest_leg', 'first_100', 'first_120', 'first_140', 'first_180']);
export type AchievementKind = z.infer<typeof AchievementKind>;

// Bez refinementów, żeby zostać poprawnym członkiem unii z dyskryminatorem. previous jest null tylko dla first_*.
export const Achievement = z.object({
  type: z.literal('achievement'),
  ...meta,
  playerId: z.string().min(1),
  kind: AchievementKind,
  value: z.int().min(0),
  previous: z.int().min(0).nullable(),
});
export type Achievement = z.infer<typeof Achievement>;

// Zdarzenia domenowe idą płasko pod własnym typem, tak jak słucha ich audio.
export const LiveMessage = z.discriminatedUnion('type', [
  StateUpdated,
  ThrowRegistered,
  ThrowUndone,
  TurnCompleted.extend(meta),
  Bust.extend(meta),
  LegWon.extend(meta),
  MatchWon.extend(meta),
  PlayerFinished.extend(meta),
  CasualFinished.extend(meta),
  Achievement,
]);
export type LiveMessage = z.infer<typeof LiveMessage>;
