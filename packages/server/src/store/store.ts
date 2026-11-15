import { randomUUID } from 'node:crypto';
import type { Insertable, Kysely, Selectable } from 'kysely';
import type { CheckoutRule } from '@autoscore/engine';
import type { CheckoutRange, CreatePlayerRequest, MatchType, Player, PracticeMode, ThrowRecord, UpdatePlayerRequest } from '@autoscore/schema';
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
  readonly checkoutRange: CheckoutRange | null;
  readonly checkoutSeed: number | null; // nie wychodzi poza serwer
  readonly checkoutRule: CheckoutRule | null; // nie wychodzi poza serwer
  readonly createdAt: string;
  readonly players: readonly Player[]; // w kolejności position
}

export type NewMatch = Omit<StoredMatch, 'id' | 'createdAt' | 'players'> & { readonly playerIds: readonly string[] };

export type LogEntry =
  | { readonly seq: number; readonly type: 'throw' | 'undo'; readonly throwId: string; readonly createdAt: string }
  | { readonly seq: number; readonly type: 'match_abandoned'; readonly playerId: string; readonly reason: string | null; readonly createdAt: string }
  | { readonly seq: number; readonly type: 'match_resumed' | 'practice_ended'; readonly createdAt: string }
  | { readonly seq: number; readonly type: 'checkout_attempt'; readonly success: boolean; readonly createdAt: string }
  | { readonly seq: number; readonly type: 'checkout_attempt_undone' | 'checkout_skipped' | 'checkout_skip_undone'; readonly createdAt: string };

export interface MatchLog {
  readonly entries: readonly LogEntry[];
  readonly throws: ReadonlyMap<string, ThrowRecord>;
}

export type NewThrow = Omit<ThrowRecord, 'id' | 'receivedAt'>;

export interface MatchFilter {
  readonly createdFrom?: string | null | undefined;
  readonly types?: readonly MatchType[] | undefined;
  readonly playerId?: string | undefined;
  readonly countsToStats?: boolean | undefined;
}

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
  // Gry w kolejności utworzenia. Gry gracza, które wchodzą do statystyk, to filtr z playerId, types i countsToStats: true.
  // createdFrom to najstarsze dozwolone created_at (ISO, włącznie). null albo brak znaczy bez dolnej granicy.
  listMatches(filter?: MatchFilter): Promise<StoredMatch[]>;
  loadLog(matchId: string): Promise<MatchLog>;
  // Najwyższy seq w logu każdej gry, 0 dla gry bez wpisów.
  lastSeqs(matchIds: readonly string[]): Promise<Map<string, number>>;
  // Uszkodzony wpis zamienia w Error tylko log swojej gry.
  loadLogs(matchIds: readonly string[]): Promise<Map<string, MatchLog | Error>>;
  findThrowByEventId(eventId: string): Promise<ThrowRecord | null>;
  appendThrow(hit: NewThrow): Promise<{ throw: ThrowRecord; seq: number }>;
  // Wszystkie rzutki albo żadna, z kolejnymi seq w kolejności hits.
  appendThrows(hits: readonly NewThrow[]): Promise<{ throws: ThrowRecord[]; seqs: number[] }>;
  appendUndo(matchId: string, throwId: string): Promise<number>;
  appendAbandon(matchId: string, playerId: string, reason: string | null): Promise<number>;
  appendResume(matchId: string): Promise<number>;
  appendPracticeEnd(matchId: string): Promise<number>;
  appendCheckoutAttempt(matchId: string, success: boolean): Promise<number>;
  appendCheckoutUndo(matchId: string): Promise<number>;
  appendCheckoutSkip(matchId: string): Promise<number>;
  appendCheckoutSkipUndo(matchId: string): Promise<number>;
}

// Najwyżej tyle wartości w jednym in (...), żeby zapytanie mieściło się w limicie parametrów SQLite i PostgreSQL.
const IN_LIST_CHUNK = 500;

function chunks<T>(values: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < values.length; start += IN_LIST_CHUNK) {
    result.push(values.slice(start, start + IN_LIST_CHUNK));
  }
  return result;
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
    checkoutRange: row.checkout_range as CheckoutRange | null,
    checkoutSeed: row.checkout_seed,
    checkoutRule: row.checkout_rule as CheckoutRule | null,
    createdAt: row.created_at,
    players,
  };
}

const LOG_COLUMNS = ['seq', 'type', 'throw_id', 'player_id', 'reason', 'success', 'created_at'] as const;

function toLogEntry(row: Pick<Selectable<MatchEventsTable>, (typeof LOG_COLUMNS)[number]>): LogEntry {
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
    case 'checkout_attempt_undone':
    case 'checkout_skipped':
    case 'checkout_skip_undone':
      return { seq, type, createdAt };
    case 'checkout_attempt':
      if (row.success === null) {
        throw new Error(`Corrupt log: checkout_attempt at seq ${seq} has no success`);
      }
      return { seq, type, success: row.success === 1, createdAt };
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

  // Ostatnia zmiana każdego z graczy, bez czytania całej historii. Bez ids dla wszystkich graczy.
  async function latestChanges(trx: Kysely<Database>, ids?: readonly string[]): Promise<Map<string, PlayerChange>> {
    async function latest(chunk?: string[]): Promise<PlayerChange[]> {
      let maxSeq = trx
        .selectFrom('player_changes')
        .select('player_id')
        .select((eb) => eb.fn.max('seq').as('seq'))
        .groupBy('player_id');
      if (chunk) {
        maxSeq = maxSeq.where('player_id', 'in', chunk);
      }
      return trx
        .selectFrom('player_changes')
        .innerJoin(maxSeq.as('latest'), (join) =>
          join.onRef('latest.player_id', '=', 'player_changes.player_id').onRef('latest.seq', '=', 'player_changes.seq'),
        )
        .selectAll('player_changes')
        .execute();
    }
    const rows = [];
    if (ids) {
      for (const chunk of chunks([...new Set(ids)])) {
        rows.push(...(await latest(chunk)));
      }
    } else {
      rows.push(...(await latest()));
    }
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

  // Gracze każdej z gier w kolejności position, z jednym odczytem profili dla wszystkich.
  async function matchPlayers(matchIds: readonly string[]): Promise<Map<string, Player[]>> {
    const rows = [];
    for (const chunk of chunks(matchIds)) {
      rows.push(
        ...(await db
          .selectFrom('match_players')
          .innerJoin('players', 'players.id', 'match_players.player_id')
          .selectAll('players')
          .select('match_players.match_id')
          .where('match_players.match_id', 'in', chunk)
          .orderBy('match_players.match_id')
          .orderBy('match_players.position')
          .execute()),
      );
    }
    const changes = await latestChanges(db, rows.map((row) => row.id));
    const players = new Map<string, Player[]>();
    for (const row of rows) {
      const list = players.get(row.match_id) ?? [];
      list.push(toPlayer(row, changes.get(row.id)));
      players.set(row.match_id, list);
    }
    return players;
  }

  function appendLifecycle(matchId: string, entry: Pick<Insertable<MatchEventsTable>, 'type' | 'player_id' | 'reason' | 'success'>): Promise<number> {
    return db.transaction().execute(async (trx) => {
      const seq = await nextSeq(trx, matchId);
      await trx.insertInto('match_events').values({ match_id: matchId, seq, ...entry, created_at: now() }).execute();
      return seq;
    });
  }

  async function appendThrows(hits: readonly NewThrow[]): Promise<{ throws: ThrowRecord[]; seqs: number[] }> {
    const receivedAt = now();
    const rows = hits.map((hit) => ({
      id: randomUUID(),
      match_id: hit.matchId,
      event_id: hit.eventId,
      source: hit.source,
      sequence: hit.sequence,
      segment: hit.segment,
      multiplier: hit.multiplier,
      confidence: hit.confidence,
      detected_at: hit.detectedAt,
      received_at: receivedAt,
    }));
    const seqs = await db.transaction().execute(async (trx) => {
      const seqs: number[] = [];
      for (const row of rows) {
        const seq = await nextSeq(trx, row.match_id);
        await trx.insertInto('throws').values(row).execute();
        await trx.insertInto('match_events').values({ match_id: row.match_id, seq, type: 'throw', throw_id: row.id, created_at: receivedAt }).execute();
        seqs.push(seq);
      }
      return seqs;
    });
    return { throws: rows.map(toThrow), seqs };
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
            checkout_range: match.checkoutRange,
            checkout_seed: match.checkoutSeed,
            checkout_rule: match.checkoutRule,
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
      return row ? toMatch(row, (await matchPlayers([id])).get(id) ?? []) : null;
    },

    async listMatches(filter = {}) {
      const { createdFrom, types, playerId, countsToStats } = filter;
      if (types?.length === 0) {
        return [];
      }
      let query = db.selectFrom('matches').selectAll();
      if (createdFrom !== undefined && createdFrom !== null) {
        query = query.where('created_at', '>=', createdFrom);
      }
      if (types !== undefined) {
        query = query.where('type', 'in', [...types]);
      }
      if (countsToStats !== undefined) {
        query = query.where('counts_to_stats', '=', countsToStats ? 1 : 0);
      }
      if (playerId !== undefined) {
        // exists zamiast złączenia, żeby gra nigdy nie pojawiła się dwa razy.
        query = query.where((eb) =>
          eb.exists(
            eb
              .selectFrom('match_players')
              .select('match_players.match_id')
              .whereRef('match_players.match_id', '=', 'matches.id')
              .where('match_players.player_id', '=', playerId),
          ),
        );
      }
      const rows = await query.orderBy('created_at').orderBy('id').execute();
      const players = await matchPlayers(rows.map((row) => row.id));
      return rows.map((row) => toMatch(row, players.get(row.id) ?? []));
    },

    async lastSeqs(matchIds) {
      const seqs = new Map(matchIds.map((id) => [id, 0]));
      for (const chunk of chunks([...seqs.keys()])) {
        const rows = await db
          .selectFrom('match_events')
          .select('match_id')
          .select((eb) => eb.fn.max('seq').as('seq'))
          .where('match_id', 'in', chunk)
          .groupBy('match_id')
          .execute();
        for (const row of rows) {
          seqs.set(row.match_id, Number(row.seq));
        }
      }
      return seqs;
    },

    async loadLogs(matchIds) {
      const logs = new Map<string, { entries: LogEntry[]; throws: Map<string, ThrowRecord> } | Error>(
        matchIds.map((id) => [id, { entries: [], throws: new Map() }]),
      );
      for (const chunk of chunks([...logs.keys()])) {
        const entries = await db
          .selectFrom('match_events')
          .select(['match_id', ...LOG_COLUMNS])
          .where('match_id', 'in', chunk)
          .orderBy('match_id')
          .orderBy('seq')
          .execute();
        const throws = await db.selectFrom('throws').selectAll().where('match_id', 'in', chunk).execute();
        for (const row of entries) {
          const log = logs.get(row.match_id);
          if (log === undefined || log instanceof Error) {
            continue;
          }
          try {
            log.entries.push(toLogEntry(row));
          } catch (error) {
            logs.set(row.match_id, error instanceof Error ? error : new Error(String(error)));
          }
        }
        for (const row of throws) {
          const log = logs.get(row.match_id);
          if (log !== undefined && !(log instanceof Error)) {
            log.throws.set(row.id, toThrow(row));
          }
        }
      }
      return logs;
    },

    async loadLog(matchId) {
      const entries = await db
        .selectFrom('match_events')
        .select(LOG_COLUMNS)
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
      const { throws, seqs } = await appendThrows([hit]);
      const [record] = throws;
      const [seq] = seqs;
      if (record === undefined || seq === undefined) {
        throw new Error('appendThrows returned no throw');
      }
      return { throw: record, seq };
    },

    appendThrows,

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

    appendCheckoutAttempt(matchId, success) {
      return appendLifecycle(matchId, { type: 'checkout_attempt', success: success ? 1 : 0 });
    },

    appendCheckoutUndo(matchId) {
      return appendLifecycle(matchId, { type: 'checkout_attempt_undone' });
    },

    appendCheckoutSkip(matchId) {
      return appendLifecycle(matchId, { type: 'checkout_skipped' });
    },

    appendCheckoutSkipUndo(matchId) {
      return appendLifecycle(matchId, { type: 'checkout_skip_undone' });
    },
  };
}
