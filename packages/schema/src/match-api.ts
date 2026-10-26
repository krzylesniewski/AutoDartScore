import { z } from 'zod';
import { DomainEvent } from './domain-events.js';
import { Hit, HitSource, Multiplier, Segment } from './hit.js';
import { BestOf, CheckoutAttempt, CheckoutRange, MatchStatus, MatchType, Placement, PracticeMode, StartingScore } from './match.js';
import { PlayerColor } from './player.js';

const PlayerId = z.string().min(1);

function distinct(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}

const distinctPlayers = { message: 'Player ids must be distinct', path: ['playerIds'] };

export const CreateMatchRequest = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('match'),
    playerIds: z.tuple([PlayerId, PlayerId]).refine(distinct, distinctPlayers),
    startingScore: StartingScore.default(301),
    bestOf: BestOf.default(1),
  }),
  z.object({
    type: z.literal('casual'),
    playerIds: z.array(PlayerId).min(2).max(4).refine(distinct, distinctPlayers),
    startingScore: StartingScore.default(301),
  }),
  z
    .object({
      type: z.literal('practice'),
      practiceMode: PracticeMode,
      playerIds: z.tuple([PlayerId]),
      checkoutRange: CheckoutRange.optional(),
    })
    .superRefine((request, ctx) => {
      if (request.practiceMode === 'checkouts' && request.checkoutRange === undefined) {
        ctx.addIssue({ code: 'custom', message: 'Checkout practice needs a checkout range', path: ['checkoutRange'] });
      }
      if (request.practiceMode !== 'checkouts' && request.checkoutRange !== undefined) {
        ctx.addIssue({ code: 'custom', message: 'Only checkout practice takes a checkout range', path: ['checkoutRange'] });
      }
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
  color: PlayerColor,
  guest: z.boolean(),
  remaining: z.int().min(0).nullable(), // null w Free run
  legsWon: z.int().min(0).nullable(), // tylko w meczu 1v1
  place: Placement.shape.place.nullable(), // tylko w zabawie, po zajęciu miejsca
  dartsThrownInLeg: z.int().min(0),
});
export type MatchSnapshotPlayer = z.infer<typeof MatchSnapshotPlayer>;

const CheckoutTarget = z.int().min(2).max(100);

// Postęp treningu checkoutów. Ziarno losowania zostaje na serwerze.
export const CheckoutSession = z
  .object({
    range: CheckoutRange,
    target: CheckoutTarget, // bieżący cel, jeszcze bez próby
    attempts: z.int().min(0),
    successes: z.int().min(0),
    skips: z.int().min(0), // pominięte cele, nie wliczają się do prób ani historii
    history: z.array(CheckoutAttempt), // zakończone próby w kolejności
  })
  .refine((session) => session.attempts === session.history.length, {
    message: 'Attempts must match the history length',
    path: ['attempts'],
  })
  .refine((session) => session.successes === session.history.filter((attempt) => attempt.success).length, {
    message: 'Successes must match the successful attempts in the history',
    path: ['successes'],
  });
export type CheckoutSession = z.infer<typeof CheckoutSession>;

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
  finishedAt: z.iso.datetime().nullable(), // receivedAt rzutki, która zakończyła grę
  editableUntil: z.iso.datetime().nullable(), // do tej chwili da się cofnąć rzutkę w zakończonej grze
  round: z.int().min(1).nullable(), // kolejka rzucającego w bieżącym legu. null po końcu gry i w Free run
  startedAt: z.iso.datetime().nullable(), // receivedAt pierwszej liczonej rzutki gry
  legStartedAt: z.iso.datetime().nullable(), // receivedAt pierwszej liczonej rzutki bieżącego lega. W Free run równe startedAt
  pausedMs: z.int().min(0), // zamknięte przerwy (porzucenie do wznowienia) od startedAt
  legPausedMs: z.int().min(0), // zamknięte przerwy od legStartedAt
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
  checkouts: CheckoutSession.nullable(), // tylko w treningu checkoutów
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
  checkouts: true,
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

export const CheckoutAttemptRequest = z.object({
  success: z.boolean(),
});
export type CheckoutAttemptRequest = z.infer<typeof CheckoutAttemptRequest>;

export const ThrowResult = z.object({
  throw: ThrowRecord,
  events: z.array(DomainEvent), // tylko zdarzenia wywołane tą rzutką
  state: MatchSnapshot,
});
export type ThrowResult = z.infer<typeof ThrowResult>;

export const UndoResult = z.object({
  undoneThrowId: z.string().min(1).nullable(), // null, gdy cofnięto próbę albo pominięcie checkoutu
  state: MatchSnapshot,
});
export type UndoResult = z.infer<typeof UndoResult>;

export const ApiError = z.object({
  error: z.string().min(1),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;

export const HealthResponse = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
