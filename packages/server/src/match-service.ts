import { applyGameThrow, countsToStats, createGame } from '@autoscore/engine';
import { HitEvent, type CreateMatchRequest, type LiveMessage, type MatchSnapshot, type ThrowResult, type UndoResult } from '@autoscore/schema';
import { HttpError, invalidRequest, notFound } from './errors.js';
import { sendTo, type LiveHub, type LiveSocket } from './live-hub.js';
import { effectiveThrows, gameConfig, lastSeq, replayMatch } from './replay.js';
import type { SerialQueue } from './serial-queue.js';
import { toSnapshot } from './snapshot.js';
import type { NewMatch, Store, StoredMatch } from './store/store.js';

export interface MatchService {
  create(request: CreateMatchRequest): Promise<MatchSnapshot>;
  get(id: string): Promise<MatchSnapshot>;
  registerThrow(id: string, body: unknown): Promise<{ statusCode: 200 | 201; result: ThrowResult }>;
  undo(id: string): Promise<UndoResult>;
  // null, gdy gry nie ma. Inaczej funkcja do wypisania gniazda.
  subscribe(id: string, socket: LiveSocket): Promise<(() => void) | null>;
}

interface Dependencies {
  readonly store: Store;
  readonly hub: LiveHub;
  readonly queue: SerialQueue;
  readonly random: () => number;
}

export function createMatchService({ store, hub, queue, random }: Dependencies): MatchService {
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
    return { throws, seq: lastSeq(log), game: replayMatch(match, throws).state };
  }

  async function snapshot(match: StoredMatch): Promise<MatchSnapshot> {
    const { game, seq } = await load(match);
    return toSnapshot(match, game, seq);
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
          playerIds: request.playerIds,
        };
      case 'casual':
        return {
          type: request.type,
          practiceMode: null,
          startingScore: request.startingScore,
          legsToWin: null,
          firstPlayerIndex: draw(request.playerIds.length),
          playerIds: request.playerIds,
        };
      case 'practice':
        return {
          type: request.type,
          practiceMode: request.practiceMode,
          startingScore: null,
          legsToWin: null,
          firstPlayerIndex: null,
          playerIds: request.playerIds,
        };
    }
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

        const { game } = await load(match);
        const applied = applyGameThrow(game, { segment: hit.segment, multiplier: hit.multiplier });
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
        const state = toSnapshot(match, applied.state, seq);
        const meta = { matchId: id, eventSeq: seq };
        hub.publish(id, [
          { type: 'throw_registered', ...meta, throw: record },
          ...applied.events.map((event): LiveMessage => ({ ...event, ...meta })),
          { type: 'state_updated', ...meta, state },
        ]);
        return { statusCode: 201 as const, result: { throw: record, events: [...applied.events], state } };
      });
    },

    undo(id) {
      return queue(id, async () => {
        const match = await requireMatch(id);
        const { throws } = await load(match);
        const last = throws.pop();
        if (!last) {
          throw new HttpError(409, 'nothing_to_undo', `Match ${id} has no throw to undo`);
        }
        const seq = await store.appendUndo(id, last.id);
        const state = toSnapshot(match, replayMatch(match, throws).state, seq);
        const meta = { matchId: id, eventSeq: seq };
        hub.publish(id, [
          { type: 'throw_undone', ...meta, throwId: last.id },
          { type: 'state_updated', ...meta, state },
        ]);
        return { undoneThrowId: last.id, state };
      });
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
