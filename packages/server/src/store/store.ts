import { randomUUID } from 'node:crypto';
import type { Kysely, Selectable } from 'kysely';
import type { CreatePlayerRequest, MatchType, Player, PracticeMode, ThrowRecord } from '@autoscore/schema';
import type { Database, MatchEventType, MatchesTable, PlayersTable, ThrowsTable } from '../db/database.js';

// Jedyny moduł, który dotyka Kysely. Tylko wstawia i czyta: nic nie jest nadpisywane ani usuwane.

export interface StoredMatch {
  readonly id: string;
  readonly type: MatchType;
  readonly practiceMode: PracticeMode | null;
  readonly startingScore: number | null;
  readonly legsToWin: number | null;
  readonly firstPlayerIndex: number | null;
  readonly countsToStats: boolean;
  readonly createdAt: string;
  readonly players: readonly Player[]; // w kolejności position
}

export type NewMatch = Omit<StoredMatch, 'id' | 'createdAt' | 'players'> & { readonly playerIds: readonly string[] };

export interface LogEntry {
  readonly seq: number;
  readonly type: MatchEventType;
  readonly throwId: string;
}

export interface MatchLog {
  readonly entries: readonly LogEntry[];
  readonly throws: ReadonlyMap<string, ThrowRecord>;
}

export type NewThrow = Omit<ThrowRecord, 'id' | 'receivedAt'>;

export interface Store {
  createPlayer(request: CreatePlayerRequest): Promise<Player>;
  listPlayers(): Promise<Player[]>;
  findPlayers(ids: readonly string[]): Promise<Player[]>;
  createMatch(match: NewMatch): Promise<string>;
  findMatch(id: string): Promise<StoredMatch | null>;
  loadLog(matchId: string): Promise<MatchLog>;
  findThrowByEventId(eventId: string): Promise<ThrowRecord | null>;
  appendThrow(hit: NewThrow): Promise<{ throw: ThrowRecord; seq: number }>;
  appendUndo(matchId: string, throwId: string): Promise<number>;
}

function now(): string {
  return new Date().toISOString();
}

function toPlayer(row: Selectable<PlayersTable>): Player {
  return { id: row.id, name: row.name, avatar: row.avatar, guest: row.guest === 1, createdAt: row.created_at };
}

function toThrow(row: Selectable<ThrowsTable>): ThrowRecord {
  return {
    id: row.id,
    matchId: row.match_id,
    eventId: row.event_id,
    source: row.source,
    sequence: row.sequence,
    segment: row.segment,
    multiplier: row.multiplier,
    confidence: row.confidence,
    detectedAt: row.detected_at,
    receivedAt: row.received_at,
  } as ThrowRecord; // segment i mnożnik zapisał serwer po walidacji HitEvent
}

function toMatch(row: Selectable<MatchesTable>, players: readonly Player[]): StoredMatch {
  return {
    id: row.id,
    type: row.type as MatchType,
    practiceMode: row.practice_mode as PracticeMode | null,
    startingScore: row.starting_score,
    legsToWin: row.legs_to_win,
    firstPlayerIndex: row.first_player_index,
    countsToStats: row.counts_to_stats === 1,
    createdAt: row.created_at,
    players,
  };
}

export function createStore(db: Kysely<Database>): Store {
  // Wywoływane w transakcji. Kolejność w logu nadaje serwer, a nie pole sequence od klienta.
  async function nextSeq(trx: Kysely<Database>, matchId: string): Promise<number> {
    const row = await trx
      .selectFrom('match_events')
      .select((eb) => eb.fn.max('seq').as('seq'))
      .where('match_id', '=', matchId)
      .executeTakeFirst();
    return Number(row?.seq ?? 0) + 1;
  }

  return {
    async createPlayer(request) {
      const row = {
        id: randomUUID(),
        name: request.name,
        avatar: request.avatar ?? null,
        guest: request.guest ? 1 : 0,
        created_at: now(),
      };
      await db.insertInto('players').values(row).execute();
      return toPlayer(row);
    },

    async listPlayers() {
      const rows = await db.selectFrom('players').selectAll().where('guest', '=', 0).orderBy('name').orderBy('id').execute();
      return rows.map(toPlayer);
    },

    async findPlayers(ids) {
      if (ids.length === 0) {
        return [];
      }
      const rows = await db.selectFrom('players').selectAll().where('id', 'in', [...ids]).execute();
      return rows.map(toPlayer);
    },

    async createMatch(match) {
      const id = randomUUID();
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('matches')
          .values({
            id,
            type: match.type,
            practice_mode: match.practiceMode,
            starting_score: match.startingScore,
            legs_to_win: match.legsToWin,
            first_player_index: match.firstPlayerIndex,
            counts_to_stats: match.countsToStats ? 1 : 0,
            created_at: now(),
          })
          .execute();
        await trx
          .insertInto('match_players')
          .values(match.playerIds.map((playerId, position) => ({ match_id: id, player_id: playerId, position })))
          .execute();
      });
      return id;
    },

    async findMatch(id) {
      const row = await db.selectFrom('matches').selectAll().where('id', '=', id).executeTakeFirst();
      if (!row) {
        return null;
      }
      const players = await db
        .selectFrom('match_players')
        .innerJoin('players', 'players.id', 'match_players.player_id')
        .selectAll('players')
        .where('match_players.match_id', '=', id)
        .orderBy('match_players.position')
        .execute();
      return toMatch(row, players.map(toPlayer));
    },

    async loadLog(matchId) {
      const entries = await db
        .selectFrom('match_events')
        .select(['seq', 'type', 'throw_id'])
        .where('match_id', '=', matchId)
        .orderBy('seq')
        .execute();
      const throws = await db.selectFrom('throws').selectAll().where('match_id', '=', matchId).execute();
      return {
        entries: entries.map((entry) => ({ seq: entry.seq, type: entry.type, throwId: entry.throw_id })),
        throws: new Map(throws.map((row) => [row.id, toThrow(row)])),
      };
    },

    async findThrowByEventId(eventId) {
      const row = await db.selectFrom('throws').selectAll().where('event_id', '=', eventId).executeTakeFirst();
      return row ? toThrow(row) : null;
    },

    async appendThrow(hit) {
      const row = {
        id: randomUUID(),
        match_id: hit.matchId,
        event_id: hit.eventId,
        source: hit.source,
        sequence: hit.sequence,
        segment: hit.segment,
        multiplier: hit.multiplier,
        confidence: hit.confidence,
        detected_at: hit.detectedAt,
        received_at: now(),
      };
      const seq = await db.transaction().execute(async (trx) => {
        const seq = await nextSeq(trx, hit.matchId);
        await trx.insertInto('throws').values(row).execute();
        await trx
          .insertInto('match_events')
          .values({ match_id: hit.matchId, seq, type: 'throw', throw_id: row.id, created_at: row.received_at })
          .execute();
        return seq;
      });
      return { throw: toThrow(row), seq };
    },

    async appendUndo(matchId, throwId) {
      return db.transaction().execute(async (trx) => {
        const seq = await nextSeq(trx, matchId);
        await trx.insertInto('match_events').values({ match_id: matchId, seq, type: 'undo', throw_id: throwId, created_at: now() }).execute();
        return seq;
      });
    },
  };
}
