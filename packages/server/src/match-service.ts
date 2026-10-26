import { applyGameThrow, countsToStats, createGame, isGameFinished, MAX_CHECKOUT_SEED } from '@autoscore/engine';
import {
  HitEvent,
  type AbandonMatchRequest,
  type CreateMatchRequest,
  type DomainEvent,
  type LiveMessage,
  type MatchListItem,
  type MatchListQuery,
  type MatchSnapshot,
  type ThrowResult,
  type UndoResult,
} from '@autoscore/schema';
import { createAchievementReference } from './achievement-reference.js';
import { HttpError, invalidRequest, notFound } from './errors.js';
import { sendTo, type LiveHub, type LiveSocket } from './live-hub.js';
import {
  abandonment,
  effectiveCheckoutSteps,
  effectiveThrows,
  finishedAt,
  gameConfig,
  gameTimes,
  lastActivityAt,
  lastSeq,
  practiceEndedAt,
  replayMatch,
} from './replay.js';
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
  readonly matchLockMs: number; // tyle po rzutce kończącej grę da się jeszcze cofać
}

export function createMatchService({ store, hub, queue, random, now, matchLockMs }: Dependencies): MatchService {
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
    const throws = effectiveThrows(log);
    const checkoutSteps = effectiveCheckoutSteps(log);
    const { state: game, events } = replayMatch(match, throws, checkoutSteps);
    return {
      log,
      throws,
      checkoutSteps,
      seq: lastSeq(log),
      game,
      events,
      finishedAt: finishedAt(game, throws),
      abandonment: abandonment(log),
      endedAt: practiceEndedAt(log),
      updatedAt: lastActivityAt(log, match),
      times: gameTimes(log, throws, game),
    };
  }

  async function snapshot(match: StoredMatch): Promise<MatchSnapshot> {
    const { game, seq, abandonment, endedAt, finishedAt, times } = await load(match);
    return toSnapshot(match, game, seq, { abandonment, endedAt, finishedAt, lockMs: matchLockMs, ...times });
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
          throw new HttpError(409, 'throws_not_allowed', `Match ${id} is a checkout practice and takes attempts, not throws`);
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

        const { log, throws, game, events, abandonment, endedAt } = await load(match);
        if (endedAt) {
          throw ended(id);
        }
        if (abandonment) {
          throw abandoned(id);
        }
        const applied = applyGameThrow(game, { segment: hit.segment, multiplier: hit.multiplier });
        const detected = await achievements(match, events, applied.events);
        let appended;
        try {
          appended = await store.appendThrow(hit);
        } catch (error) {
          // Ten sam eventId mógł równolegle trafić do innej gry. Wtedy decyduje zapisana rzutka.
          const raced = await idempotentReply(id, hit.eventId);
          if (raced) {
            return raced;
          }
          throw error;
        }

        const { throw: record, seq } = appended;
        if (match.type === 'match' && isGameFinished(applied.state)) {
          references.invalidate();
        }
        const state = toSnapshot(match, applied.state, seq, {
          abandonment: null,
          endedAt: null,
          finishedAt: isGameFinished(applied.state) ? record.receivedAt : null,
          lockMs: matchLockMs,
          // Gra nie jest porzucona, więc dopisany wpis rzutki nie zmienia żadnej przerwy i wystarczy log sprzed zapisu.
          ...gameTimes(log, [...throws, record], applied.state),
        });
        const meta = { matchId: id, eventSeq: seq };
        hub.publish(id, [
          { type: 'throw_registered', ...meta, throw: record },
          ...applied.events.map((event): LiveMessage => ({ ...event, ...meta })),
          ...detected.map((achievement): LiveMessage => ({ ...achievement, ...meta })),
          { type: 'state_updated', ...meta, state },
        ]);
        return { statusCode: 201 as const, result: { throw: record, events: [...applied.events], state } };
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
        const { log, throws, checkoutSteps, game: before, abandonment, endedAt, finishedAt: finishTime } = await load(match);
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
        // >=, żeby blokada 0 minut działała od razu, także w tej samej milisekundzie co rzutka kończąca grę.
        if (finishTime !== null && now() >= Date.parse(finishTime) + matchLockMs) {
          throw locked(id);
        }
        const last = throws.pop();
        if (!last) {
          throw new HttpError(409, 'nothing_to_undo', `Match ${id} has no throw to undo`);
        }
        const seq = await store.appendUndo(id, last.id);
        if (match.type === 'match' && isGameFinished(before)) {
          references.invalidate();
        }
        const game = replayMatch(match, throws).state;
        const state = toSnapshot(match, game, seq, {
          abandonment: null,
          endedAt: null,
          finishedAt: finishedAt(game, throws),
          lockMs: matchLockMs,
          ...gameTimes(log, throws, game),
        });
        const meta = { matchId: id, eventSeq: seq };
        hub.publish(id, [
          { type: 'throw_undone', ...meta, throwId: last.id },
          { type: 'state_updated', ...meta, state },
        ]);
        return { undoneThrowId: last.id, state };
      });
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
        const { game, seq, abandonment, endedAt, finishedAt, updatedAt, times } = await load(match);
        const state = toSnapshot(match, game, seq, { abandonment, endedAt, finishedAt, lockMs: matchLockMs, ...times });
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
