import { Kysely, SqliteDialect } from 'kysely';
import { nodeSqliteDatabase } from './node-sqlite.js';

// Wartości logiczne trzymamy jako integer 0/1, a daty jako tekst ISO, żeby schemat dał się przenieść na PostgreSQL.
export interface PlayersTable {
  id: string;
  name: string;
  avatar: string | null;
  guest: number;
  created_at: string;
}

export interface MatchesTable {
  id: string;
  type: string;
  practice_mode: string | null;
  starting_score: number | null;
  legs_to_win: number | null;
  first_player_index: number | null;
  counts_to_stats: number;
  created_at: string;
}

export interface MatchPlayersTable {
  match_id: string;
  player_id: string;
  position: number;
}

export interface ThrowsTable {
  id: string;
  match_id: string;
  event_id: string;
  source: string;
  sequence: number;
  segment: number;
  multiplier: number;
  confidence: number;
  detected_at: string;
  received_at: string;
}

export type MatchEventType = 'throw' | 'undo' | 'match_abandoned' | 'match_resumed' | 'practice_ended';

// Log gry: tylko dopisywanie. Stan meczu wynika z odtworzenia wpisów w kolejności seq.
// throw_id mają tylko throw i undo, player_id i reason tylko match_abandoned.
export interface MatchEventsTable {
  match_id: string;
  seq: number;
  type: MatchEventType;
  throw_id: string | null;
  player_id: string | null;
  reason: string | null;
  created_at: string;
}

export interface Database {
  players: PlayersTable;
  matches: MatchesTable;
  match_players: MatchPlayersTable;
  throws: ThrowsTable;
  match_events: MatchEventsTable;
}

export function openDatabase(path: string): Kysely<Database> {
  return new Kysely<Database>({ dialect: new SqliteDialect({ database: nodeSqliteDatabase(path) }) });
}
