import { z } from 'zod';
import { DomainEvent } from './domain-events.js';
import { Hit, HitSource, Multiplier, Segment } from './hit.js';
import { BestOf, MatchStatus, MatchType, Placement, PracticeMode, StartingScore } from './match.js';

const PlayerId = z.string().min(1);

function distinct(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}

const distinctPlayers = { message: 'Player ids must be distinct', path: ['playerIds'] };

export const CreateMatchRequest = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('match'),
    playerIds: z.tuple([PlayerId, PlayerId]).refine(distinct, distinctPlayers),
    startingScore: StartingScore.default(501),
    bestOf: BestOf.default(3),
  }),
  z.object({
    type: z.literal('casual'),
    playerIds: z.array(PlayerId).min(2).max(4).refine(distinct, distinctPlayers),
    startingScore: StartingScore.default(501),
  }),
  z.object({
    type: z.literal('practice'),
    practiceMode: PracticeMode,
    playerIds: z.tuple([PlayerId]),
  }),
]);
export type CreateMatchRequest = z.infer<typeof CreateMatchRequest>;

// Trafienie w takiej postaci, w jakiej przyszło, plus identyfikator nadany przez serwer i czas odbioru.
export const ThrowRecord = z.object({
  id: z.string().min(1),
  matchId: z.string().min(1),
  eventId: z.uuid(),
  source: HitSource,
  sequence: z.int().min(0),
  segment: Segment,
  multiplier: Multiplier,
  confidence: z.number().min(0).max(1),
  detectedAt: z.iso.datetime(),
  receivedAt: z.iso.datetime(),
}).refine((record) => Hit.safeParse(record).success, {
  message: 'Invalid segment and multiplier combination',
  path: ['multiplier'],
});
export type ThrowRecord = z.infer<typeof ThrowRecord>;

export const MatchSnapshotPlayer = z.object({
  id: PlayerId,
  name: z.string().min(1),
  avatar: z.string().nullable(),
  guest: z.boolean(),
  remaining: z.int().min(0).nullable(), // null w Free run
  legsWon: z.int().min(0).nullable(), // tylko w meczu 1v1
  place: Placement.shape.place.nullable(), // tylko w zabawie, po zajęciu miejsca
  dartsThrownInLeg: z.int().min(0),
});
export type MatchSnapshotPlayer = z.infer<typeof MatchSnapshotPlayer>;

export const Abandonment = z.object({
  playerId: PlayerId,
  reason: z.string().nullable(),
  at: z.iso.datetime(),
});
export type Abandonment = z.infer<typeof Abandonment>;

// Stan gry wysyłany przez REST i WebSocket. Serwer buduje go od nowa z logu zdarzeń.
export const MatchSnapshot = z.object({
  id: z.string().min(1),
  type: MatchType,
  practiceMode: PracticeMode.nullable(),
  startingScore: z.int().min(1).nullable(), // null w Free run
  legsToWin: z.int().min(1).nullable(), // tylko w meczu 1v1
  countsToStats: z.boolean(),
  createdAt: z.iso.datetime(),
  finished: z.boolean(),
  status: MatchStatus,
  abandonment: Abandonment.nullable(), // tylko gdy gra jest porzucona. Historię trzyma log
  endedAt: z.iso.datetime().nullable(), // tylko w zakończonym treningu
  eventSeq: z.int().min(0), // seq ostatniego wpisu w logu, 0 dla pustego logu
  currentPlayerId: PlayerId.nullable(),
  legIndex: z.int().min(0),
  turnIndex: z.int().min(0),
  currentDarts: z.array(Hit).max(2),
  players: z.array(MatchSnapshotPlayer).min(1).max(4), // w kolejności playerIds z żądania utworzenia
  winnerId: PlayerId.nullable(),
  placements: z.array(Placement),
  freeRun: z
    .object({
      dartsThrown: z.int().min(0),
      totalPoints: z.int().min(0),
      average: z.number().min(0),
    })
    .nullable(),
});
export type MatchSnapshot = z.infer<typeof MatchSnapshot>;

// Lista gier bez szczegółów tury. updatedAt to czas ostatniego wpisu w logu albo utworzenia gry.
export const MatchListItem = MatchSnapshot.pick({
  id: true,
  type: true,
  practiceMode: true,
  startingScore: true,
  legsToWin: true,
  createdAt: true,
  status: true,
  abandonment: true,
  currentPlayerId: true,
  legIndex: true,
  players: true,
  freeRun: true,
  winnerId: true,
  placements: true,
  endedAt: true,
}).extend({ updatedAt: z.iso.datetime() });
export type MatchListItem = z.infer<typeof MatchListItem>;

// Filtry łączą się ze sobą. playerId to gracz na dowolnym miejscu.
export const MatchListQuery = z.object({
  status: z.literal('unfinished').optional(),
  playerId: PlayerId.optional(),
  type: MatchType.optional(),
});
export type MatchListQuery = z.infer<typeof MatchListQuery>;

export const AbandonMatchRequest = z.object({
  playerId: PlayerId,
  reason: z.string().trim().min(1).max(200).optional(),
});
export type AbandonMatchRequest = z.infer<typeof AbandonMatchRequest>;

export const ThrowResult = z.object({
  throw: ThrowRecord,
  events: z.array(DomainEvent), // tylko zdarzenia wywołane tą rzutką
  state: MatchSnapshot,
});
export type ThrowResult = z.infer<typeof ThrowResult>;

export const UndoResult = z.object({
  undoneThrowId: z.string().min(1),
  state: MatchSnapshot,
});
export type UndoResult = z.infer<typeof UndoResult>;

export const ApiError = z.object({
  error: z.string().min(1),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;
