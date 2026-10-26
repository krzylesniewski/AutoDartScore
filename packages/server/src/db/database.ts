import { Kysely, SqliteDialect } from 'kysely';
import { nodeSqliteDatabase } from './node-sqlite.js';

// Wartości logiczne trzymamy jako integer 0/1, a daty jako tekst ISO, żeby schemat dał się przenieść na PostgreSQL.
export interface PlayersTable {
  id: string;
  name: string;
  avatar: string | null;
  color: number | null; // null: kolor z defaultPlayerColor(id)
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
  checkout_range: string | null; // tylko w treningu checkoutów
  checkout_seed: number | null; // tylko w treningu checkoutów, od 0 do MAX_CHECKOUT_SEED
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

export type MatchEventType =
  | 'throw'
  | 'undo'
  | 'match_abandoned'
  | 'match_resumed'
  | 'practice_ended'
  | 'checkout_attempt'
  | 'checkout_attempt_undone';

// Log gry: tylko dopisywanie. Stan meczu wynika z odtworzenia wpisów w kolejności seq.
// throw_id mają tylko throw i undo, player_id i reason tylko match_abandoned, success (0 albo 1) tylko checkout_attempt.
export interface MatchEventsTable {
  match_id: string;
  seq: number;
  type: MatchEventType;
  throw_id: string | null;
  player_id: string | null;
  reason: string | null;
  success: number | null;
  created_at: string;
}

// Zmiany profilu: tylko dopisywanie. Każdy wiersz to pełny profil po zmianie, a aktualny ma najwyższy seq.
export interface PlayerChangesTable {
  player_id: string;
  seq: number;
  name: string;
  avatar: string | null;
  color: number | null;
  guest: number;
  archived_at: string | null;
  created_at: string;
}

export interface Database {
  players: PlayersTable;
  player_changes: PlayerChangesTable;
  matches: MatchesTable;
  match_players: MatchPlayersTable;
  throws: ThrowsTable;
  match_events: MatchEventsTable;
}

export function openDatabase(path: string): Kysely<Database> {
  return new Kysely<Database>({ dialect: new SqliteDialect({ database: nodeSqliteDatabase(path) }) });
}
