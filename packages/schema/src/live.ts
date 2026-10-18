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
]);
export type LiveMessage = z.infer<typeof LiveMessage>;
