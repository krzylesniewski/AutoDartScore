import { countsToStats, createGame, isGameFinished, MAX_CHECKOUT_SEED, type GameState, type ThrowLogStep } from '@autoscore/engine';
import {
  HitEvent,
  type AbandonMatchRequest,
  type CreateMatchRequest,
  type DomainEvent,
  type LiveMessage,
  type MatchListItem,
  type MatchListQuery,
  type MatchSnapshot,
  type ReviewedThrow,
  type ReviewQueue,
  type ReviewResult,
  type ThrowResult,
  type UndoResult,
  type VerifyThrowRequest,
} from '@autoscore/schema';
import { createAchievementReference } from './achievement-reference.js';
import { HttpError, invalidRequest, notFound } from './errors.js';
import { sendTo, type LiveHub, type LiveSocket } from './live-hub.js';
import { abandonment, effectiveCheckoutSteps, gameConfig, gameTimes, lastActivityAt, lastSeq, practiceEndedAt, replayLog } from './replay.js';
import type { SerialQueue } from './serial-queue.js';
import { toSnapshot } from './snapshot.js';
import { detectAchievements, type DetectedAchievement, type PlayerRecords } from './stats/achievements.js';
import type { NewMatch, Store, StoredMatch } from './store/store.js';

export interface MatchService {
  create(request: CreateMatchRequest): Promise<MatchSnapshot>;
  get(id: string): Promise<MatchSnapshot>;
  registerThrow(id: string, body: unknown): Promise<{ statusCode: 200 | 201; result: ThrowResult }>;
  registerCheckoutAttempt(id: string, success: boolean): Promise<MatchSnapshot>;
  registerCheckoutSkip(id: string): Promise<MatchSnapshot>;
  undo(id: string): Promise<UndoResult>;
  flag(id: string, throwId: string): Promise<ReviewResult>;
  verify(id: string, throwId: string, hit: VerifyThrowRequest): Promise<ReviewResult>;
  reviewQueue(id: string): Promise<ReviewQueue>;
  abandon(id: string, request: AbandonMatchRequest): Promise<MatchSnapshot>;
  resume(id: string): Promise<MatchSnapshot>;
  endPractice(id: string): Promise<MatchSnapshot>;
  list(query: MatchListQuery): Promise<MatchListItem[]>;
  // null, gdy gry nie ma. Inaczej funkcja do wypisania gniazda.
  subscribe(id: string, socket: LiveSocket): Promise<(() => void) | null>;
}

interface Dependencies {
  readonly store: Store;
  readonly hub: LiveHub;
  readonly queue: SerialQueue;
  readonly random: () => number;
  readonly now: () => number;
  readonly matchLockMs: number; // tyle po wpisie kończącym grę da się jeszcze cofać, oznaczać i weryfikować rzutki
  readonly pendingConfidence: number; // rzutka z mniejszą pewnością czeka na weryfikację
}

// Tymczasowy identyfikator rzutki sprawdzanej w silniku przed zapisem. Serwer nadaje rzutkom UUID, więc nie koliduje.
const UNSAVED_THROW_ID = 'unsaved';

export function createMatchService({ store, hub, queue, random, now, matchLockMs, pendingConfidence }: Dependencies): MatchService {
  const references = createAchievementReference({ store });

  async function requireMatch(id: string): Promise<StoredMatch> {
    const match = await store.findMatch(id);
    if (!match) {
      throw notFound(`Match ${id}`);
    }
    return match;
  }

  // Stan zawsze z odtworzenia logu.
  async function load(match: StoredMatch) {
    const log = await store.loadLog(match.id);
    const replay = replayLog(match, log);
    const { game, events, counted, throws, finishedAt, lastTurnThrows, awaitingReview } = replay;
    const seq = lastSeq(log);
    const loaded = {
      log,
      throws,
      checkoutSteps: effectiveCheckoutSteps(log),
      seq,
      game,
      events,
      finishedAt,
      abandonment: abandonment(log),
      endedAt: practiceEndedAt(log),
      updatedAt: lastActivityAt(log, match),
      times: gameTimes(log, counted, game),
    };
    const state = toSnapshot(
      match,
      game,
      seq,
      { abandonment: loaded.abandonment, endedAt: loaded.endedAt, finishedAt, lockMs: matchLockMs, ...loaded.times },
      { lastTurnThrows, awaitingReview },
    );
    return { ...loaded, state };
  }

  async function snapshot(match: StoredMatch): Promise<MatchSnapshot> {
    return (await load(match)).state;
  }

  function abandoned(id: string): HttpError {
    return new HttpError(409, 'match_abandoned', `Match ${id} is abandoned`);
  }

  function finished(id: string): HttpError {
    return new HttpError(409, 'match_finished', `Match ${id} is finished`);
  }

  function ended(id: string): HttpError {
    return new HttpError(409, 'practice_ended', `Match ${id} is ended`);
  }

  function locked(id: string): HttpError {
    return new HttpError(409, 'match_locked', `Match ${id} is locked`);
  }

  function throwsNotAllowed(id: string): HttpError {
    return new HttpError(409, 'throws_not_allowed', `Match ${id} is a checkout practice and takes attempts, not throws`);
  }

  function isCheckouts(match: StoredMatch): boolean {
    return match.type === 'practice' && match.practiceMode === 'checkouts';
  }

  function publishState(id: string, state: MatchSnapshot): void {
    hub.publish(id, [{ type: 'state_updated', matchId: id, eventSeq: state.eventSeq, state }]);
  }

  function draw(playerCount: number): number {
    return Math.min(Math.floor(random() * playerCount), playerCount - 1);
  }

  function newMatch(request: CreateMatchRequest): Omit<NewMatch, 'countsToStats'> {
    switch (request.type) {
      case 'match':
        return {
          type: request.type,
          practiceMode: null,
          startingScore: request.startingScore,
          legsToWin: (request.bestOf + 1) / 2,
          firstPlayerIndex: draw(request.playerIds.length),
          checkoutRange: null,
          checkoutSeed: null,
          checkoutRule: null,
          playerIds: request.playerIds,
        };
      case 'casual':
        return {
          type: request.type,
          practiceMode: null,
          startingScore: request.startingScore,
          legsToWin: null,
          firstPlayerIndex: draw(request.playerIds.length),
          checkoutRange: null,
          checkoutSeed: null,
          checkoutRule: null,
          playerIds: request.playerIds,
        };
      case 'practice': {
        // Jedno losowanie na sesję. Kolejne cele silnik wylicza z ziarna, więc odtworzenie logu daje te same cele.
        const checkouts = request.practiceMode === 'checkouts';
        return {
          type: request.type,
          practiceMode: request.practiceMode,
          startingScore: null,
          legsToWin: null,
          firstPlayerIndex: null,
          checkoutRange: checkouts ? (request.checkoutRange ?? null) : null,
          checkoutSeed: checkouts ? Math.min(Math.floor(random() * (MAX_CHECKOUT_SEED + 1)), MAX_CHECKOUT_SEED) : null,
          checkoutRule: checkouts ? 'repeat_on_miss' : null,
          playerIds: request.playerIds,
        };
      }
    }
  }

  // Próba i pominięcie mają te same warunki: tylko trwający, nieporzucony trening checkoutów.
  function checkoutCommand(id: string, append: () => Promise<number>): Promise<MatchSnapshot> {
    return queue(id, async () => {
      const match = await requireMatch(id);
      if (!isCheckouts(match)) {
        throw new HttpError(409, 'not_checkouts', `Match ${id} is not a checkout practice`);
      }
      const { abandonment, endedAt } = await load(match);
      if (endedAt) {
        throw ended(id);
      }
      if (abandonment) {
        throw abandoned(id);
      }
      await append();
      const state = await snapshot(match);
      publishState(id, state);
      return state;
    });
  }

  // Tylko mecz 1v1 i tylko zapisane profile, które mają już za sobą inny ukończony mecz 1v1.
  async function achievements(match: StoredMatch, earlierEvents: readonly DomainEvent[], newEvents: readonly DomainEvent[]): Promise<DetectedAchievement[]> {
    if (match.type !== 'match' || !newEvents.some((event) => event.type === 'turn_completed')) {
      return [];
    }
    const reference = new Map<string, PlayerRecords>();
    const eligible = new Set<string>();
    for (const player of match.players) {
      if (player.guest) {
        continue;
      }
      const { finishedMatches, records } = await references.forPlayer(player.id, match.id);
      reference.set(player.id, records);
      if (finishedMatches > 0) {
        eligible.add(player.id);
      }
    }
    if (eligible.size === 0) {
      return [];
    }
    const playerIds = match.players.map((player) => player.id);
    return detectAchievements({ reference, earlierEvents, newEvents, playerIds, eligible });
  }

  async function idempotentReply(id: string, eventId: string) {
    const stored = await store.findThrowByEventId(eventId);
    if (!stored) {
      return null;
    }
    if (stored.matchId !== id) {
      throw new HttpError(409, 'event_id_conflict', `Event ${eventId} is already stored for another match`);
    }
    // Ponowne wysłanie niczego nie zapisuje i niczego nie rozgłasza, nawet gdy rzutkę cofnięto albo gra już się skończyła.
    return { statusCode: 200 as const, result: { throw: stored, events: [], state: await snapshot(await requireMatch(id)) } };
  }

  // >=, żeby blokada 0 minut działała od razu, także w tej samej milisekundzie co wpis kończący grę.
  function checkLock(id: string, finishTime: string | null): void {
    if (finishTime !== null && now() >= Date.parse(finishTime) + matchLockMs) {
      throw locked(id);
    }
  }

  // Rekordy z ukończonych meczów 1v1 zależą od tego, czy gra jest zakończona.
  function invalidateReferences(match: StoredMatch, before: GameState, after: GameState): void {
    if (match.type === 'match' && isGameFinished(before) !== isGameFinished(after)) {
      references.invalidate();
    }
  }

  function reviewed(throws: readonly ReviewedThrow[], throwId: string): ReviewedThrow {
    const found = throws.find((entry) => entry.id === throwId);
    if (!found) {
      throw new Error(`Throw ${throwId} is missing after the replay`);
    }
    return found;
  }

  // Oznaczenie i weryfikacja: te same warunki co cofnięcie, a resztę sprawdza silnik przed zapisem.
  function reviewCommand(
    id: string,
    throwId: string,
    step: ThrowLogStep,
    append: () => Promise<{ seq: number; type: 'throw_flagged' | 'throw_verified' }>,
  ): Promise<ReviewResult> {
    return queue(id, async () => {
      const match = await requireMatch(id);
      if (isCheckouts(match)) {
        throw throwsNotAllowed(id);
      }
      const before = await load(match);
      if (!before.log.throws.has(throwId)) {
        throw notFound(`Throw ${throwId}`);
      }
      if (before.endedAt) {
        throw ended(id);
      }
      if (before.abandonment) {
        throw abandoned(id);
      }
      checkLock(id, before.finishedAt);
      replayLog(match, before.log, [step]);
      const { seq, type } = await append();
      const after = await load(match);
      // Oznaczenie tylko zdejmuje rzutki z gry, a weryfikacja tylko dopisuje policzone, więc nowe zdarzenia są na końcu.
      const events = type === 'throw_verified' ? after.events.slice(before.events.length) : [];
      const detected = await achievements(match, before.events, events);
      invalidateReferences(match, before.game, after.game);
      const record = reviewed(after.throws, throwId);
      const meta = { matchId: id, eventSeq: seq };
      hub.publish(id, [
        { type, ...meta, throw: record },
        ...events.map((event): LiveMessage => ({ ...event, ...meta })),
        ...detected.map((achievement): LiveMessage => ({ ...achievement, ...meta })),
        { type: 'state_updated', ...meta, state: after.state },
      ]);
      return { throw: record, events: [...events], state: after.state };
    });
  }

  return {
    async create(request) {
      const found = await store.findPlayers(request.playerIds);
      const players = request.playerIds.flatMap((id) => found.filter((player) => player.id === id));
      const unknown = request.playerIds.filter((id) => !found.some((player) => player.id === id));
      if (unknown.length > 0) {
        throw new HttpError(400, 'unknown_player', `Unknown player: ${unknown.join(', ')}`);
      }
      const match = newMatch(request);
      const config = gameConfig({ ...match, id: 'new', players });
      createGame(config); // odrzuca złą konfigurację, zanim cokolwiek zapiszemy
      const id = await store.createMatch({ ...match, countsToStats: countsToStats(config) });
      return snapshot(await requireMatch(id));
    },

    async get(id) {
      return snapshot(await requireMatch(id));
    },

    registerThrow(id, body) {
      return queue(id, async () => {
        const match = await requireMatch(id);
        if (isCheckouts(match)) {
          throw throwsNotAllowed(id);
        }
        const parsed = HitEvent.safeParse(body);
        if (!parsed.success) {
          throw invalidRequest(parsed.error.issues);
        }
        const hit = parsed.data;
        if (hit.matchId !== id) {
          throw new HttpError(400, 'match_mismatch', `Hit matchId ${hit.matchId} does not match the URL match ${id}`);
        }
        const repeated = await idempotentReply(id, hit.eventId);
        if (repeated) {
          return repeated;
        }

        const before = await load(match);
        if (before.endedAt) {
          throw ended(id);
        }
        if (before.abandonment) {
          throw abandoned(id);
        }
        const flag = hit.confidence < pendingConfidence ? { reason: hit.review?.reason ?? 'low_confidence', actor: 'system' as const } : null;
        const steps: ThrowLogStep[] = [{ type: 'throw', throwId: UNSAVED_THROW_ID, hit: { segment: hit.segment, multiplier: hit.multiplier } }];
        if (flag) {
          steps.push({ type: 'flag', throwId: UNSAVED_THROW_ID });
        }
        replayLog(match, before.log, steps); // błąd silnika, np. turn_pending, przerywa komendę przed zapisem
        let appended;
        try {
          appended = await store.appendThrow(hit, flag);
        } catch (error) {
          // Ten sam eventId mógł równolegle trafić do innej gry. Wtedy decyduje zapisana rzutka.
          const raced = await idempotentReply(id, hit.eventId);
          if (raced) {
            return raced;
          }
          throw error;
        }

        const { throw: record, seq } = appended;
        const after = await load(match);
        const events = after.events.slice(before.events.length);
        const detected = await achievements(match, before.events, events);
        invalidateReferences(match, before.game, after.game);
        const meta = { matchId: id, eventSeq: seq };
        hub.publish(id, [
          { type: 'throw_registered', ...meta, throw: record },
          ...(flag ? [{ type: 'throw_flagged' as const, ...meta, throw: reviewed(after.throws, record.id) }] : []),
          ...events.map((event): LiveMessage => ({ ...event, ...meta })),
          ...detected.map((achievement): LiveMessage => ({ ...achievement, ...meta })),
          { type: 'state_updated', ...meta, state: after.state },
        ]);
        return { statusCode: 201 as const, result: { throw: record, events: [...events], state: after.state } };
      });
    },

    registerCheckoutAttempt(id, success) {
      return checkoutCommand(id, () => store.appendCheckoutAttempt(id, success));
    },

    registerCheckoutSkip(id) {
      return checkoutCommand(id, () => store.appendCheckoutSkip(id));
    },

    undo(id) {
      return queue(id, async () => {
        const match = await requireMatch(id);
        const { throws, checkoutSteps, game: before, abandonment, endedAt, finishedAt: finishTime } = await load(match);
        if (endedAt) {
          throw ended(id);
        }
        if (abandonment) {
          throw abandoned(id);
        }
        // Cofnięcie próby albo pominięcia przywraca poprzedni cel, bo cel zależy tylko od ziarna i liczby losowań.
        if (isCheckouts(match)) {
          const last = checkoutSteps.at(-1);
          if (!last) {
            throw new HttpError(409, 'nothing_to_undo', `Match ${id} has no checkout attempt or skip to undo`);
          }
          await (last.type === 'attempt' ? store.appendCheckoutUndo(id) : store.appendCheckoutSkipUndo(id));
          const state = await snapshot(match);
          publishState(id, state);
          return { undoneThrowId: null, state };
        }
        checkLock(id, finishTime);
        const last = throws.at(-1);
        if (!last) {
          throw new HttpError(409, 'nothing_to_undo', `Match ${id} has no throw to undo`);
        }
        const seq = await store.appendUndo(id, last.id);
        const after = await load(match);
        invalidateReferences(match, before, after.game);
        const meta = { matchId: id, eventSeq: seq };
        hub.publish(id, [
          { type: 'throw_undone', ...meta, throwId: last.id },
          { type: 'state_updated', ...meta, state: after.state },
        ]);
        return { undoneThrowId: last.id, state: after.state };
      });
    },

    flag(id, throwId) {
      return reviewCommand(id, throwId, { type: 'flag', throwId }, async () => {
        const seq = await store.appendFlag(id, throwId, 'manual', 'player');
        return { seq, type: 'throw_flagged' as const };
      });
    },

    verify(id, throwId, hit) {
      return reviewCommand(id, throwId, { type: 'verify', throwId, hit }, async () => {
        const seq = await store.appendVerify(id, throwId, hit, 'player');
        return { seq, type: 'throw_verified' as const };
      });
    },

    async reviewQueue(id) {
      const { seq, throws } = await load(await requireMatch(id));
      return { matchId: id, eventSeq: seq, throws: throws.filter((entry) => entry.status === 'pending') };
    },

    abandon(id, request) {
      return queue(id, async () => {
        const match = await requireMatch(id);
        if (!match.players.some((player) => player.id === request.playerId)) {
          throw new HttpError(400, 'not_a_participant', `Player ${request.playerId} does not play in match ${id}`);
        }
        const { game, abandonment, endedAt } = await load(match);
        if (isGameFinished(game)) {
          throw finished(id);
        }
        if (endedAt) {
          throw ended(id);
        }
        if (abandonment) {
          throw abandoned(id);
        }
        await store.appendAbandon(id, request.playerId, request.reason ?? null);
        const state = await snapshot(match);
        publishState(id, state);
        return state;
      });
    },

    resume(id) {
      return queue(id, async () => {
        const match = await requireMatch(id);
        const { abandonment } = await load(match);
        if (!abandonment) {
          throw new HttpError(409, 'match_not_abandoned', `Match ${id} is not abandoned`);
        }
        await store.appendResume(id);
        const state = await snapshot(match);
        publishState(id, state);
        return state;
      });
    },

    endPractice(id) {
      return queue(id, async () => {
        const match = await requireMatch(id);
        if (match.type !== 'practice') {
          throw new HttpError(409, 'not_practice', `Match ${id} is not a practice session`);
        }
        const { game, throws, checkoutSteps, abandonment, endedAt } = await load(match);
        if (endedAt) {
          throw ended(id);
        }
        if (isGameFinished(game)) {
          throw finished(id);
        }
        if (abandonment) {
          throw abandoned(id);
        }
        // Same pominięcia nie wystarczą, bo nie są próbami.
        if (isCheckouts(match) && !checkoutSteps.some((step) => step.type === 'attempt')) {
          throw new HttpError(409, 'nothing_to_end', `Match ${id} has no checkout attempt yet`);
        }
        if (!isCheckouts(match) && throws.length === 0) {
          throw new HttpError(409, 'nothing_to_end', `Match ${id} has no throw yet`);
        }
        await store.appendPracticeEnd(id);
        const state = await snapshot(match);
        publishState(id, state);
        return state;
      });
    },

    async list(query) {
      const items: MatchListItem[] = [];
      for (const match of await store.listMatches()) {
        if (query.type !== undefined && match.type !== query.type) {
          continue;
        }
        if (query.playerId !== undefined && !match.players.some((player) => player.id === query.playerId)) {
          continue;
        }
        const { abandonment, endedAt, updatedAt, state } = await load(match);
        if (query.status === 'unfinished' && (state.status === 'finished' || state.status === 'ended')) {
          continue;
        }
        const { id, type, practiceMode, startingScore, legsToWin, createdAt, status, currentPlayerId, legIndex, players, freeRun, checkouts, winnerId, placements } = state;
        items.push({
          id,
          type,
          practiceMode,
          startingScore,
          legsToWin,
          createdAt,
          status,
          abandonment,
          currentPlayerId,
          legIndex,
          players,
          freeRun,
          checkouts,
          winnerId,
          placements,
          endedAt,
          updatedAt,
        });
      }
      return items.sort((a, b) => (a.updatedAt === b.updatedAt ? a.id.localeCompare(b.id) : b.updatedAt.localeCompare(a.updatedAt)));
    },

    // W kolejce gry, więc pierwszy state_updated nie wyprzedzi ani nie zdubluje wiadomości z równoległej komendy.
    subscribe(id, socket) {
      return queue(id, async () => {
        const match = await store.findMatch(id);
        if (!match) {
          return null;
        }
        const state = await snapshot(match);
        const unsubscribe = hub.subscribe(id, socket);
        sendTo(socket, [{ type: 'state_updated', matchId: id, eventSeq: state.eventSeq, state }]);
        return unsubscribe;
      });
    },
  };
}
