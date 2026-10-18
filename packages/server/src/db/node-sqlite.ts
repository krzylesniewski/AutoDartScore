import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqliteDatabase } from 'kysely';

// Kysely nie ma dialektu dla wbudowanego node:sqlite, ale SqliteDialect przyjmuje każdy obiekt o tym kształcie.
export function nodeSqliteDatabase(path: string): SqliteDatabase {
  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys = ON');
  return {
    close: () => database.close(),
    prepare(sql) {
      const statement = database.prepare(sql);
      return {
        reader: statement.columns().length > 0,
        all: (parameters) => statement.all(...(parameters as SQLInputValue[])),
        run: (parameters) => statement.run(...(parameters as SQLInputValue[])),
        iterate: (parameters) => statement.iterate(...(parameters as SQLInputValue[])),
      };
    },
  };
}
