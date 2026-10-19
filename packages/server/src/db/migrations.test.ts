import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { migrateTo, migrateToLatest, openDatabase } from './index.js';

describe('migrateToLatest', () => {
  it('creates the tables and is a no-op the second time', async () => {
    const db = openDatabase(':memory:');
    await migrateToLatest(db);
    await migrateToLatest(db);
    const tables = await db.introspection.getTables();
    expect(tables.map((table) => table.name).sort()).toEqual(['match_events', 'match_players', 'matches', 'player_changes', 'players', 'throws']);
    await db.destroy();
  });

  it('keeps the log written under 0001_initial', async () => {
    const db = openDatabase(':memory:');
    await migrateTo(db, '0001_initial');
    const createdAt = '2026-10-15T18:30:00.000Z';
    await db
      .insertInto('players')
      .values([
        { id: 'p1', name: 'Anna', avatar: null, guest: 0, created_at: createdAt },
        { id: 'p2', name: 'Bartek', avatar: null, guest: 0, created_at: createdAt },
      ])
      .execute();
    await db
      .insertInto('matches')
      .values({ id: 'm1', type: 'match', practice_mode: null, starting_score: 301, legs_to_win: 2, first_player_index: 0, counts_to_stats: 1, created_at: createdAt })
      .execute();
    await db
      .insertInto('match_players')
      .values([
        { match_id: 'm1', player_id: 'p1', position: 0 },
        { match_id: 'm1', player_id: 'p2', position: 1 },
      ])
      .execute();
    const dart = { match_id: 'm1', source: 'keypad', sequence: 0, confidence: 1, detected_at: createdAt, received_at: createdAt };
    await db
      .insertInto('throws')
      .values([
        { ...dart, id: 't1', event_id: '4b8e7a61-2c0f-4f5e-9d1a-6c3b2a1f0e9d', segment: 20, multiplier: 3 },
        { ...dart, id: 't2', event_id: '5c9f8b72-3d1a-4a6f-8e2b-7d4c3b2a1f0e', segment: 19, multiplier: 1 },
      ])
      .execute();
    await db
      .insertInto('match_events')
      .values([
        { match_id: 'm1', seq: 1, type: 'throw', throw_id: 't1', created_at: createdAt },
        { match_id: 'm1', seq: 2, type: 'throw', throw_id: 't2', created_at: createdAt },
        { match_id: 'm1', seq: 3, type: 'undo', throw_id: 't2', created_at: createdAt },
      ])
      .execute();

    await migrateToLatest(db);
    const rows = await db.selectFrom('match_events').selectAll().orderBy('seq').execute();
    expect(rows).toEqual([
      { match_id: 'm1', seq: 1, type: 'throw', throw_id: 't1', player_id: null, reason: null, created_at: createdAt },
      { match_id: 'm1', seq: 2, type: 'throw', throw_id: 't2', player_id: null, reason: null, created_at: createdAt },
      { match_id: 'm1', seq: 3, type: 'undo', throw_id: 't2', player_id: null, reason: null, created_at: createdAt },
    ]);

    const app = await buildApp({ db });
    try {
      const response = await app.inject({ method: 'GET', url: '/matches/m1' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ eventSeq: 3, status: 'in_progress', currentDarts: [{ segment: 20, multiplier: 3 }] });
      expect(response.json().players.map((player: { remaining: number }) => player.remaining)).toEqual([241, 301]);
    } finally {
      await app.close();
      await db.destroy();
    }
  });

  it('keeps the players created under 0002_match_lifecycle', async () => {
    const db = openDatabase(':memory:');
    await migrateTo(db, '0002_match_lifecycle');
    const createdAt = '2026-10-15T18:30:00.000Z';
    await db
      .insertInto('players')
      .values([
        { id: 'p1', name: 'Anna', avatar: '🎯', guest: 0, created_at: createdAt },
        { id: 'p2', name: 'Bartek', avatar: null, guest: 0, created_at: createdAt },
      ])
      .execute();

    await migrateToLatest(db);
    const app = await buildApp({ db });
    try {
      const response = await app.inject({ method: 'GET', url: '/players' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        { id: 'p1', name: 'Anna', avatar: '🎯', guest: false, archivedAt: null, createdAt },
        { id: 'p2', name: 'Bartek', avatar: null, guest: false, archivedAt: null, createdAt },
      ]);
    } finally {
      await app.close();
      await db.destroy();
    }
  });
});
