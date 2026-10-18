import { z } from 'zod';
import { Hit } from './hit.js';
import { Placement } from './match.js';

// Zdarzenia domenowe silnika gry. Te same zdarzenia odbierają WebSocket i warstwa audio.
const base = {
  playerId: z.string().min(1),
  legIndex: z.int().min(0),
};

export const TurnCompleted = z.object({
  type: z.literal('turn_completed'),
  ...base,
  turnIndex: z.int().min(0),
  darts: z.array(Hit).min(1).max(3),
  total: z.int().min(0).max(180),
  remaining: z.int().min(0),
});
export type TurnCompleted = z.infer<typeof TurnCompleted>;

export const Bust = z.object({
  type: z.literal('bust'),
  ...base,
  turnIndex: z.int().min(0),
  darts: z.array(Hit).min(1).max(3),
  remaining: z.int().min(2), // wynik sprzed tury, do którego gracz wraca
});
export type Bust = z.infer<typeof Bust>;

export const LegWon = z.object({
  type: z.literal('leg_won'),
  ...base,
  checkout: z.int().min(2).max(170),
  dartsThrown: z.int().min(1), // wszystkie rzutki zwycięzcy w tym legu
});
export type LegWon = z.infer<typeof LegWon>;

export const MatchWon = z.object({
  type: z.literal('match_won'),
  playerId: z.string().min(1),
  legsWon: z.record(z.string(), z.int().min(0)),
});
export type MatchWon = z.infer<typeof MatchWon>;

// Zabawa: gracz zamknął leg, zajął miejsce i wypada z kolejki. Pozostali grają dalej, dopóki nie zostanie jeden gracz.
// Wtedy ten gracz dostaje ostatnie miejsce i grę kończy casual_finished.
export const PlayerFinished = z.object({
  type: z.literal('player_finished'),
  ...base,
  place: Placement.shape.place,
  checkout: LegWon.shape.checkout,
  dartsThrown: LegWon.shape.dartsThrown,
});
export type PlayerFinished = z.infer<typeof PlayerFinished>;

export const CasualFinished = z.object({
  type: z.literal('casual_finished'),
  placements: z.array(Placement).min(2).max(4), // silnik podaje je w kolejności miejsc
});
export type CasualFinished = z.infer<typeof CasualFinished>;

export const DomainEvent = z.discriminatedUnion('type', [TurnCompleted, Bust, LegWon, MatchWon, PlayerFinished, CasualFinished]);
export type DomainEvent = z.infer<typeof DomainEvent>;
