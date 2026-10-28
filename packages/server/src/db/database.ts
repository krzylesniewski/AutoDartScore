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
  checkout_rule: string | null; // tylko w treningu checkoutów, CheckoutRule z silnika
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
  review: string | null; // HitReview jako JSON, tylko gdy trafienie je miało
}

export type MatchEventType =
  | 'throw'
  | 'undo'
  | 'match_abandoned'
  | 'match_resumed'
  | 'practice_ended'
  | 'checkout_attempt'
  | 'checkout_attempt_undone'
  | 'checkout_skipped'
  | 'checkout_skip_undone'
  | 'throw_flagged'
  | 'throw_verified';

// Log gry: tylko dopisywanie. Stan meczu wynika z odtworzenia wpisów w kolejności seq.
// throw_id mają throw, undo, throw_flagged i throw_verified. player_id ma tylko match_abandoned, a reason match_abandoned
// i throw_flagged. success (0 albo 1) ma tylko checkout_attempt. actor (system albo player) mają throw_flagged i throw_verified,
// a segment i multiplier (wartość po weryfikacji) tylko throw_verified.
// checkout_attempt_undone cofa ostatnią próbę, a checkout_skip_undone ostatnie pominięcie (checkout_skipped).
export interface MatchEventsTable {
  match_id: string;
  seq: number;
  type: MatchEventType;
  throw_id: string | null;
  player_id: string | null;
  reason: string | null;
  success: number | null;
  segment: number | null;
  multiplier: number | null;
  actor: string | null;
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

// Kalibracje kamer: tylko dopisywanie. Aktualna ma najwyższy seq. Punkty w kolejności CameraCalibration.
export interface CameraCalibrationsTable {
  camera_id: string;
  seq: number;
  image_width: number;
  image_height: number;
  p1_x: number;
  p1_y: number;
  p2_x: number;
  p2_y: number;
  p3_x: number;
  p3_y: number;
  p4_x: number;
  p4_y: number;
  created_at: string;
}

export interface Database {
  players: PlayersTable;
  player_changes: PlayerChangesTable;
  matches: MatchesTable;
  match_players: MatchPlayersTable;
  throws: ThrowsTable;
  match_events: MatchEventsTable;
  camera_calibrations: CameraCalibrationsTable;
}

export function openDatabase(path: string): Kysely<Database> {
  return new Kysely<Database>({ dialect: new SqliteDialect({ database: nodeSqliteDatabase(path) }) });
}
