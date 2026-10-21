import type { Kysely } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';

// Kształt starej tabeli match_events, z której kopiujemy wiersze. Typ Database opisuje już tabelę po migracji.
interface LifecycleMigrationTables {
  match_events: { match_id: string; seq: number; type: string; throw_id: string | null; created_at: string };
  match_events_next: { match_id: string; seq: number; type: string; throw_id: string | null; player_id: string | null; reason: string | null; created_at: string };
}

// Przebudowa tabeli zamiast ALTER COLUMN, bo SQLite nie umie zdjąć NOT NULL z kolumny.
async function rebuildMatchEvents(db: Kysely<LifecycleMigrationTables>): Promise<void> {
  await db.schema
    .createTable('match_events_next')
    .addColumn('match_id', 'text', (col) => col.notNull().references('matches.id'))
    .addColumn('seq', 'integer', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('throw_id', 'text', (col) => col.references('throws.id'))
    .addColumn('player_id', 'text', (col) => col.references('players.id'))
    .addColumn('reason', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull())
    // Na PostgreSQL nazwy indeksów ograniczeń są wspólne dla schematu, a match_events_pk jeszcze istnieje.
    .addPrimaryKeyConstraint('match_events_log_pk', ['match_id', 'seq'])
    .execute();
  await db
    .insertInto('match_events_next')
    .columns(['match_id', 'seq', 'type', 'throw_id', 'created_at'])
    .expression(db.selectFrom('match_events').select(['match_id', 'seq', 'type', 'throw_id', 'created_at']))
    .execute();
  await db.schema.dropTable('match_events').execute();
  await db.schema.alterTable('match_events_next').renameTo('match_events').execute();
}

// Tylko typy text, integer i real oraz brak funkcji JSON, żeby migracje działały też na PostgreSQL.
const migrations: Record<string, Migration> = {
  '0001_initial': {
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable('players')
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('avatar', 'text')
        .addColumn('guest', 'integer', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .execute();

      await db.schema
        .createTable('matches')
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('type', 'text', (col) => col.notNull())
        .addColumn('practice_mode', 'text')
        .addColumn('starting_score', 'integer')
        .addColumn('legs_to_win', 'integer')
        .addColumn('first_player_index', 'integer')
        .addColumn('counts_to_stats', 'integer', (col) => col.notNull())
        .addColumn('created_at', 'text', (col) => col.notNull())
        .execute();

      await db.schema
        .createTable('match_players')
        .addColumn('match_id', 'text', (col) => col.notNull().references('matches.id'))
        .addColumn('player_id', 'text', (col) => col.notNull().references('players.id'))
        .addColumn('position', 'integer', (col) => col.notNull())
        .addPrimaryKeyConstraint('match_players_pk', ['match_id', 'position'])
        .execute();

      await db.schema
        .createTable('throws')
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('match_id', 'text', (col) => col.notNull().references('matches.id'))
        .addColumn('event_id', 'text', (col) => col.notNull().unique())
        .addColumn('source', 'text', (col) => col.notNull())
        .addColumn('sequence', 'integer', (col) => col.notNull())
        .addColumn('segment', 'integer', (col) => col.notNull())
        .addColumn('multiplier', 'integer', (col) => col.notNull())
        .addColumn('confidence', 'real', (col) => col.notNull())
        .addColumn('detected_at', 'text', (col) => col.notNull())
        .addColumn('received_at', 'text', (col) => col.notNull())
        .execute();

      await db.schema
        .createTable('match_events')
        .addColumn('match_id', 'text', (col) => col.notNull().references('matches.id'))
        .addColumn('seq', 'integer', (col) => col.notNull())
        .addColumn('type', 'text', (col) => col.notNull())
        .addColumn('throw_id', 'text', (col) => col.notNull().references('throws.id'))
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addPrimaryKeyConstraint('match_events_pk', ['match_id', 'seq'])
        .execute();
    },
  },
  '0002_match_lifecycle': {
    async up(db: Kysely<unknown>) {
      const typed = db as Kysely<LifecycleMigrationTables>;
      // Migrator SQLite nie otwiera transakcji, a przerwana przebudowa nie może zostawić logu bez tabeli.
      // PostgreSQL przekazuje już transakcję.
      if (typed.isTransaction) {
        await rebuildMatchEvents(typed);
        return;
      }
      await typed.transaction().execute(rebuildMatchEvents);
    },
  },
  // Wiersz players zostaje taki, jak przy utworzeniu gracza. Zmiany profilu są dopisywane tutaj.
  '0003_player_changes': {
    async up(db: Kysely<unknown>) {
      await db.schema
        .createTable('player_changes')
        .addColumn('player_id', 'text', (col) => col.notNull().references('players.id'))
        .addColumn('seq', 'integer', (col) => col.notNull())
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('avatar', 'text')
        .addColumn('guest', 'integer', (col) => col.notNull())
        .addColumn('archived_at', 'text')
        .addColumn('created_at', 'text', (col) => col.notNull())
        .addPrimaryKeyConstraint('player_changes_pk', ['player_id', 'seq'])
        .execute();
    },
  },
  // Bez koloru (null) serwer pokazuje kolor wyliczony z id. SQLite dodaje jedną kolumnę na polecenie.
  '0004_player_color': {
    async up(db: Kysely<unknown>) {
      await db.schema.alterTable('players').addColumn('color', 'integer').execute();
      await db.schema.alterTable('player_changes').addColumn('color', 'integer').execute();
    },
  },
};

const provider: MigrationProvider = {
  getMigrations: async () => migrations,
};

export async function migrateToLatest<DB>(db: Kysely<DB>): Promise<void> {
  const { error } = await new Migrator({ db, provider }).migrateToLatest();
  if (error) {
    throw error;
  }
}

export async function migrateTo<DB>(db: Kysely<DB>, target: string): Promise<void> {
  const { error } = await new Migrator({ db, provider }).migrateTo(target);
  if (error) {
    throw error;
  }
}
