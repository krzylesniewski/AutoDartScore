import { randomUUID } from 'node:crypto';
import type { Insertable, Kysely, Selectable } from 'kysely';
import type { CreatePlayerRequest, MatchType, Player, PracticeMode, ThrowRecord, UpdatePlayerRequest } from '@autoscore/schema';
import type { Database, MatchEventsTable, MatchesTable, PlayerChangesTable, PlayersTable, ThrowsTable } from '../db/database.js';
import { playerNameTaken } from '../errors.js';
import { defaultPlayerColor } from './player-color.js';
import { normalizePlayerName } from './player-name.js';

// Jedyny moduł, który dotyka Kysely. Tylko wstawia i czyta: nic nie jest nadpisywane ani usuwane.
// Gracz to wiersz players z nałożoną ostatnią zmianą z player_changes, więc każdy odczyt widzi aktualny profil.

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

export type LogEntry =
  | { readonly seq: number; readonly type: 'throw' | 'undo'; readonly throwId: string; readonly createdAt: string }
  | { readonly seq: number; readonly type: 'match_abandoned'; readonly playerId: string; readonly reason: string | null; readonly createdAt: string }
  | { readonly seq: number; readonly type: 'match_resumed' | 'practice_ended'; readonly createdAt: string };

export interface MatchLog {
  readonly entries: readonly LogEntry[];
  readonly throws: ReadonlyMap<string, ThrowRecord>;
}

export type NewThrow = Omit<ThrowRecord, 'id' | 'receivedAt'>;

export interface Store {
  createPlayer(request: CreatePlayerRequest): Promise<Player>;
  // Bez gości, od ostatnio aktywnego. Gracze bez gier na końcu. Zarchiwizowani tylko z includeArchived.
  listPlayers(options: { readonly includeArchived: boolean }): Promise<Player[]>;
  findPlayers(ids: readonly string[]): Promise<Player[]>;
  // null dla nieznanego gracza.
  // createPlayer i updatePlayer odrzucają imię zajęte przez innego aktywnego, zapisanego gracza.
  updatePlayer(id: string, request: UpdatePlayerRequest): Promise<Player | null>;
  createMatch(match: NewMatch): Promise<string>;
  findMatch(id: string): Promise<StoredMatch | null>;
  // Gry gracza, które wchodzą do statystyk, w kolejności utworzenia.
  findMatchIdsForPlayer(playerId: string, types: readonly MatchType[]): Promise<string[]>;
  listMatches(): Promise<StoredMatch[]>;
  loadLog(matchId: string): Promise<MatchLog>;
  findThrowByEventId(eventId: string): Promise<ThrowRecord | null>;
  appendThrow(hit: NewThrow): Promise<{ throw: ThrowRecord; seq: number }>;
  appendUndo(matchId: string, throwId: string): Promise<number>;
  appendAbandon(matchId: string, playerId: string, reason: string | null): Promise<number>;
  appendResume(matchId: string): Promise<number>;
  appendPracticeEnd(matchId: string): Promise<number>;
}

function now(): string {
  return new Date().toISOString();
}

type PlayerRow = Pick<Selectable<PlayersTable>, 'id' | 'name' | 'avatar' | 'color' | 'guest' | 'created_at'>;
type PlayerChange = Selectable<PlayerChangesTable>;

// createdAt zawsze z players, reszta z ostatniej zmiany, jeśli jakaś jest. Bez zapisanego koloru kolor wynika z id.
function toPlayer(row: PlayerRow, change: PlayerChange | undefined): Player {
  const current = change ?? { ...row, archived_at: null };
  return {
    id: row.id,
    name: current.name,
    avatar: current.avatar,
    color: current.color ?? defaultPlayerColor(row.id),
    guest: current.guest === 1,
    archivedAt: current.archived_at,
    createdAt: row.created_at,
  };
}

// Daty ISO w UTC porównują się jak tekst.
function later(a: string | null, b: string | null): string | null {
  if (a === null) {
    return b;
  }
  return b === null || a > b ? a : b;
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

function toLogEntry(row: Pick<Selectable<MatchEventsTable>, 'seq' | 'type' | 'throw_id' | 'player_id' | 'reason' | 'created_at'>): LogEntry {
  const { seq, type, created_at: createdAt } = row;
  switch (type) {
    case 'throw':
    case 'undo':
      if (row.throw_id === null) {
        throw new Error(`Corrupt log: ${type} at seq ${seq} has no throw_id`);
      }
      return { seq, type, throwId: row.throw_id, createdAt };
    case 'match_abandoned':
      if (row.player_id === null) {
        throw new Error(`Corrupt log: match_abandoned at seq ${seq} has no player_id`);
      }
      return { seq, type, playerId: row.player_id, reason: row.reason, createdAt };
    case 'match_resumed':
    case 'practice_ended':
      return { seq, type, createdAt };
  }
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

  // Ostatnia zmiana każdego z graczy. Bez ids dla wszystkich graczy.
  async function latestChanges(trx: Kysely<Database>, ids?: readonly string[]): Promise<Map<string, PlayerChange>> {
    if (ids?.length === 0) {
      return new Map();
    }
    let query = trx.selectFrom('player_changes').selectAll().orderBy('player_id').orderBy('seq');
    if (ids) {
      query = query.where('player_id', 'in', [...ids]);
    }
    const rows = await query.execute();
    return new Map(rows.map((row) => [row.player_id, row]));
  }

  // Porównuje z aktualnymi profilami, bo imię, gość i archiwizacja mogły się zmienić w player_changes.
  async function nameTaken(trx: Kysely<Database>, name: string, excludeId?: string): Promise<boolean> {
    const rows = await trx.selectFrom('players').selectAll().execute();
    const changes = await latestChanges(trx);
    const normalized = normalizePlayerName(name);
    return rows.some((row) => {
      if (row.id === excludeId) {
        return false;
      }
      const player = toPlayer(row, changes.get(row.id));
      return !player.guest && player.archivedAt === null && normalizePlayerName(player.name) === normalized;
    });
  }

  async function withProfiles(rows: readonly PlayerRow[]): Promise<Player[]> {
    const changes = await latestChanges(db, rows.map((row) => row.id));
    return rows.map((row) => toPlayer(row, changes.get(row.id)));
  }

  async function matchPlayers(matchId: string): Promise<Player[]> {
    const rows = await db
      .selectFrom('match_players')
      .innerJoin('players', 'players.id', 'match_players.player_id')
      .selectAll('players')
      .where('match_players.match_id', '=', matchId)
      .orderBy('match_players.position')
      .execute();
    return withProfiles(rows);
  }

  function appendLifecycle(matchId: string, entry: Pick<Insertable<MatchEventsTable>, 'type' | 'player_id' | 'reason'>): Promise<number> {
    return db.transaction().execute(async (trx) => {
      const seq = await nextSeq(trx, matchId);
      await trx.insertInto('match_events').values({ match_id: matchId, seq, ...entry, created_at: now() }).execute();
      return seq;
    });
  }

  return {
    // SQLite wykonuje transakcje po kolei na jednym połączeniu, więc sprawdzenie i zapis się nie przeplatają.
    async createPlayer(request) {
      return db.transaction().execute(async (trx) => {
        if (!request.guest && (await nameTaken(trx, request.name))) {
          throw playerNameTaken(request.name);
        }
        const row = {
          id: randomUUID(),
          name: request.name,
          avatar: request.avatar ?? null,
          color: request.color ?? null,
          guest: request.guest ? 1 : 0,
          created_at: now(),
        };
        await trx.insertInto('players').values(row).execute();
        return toPlayer(row, undefined);
      });
    },

    // Ostatnia aktywność to najnowszy wpis w logu albo utworzenie gry gracza. Sortowanie w TS, bo NULL-e
    // trafiają na początek albo koniec zależnie od silnika bazy. Filtry też w TS, bo dotyczą aktualnego profilu:
    // zapisany gość ma guest = 1 w players.
    async listPlayers({ includeArchived }) {
      const rows = await db
        .selectFrom('players')
        .leftJoin('match_players', 'match_players.player_id', 'players.id')
        .leftJoin('matches', 'matches.id', 'match_players.match_id')
        .leftJoin('match_events', 'match_events.match_id', 'matches.id')
        .select(['players.id', 'players.name', 'players.avatar', 'players.color', 'players.guest', 'players.created_at'])
        .select((eb) => [eb.fn.max('match_events.created_at').as('last_event_at'), eb.fn.max('matches.created_at').as('last_match_at')])
        .groupBy(['players.id', 'players.name', 'players.avatar', 'players.color', 'players.guest', 'players.created_at'])
        .execute();
      const changes = await latestChanges(db);
      return rows
        .map((row) => ({ player: toPlayer(row, changes.get(row.id)), at: later(row.last_event_at, row.last_match_at) }))
        .filter(({ player }) => !player.guest && (includeArchived || player.archivedAt === null))
        .sort((a, b) => {
          if (a.at !== b.at) {
            return a.at === null ? 1 : b.at === null ? -1 : b.at.localeCompare(a.at);
          }
          return a.player.name.localeCompare(b.player.name, 'pl') || a.player.id.localeCompare(b.player.id);
        })
        .map((entry) => entry.player);
    },

    async findPlayers(ids) {
      if (ids.length === 0) {
        return [];
      }
      const rows = await db.selectFrom('players').selectAll().where('id', 'in', [...ids]).execute();
      return withProfiles(rows);
    },

    // Każda zmiana dopisuje pełny profil z kolejnym seq. Ponowna archiwizacja zachowuje pierwotny czas.
    async updatePlayer(id, request) {
      return db.transaction().execute(async (trx) => {
        const row = await trx.selectFrom('players').selectAll().where('id', '=', id).executeTakeFirst();
        if (!row) {
          return null;
        }
        const last = (await latestChanges(trx, [id])).get(id);
        const current = toPlayer(row, last);
        const at = now();
        let archivedAt = current.archivedAt;
        if (request.archived !== undefined) {
          archivedAt = request.archived ? (current.archivedAt ?? at) : null;
        }
        const change: PlayerChange = {
          player_id: id,
          seq: (last?.seq ?? 0) + 1,
          name: request.name ?? current.name,
          avatar: request.avatar === undefined ? current.avatar : request.avatar,
          color: request.color ?? current.color,
          guest: request.guest === false ? 0 : current.guest ? 1 : 0,
          archived_at: archivedAt,
          created_at: at,
        };
        // Sprawdzamy tylko zmiany, które mogą utworzyć nowy duplikat. Dawne duplikaty zostają w danych
        // i da się je dalej edytować, np. zmienić kolor albo wysłać to samo imię.
        const active = change.guest === 0 && change.archived_at === null;
        const couldCollide =
          normalizePlayerName(change.name) !== normalizePlayerName(current.name) || current.guest || current.archivedAt !== null;
        if (active && couldCollide && (await nameTaken(trx, change.name, id))) {
          throw playerNameTaken(change.name);
        }
        await trx.insertInto('player_changes').values(change).execute();
        return toPlayer(row, change);
      });
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
      return row ? toMatch(row, await matchPlayers(id)) : null;
    },

    async listMatches() {
      const rows = await db.selectFrom('matches').selectAll().orderBy('created_at').orderBy('id').execute();
      const matches = [];
      for (const row of rows) {
        matches.push(toMatch(row, await matchPlayers(row.id)));
      }
      return matches;
    },

    async findMatchIdsForPlayer(playerId, types) {
      if (types.length === 0) {
        return [];
      }
      const rows = await db
        .selectFrom('matches')
        .innerJoin('match_players', 'match_players.match_id', 'matches.id')
        .select('matches.id')
        .where('match_players.player_id', '=', playerId)
        .where('matches.counts_to_stats', '=', 1)
        .where('matches.type', 'in', [...types])
        .orderBy('matches.created_at')
        .orderBy('matches.id')
        .execute();
      return rows.map((row) => row.id);
    },

    async loadLog(matchId) {
      const entries = await db
        .selectFrom('match_events')
        .select(['seq', 'type', 'throw_id', 'player_id', 'reason', 'created_at'])
        .where('match_id', '=', matchId)
        .orderBy('seq')
        .execute();
      const throws = await db.selectFrom('throws').selectAll().where('match_id', '=', matchId).execute();
      return {
        entries: entries.map(toLogEntry),
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

    appendAbandon(matchId, playerId, reason) {
      return appendLifecycle(matchId, { type: 'match_abandoned', player_id: playerId, reason });
    },

    appendResume(matchId) {
      return appendLifecycle(matchId, { type: 'match_resumed' });
    },

    appendPracticeEnd(matchId) {
      return appendLifecycle(matchId, { type: 'practice_ended' });
    },
  };
}
