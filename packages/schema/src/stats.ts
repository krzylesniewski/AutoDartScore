import { z } from 'zod';
import { LegWon } from './domain-events.js';
import { MatchType } from './match.js';

// Statystyki liczone na żądanie z logu rzutek. Liczą się tylko zamknięte tury.

// practice to Solo 501, bo Free run nigdy nie wchodzi do statystyk.
export const StatsFilter = z.enum(['all', 'match', 'casual', 'practice']);
export type StatsFilter = z.infer<typeof StatsFilter>;

export const PlayerStatsQuery = z.object({
  type: StatsFilter.default('all'),
});
export type PlayerStatsQuery = z.infer<typeof PlayerStatsQuery>;

const Count = z.int().min(0);
const Average = z.number().min(0).nullable(); // null, gdy nie ma rzutek

export const PlayerStatLine = z.object({
  dartsThrown: Count,
  points: Count,
  average: Average,
  first9Average: Average,
  scores180: Count,
  scores140: Count,
  scores100: Count,
  scores60: Count,
  highestCheckout: LegWon.shape.checkout.nullable(),
  doubleAttempts: Count,
  doublesHit: Count,
  doublesPercent: z.number().min(0).max(100).nullable(),
  bestLegDarts: LegWon.shape.dartsThrown.nullable(),
  legsWon: Count,
});
export type PlayerStatLine = z.infer<typeof PlayerStatLine>;

const PlayerId = z.string().min(1);

export const PlayerStats = PlayerStatLine.extend({
  playerId: PlayerId,
  filter: StatsFilter,
  matchesPlayed: Count,
  matchesWon: Count,
});
export type PlayerStats = z.infer<typeof PlayerStats>;

export const MatchSummaryLeg = z.object({
  legIndex: z.int().min(0),
  winnerId: PlayerId,
  checkout: LegWon.shape.checkout,
  dartsThrown: LegWon.shape.dartsThrown, // rzutki zwycięzcy
  averages: z.array(z.object({ playerId: PlayerId, average: Average })),
});
export type MatchSummaryLeg = z.infer<typeof MatchSummaryLeg>;

export const MatchSummaryPlayer = PlayerStatLine.extend({ playerId: PlayerId });
export type MatchSummaryPlayer = z.infer<typeof MatchSummaryPlayer>;

export const MatchSummary = z.object({
  matchId: z.string().min(1),
  type: MatchType,
  finished: z.boolean(),
  eventSeq: z.int().min(0), // seq ostatniego wpisu w logu, jak w MatchSnapshot
  players: z.array(MatchSummaryPlayer), // w kolejności playerIds
  legs: z.array(MatchSummaryLeg), // jeden na leg_won, więc w zabawie lista jest pusta
});
export type MatchSummary = z.infer<typeof MatchSummary>;
