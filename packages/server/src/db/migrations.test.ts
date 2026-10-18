import { describe, expect, it } from 'vitest';
import { migrateToLatest, openDatabase } from './index.js';

describe('migrateToLatest', () => {
  it('creates the tables and is a no-op the second time', async () => {
    const db = openDatabase(':memory:');
    await migrateToLatest(db);
    await migrateToLatest(db);
    const tables = await db.introspection.getTables();
    expect(tables.map((table) => table.name).sort()).toEqual(['match_events', 'match_players', 'matches', 'players', 'throws']);
    await db.destroy();
  });
});
