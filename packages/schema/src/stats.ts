import { z } from 'zod';
import { LegWon } from './domain-events.js';
import { Hit, MISS_SEGMENT, Multiplier, Segment } from './hit.js';
import { MatchType } from './match.js';
import { PlayerColor } from './player.js';

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
  average: Average, // w PlayerStats tylko ukończone legi, w MatchSummary wszystkie zamknięte tury gry
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

// Ranking graczy. Średnia liczy tylko ukończone legi, a pozycję dostaje gracz z co najmniej MIN_LEGS_FOR_AVERAGE legami.
export const MIN_LEGS_FOR_AVERAGE = 3;

export const RankingsQuery = z.object({ type: StatsFilter.default('all') });
export type RankingsQuery = z.infer<typeof RankingsQuery>;

export const RankedPlayer = z.object({
  playerId: PlayerId,
  name: z.string().min(1),
  avatar: z.string().nullable(),
  color: PlayerColor,
  position: z.int().min(1).nullable(), // null poniżej MIN_LEGS_FOR_AVERAGE ukończonych legów
  average: Average, // tylko ukończone legi
  legs: Count, // ukończone legi
});
export type RankedPlayer = z.infer<typeof RankedPlayer>;

// Remis daje tę samą pozycję, a następna pozycja jest pomijana (1, 1, 3).
export const RankingEntry = z.object({
  playerId: PlayerId,
  name: z.string().min(1),
  avatar: z.string().nullable(),
  color: PlayerColor,
  position: z.int().min(1),
  value: z.number().min(0),
});
export type RankingEntry = z.infer<typeof RankingEntry>;

export const StatsRankings = z.object({
  filter: StatsFilter,
  games: Count,
  legs: Count,
  players: z.array(RankedPlayer),
  bestLegAverage: z.array(RankingEntry),
  highestCheckout: z.array(RankingEntry),
  shortestLeg: z.array(RankingEntry),
  highestTurn: z.array(RankingEntry), // tylko mecze 1v1
});
export type StatsRankings = z.infer<typeof StatsRankings>;

// Bilans dwóch graczy z ukończonych meczów 1v1. Porzucona gra nie ma zwycięzcy, więc nie wchodzi do bilansu.
export const HeadToHead = z.object({
  playerId: PlayerId,
  opponentId: PlayerId,
  matchesPlayed: Count,
  matchesWon: Count,
  opponentMatchesWon: Count,
  legsWon: Count,
  opponentLegsWon: Count,
  average: Average, // tylko ukończone legi tych meczów
  opponentAverage: Average,
  lastPlayedAt: z.iso.datetime().nullable(),
});
export type HeadToHead = z.infer<typeof HeadToHead>;

// Forma gracza: średnia na 3 rzutki z ukończonych legów każdej z ostatnich gier.
export const FORM_GAMES = 20;

export const PlayerFormQuery = z.object({ type: StatsFilter.default('all') });
export type PlayerFormQuery = z.infer<typeof PlayerFormQuery>;

export const PlayerFormPoint = z.object({
  matchId: z.string().min(1),
  type: MatchType,
  createdAt: z.iso.datetime(),
  average: z.number().min(0),
  legs: z.int().min(1), // ukończone legi gracza w tej grze
});
export type PlayerFormPoint = z.infer<typeof PlayerFormPoint>;

export const PlayerForm = z.object({
  playerId: PlayerId,
  filter: StatsFilter,
  points: z.array(PlayerFormPoint).max(FORM_GAMES), // od najstarszej gry
});
export type PlayerForm = z.infer<typeof PlayerForm>;

// Najczęstsze trafienia gracza z zamkniętych tur gier liczonych do statystyk, bez Miss.
export const FREQUENT_HITS_LIMIT = 6;

export const FrequentHit = z.object({
  segment: Segment,
  multiplier: Multiplier,
  count: z.int().min(1),
}).refine((hit) => Hit.safeParse(hit).success && hit.segment !== MISS_SEGMENT, {
  message: 'Invalid segment and multiplier combination',
  path: ['multiplier'],
});
export type FrequentHit = z.infer<typeof FrequentHit>;

export const FrequentHitsResponse = z.object({
  playerId: PlayerId,
  hits: z.array(FrequentHit).max(FREQUENT_HITS_LIMIT), // od najczęstszego
});
export type FrequentHitsResponse = z.infer<typeof FrequentHitsResponse>;
