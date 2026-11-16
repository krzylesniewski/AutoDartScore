import { checkoutTarget } from '@autoscore/engine';
import type { MatchSnapshot } from '@autoscore/schema';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { defaultPlayerColor } from '../store/player-color.js';
import { LEG_301 } from '../test-helpers.js';
import { migrateTo, migrateToLatest, openDatabase } from './index.js';

describe('migrateToLatest', () => {
  it('creates the tables and is a no-op the second time', async () => {
    const db = openDatabase(':memory:');
    await migrateToLatest(db);
    await migrateToLatest(db);
    const tables = await db.introspection.getTables();
    expect(tables.map((table) => table.name).sort()).toEqual([
      'match_events',
      'match_players',
      'matches',
      'player_changes',
      'players',
      'throws',
    ]);
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
      .values({
        id: 'm1',
        type: 'match',
        practice_mode: null,
        starting_score: 301,
        legs_to_win: 2,
        first_player_index: 0,
        counts_to_stats: 1,
        created_at: createdAt,
      })
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
      { match_id: 'm1', seq: 1, type: 'throw', throw_id: 't1', player_id: null, reason: null, success: null, created_at: createdAt },
      { match_id: 'm1', seq: 2, type: 'throw', throw_id: 't2', player_id: null, reason: null, success: null, created_at: createdAt },
      { match_id: 'm1', seq: 3, type: 'undo', throw_id: 't2', player_id: null, reason: null, success: null, created_at: createdAt },
    ]);

    const app = await buildApp({ db, auth: null });
    try {
      const response = await app.inject({ method: 'GET', url: '/matches/m1' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ eventSeq: 3, status: 'in_progress', currentDarts: [{ segment: 20, multiplier: 3 }] });
      expect(response.json<MatchSnapshot>().players.map((player) => player.remaining)).toEqual([241, 301]);
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
    const app = await buildApp({ db, auth: null });
    try {
      const response = await app.inject({ method: 'GET', url: '/players' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        { id: 'p1', name: 'Anna', avatar: '🎯', color: 2, guest: false, archivedAt: null, createdAt },
        { id: 'p2', name: 'Bartek', avatar: null, color: 3, guest: false, archivedAt: null, createdAt },
      ]);
    } finally {
      await app.close();
      await db.destroy();
    }
  });

  it('reads the games written under 0004_player_color without checkouts', async () => {
    const db = openDatabase(':memory:');
    await migrateTo(db, '0004_player_color');
    const createdAt = '2026-10-15T18:30:00.000Z';
    await db
      .insertInto('players')
      .values([
        { id: 'p1', name: 'Anna', avatar: null, color: 1, guest: 0, created_at: createdAt },
        { id: 'p2', name: 'Bartek', avatar: null, color: 2, guest: 0, created_at: createdAt },
      ])
      .execute();
    await db
      .insertInto('matches')
      .values([
        {
          id: 'm1',
          type: 'match',
          practice_mode: null,
          starting_score: 301,
          legs_to_win: 1,
          first_player_index: 0,
          counts_to_stats: 1,
          created_at: createdAt,
        },
        {
          id: 'f1',
          type: 'practice',
          practice_mode: 'free_run',
          starting_score: null,
          legs_to_win: null,
          first_player_index: null,
          counts_to_stats: 0,
          created_at: createdAt,
        },
      ])
      .execute();
    await db
      .insertInto('match_players')
      .values([
        { match_id: 'm1', player_id: 'p1', position: 0 },
        { match_id: 'm1', player_id: 'p2', position: 1 },
        { match_id: 'f1', player_id: 'p1', position: 0 },
      ])
      .execute();
    const dart = { source: 'keypad', sequence: 0, confidence: 1, detected_at: createdAt, received_at: createdAt };
    await db
      .insertInto('throws')
      .values([
        { ...dart, match_id: 'm1', id: 't1', event_id: '4b8e7a61-2c0f-4f5e-9d1a-6c3b2a1f0e9d', segment: 20, multiplier: 3 },
        { ...dart, match_id: 'f1', id: 't2', event_id: '5c9f8b72-3d1a-4a6f-8e2b-7d4c3b2a1f0e', segment: 19, multiplier: 1 },
        { ...dart, match_id: 'f1', id: 't3', event_id: '6d0a9c83-4e2b-4b7a-9f3c-8e5d4c3b2a1f', segment: 5, multiplier: 1 },
      ])
      .execute();
    await db
      .insertInto('match_events')
      .values([
        { match_id: 'm1', seq: 1, type: 'throw', throw_id: 't1', player_id: null, reason: null, created_at: createdAt },
        { match_id: 'f1', seq: 1, type: 'throw', throw_id: 't2', player_id: null, reason: null, created_at: createdAt },
        { match_id: 'f1', seq: 2, type: 'throw', throw_id: 't3', player_id: null, reason: null, created_at: createdAt },
      ])
      .execute();

    await migrateToLatest(db);
    const matches = await db
      .selectFrom('matches')
      .select(['id', 'checkout_range', 'checkout_seed', 'checkout_rule'])
      .orderBy('id')
      .execute();
    expect(matches).toEqual([
      { id: 'f1', checkout_range: null, checkout_seed: null, checkout_rule: null },
      { id: 'm1', checkout_range: null, checkout_seed: null, checkout_rule: null },
    ]);
    const events = await db.selectFrom('match_events').select('success').execute();
    expect(events).toEqual([{ success: null }, { success: null }, { success: null }]);

    const app = await buildApp({ db, auth: null, random: () => 0 });
    try {
      const match = await app.inject({ method: 'GET', url: '/matches/m1' });
      expect(match.statusCode).toBe(200);
      expect(match.json()).toMatchObject({
        eventSeq: 1,
        status: 'in_progress',
        currentDarts: [{ segment: 20, multiplier: 3 }],
        freeRun: null,
        checkouts: null,
      });
      expect(match.json<MatchSnapshot>().players.map((player) => player.remaining)).toEqual([241, 301]);

      const freeRun = await app.inject({ method: 'GET', url: '/matches/f1' });
      expect(freeRun.statusCode).toBe(200);
      expect(freeRun.json()).toMatchObject({
        eventSeq: 2,
        practiceMode: 'free_run',
        freeRun: { dartsThrown: 2, totalPoints: 24 },
        checkouts: null,
      });

      const created = await app.inject({
        method: 'POST',
        url: '/matches',
        payload: { type: 'practice', practiceMode: 'checkouts', playerIds: ['p1'], checkoutRange: '2-50' },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ practiceMode: 'checkouts', checkouts: { range: '2-50', attempts: 0 } });
      const attempt = await app.inject({
        method: 'POST',
        url: `/matches/${created.json<MatchSnapshot>().id}/checkout-attempts`,
        payload: { success: true },
      });
      expect(attempt.statusCode).toBe(201);
      expect(attempt.json<MatchSnapshot>().checkouts).toMatchObject({ attempts: 1, successes: 1 });
    } finally {
      await app.close();
      await db.destroy();
    }
  });

  it('keeps the old checkout rule for sessions written under 0005_checkout_practice', async () => {
    const db = openDatabase(':memory:');
    await migrateTo(db, '0005_checkout_practice');
    const createdAt = '2026-10-24T18:30:00.000Z';
    const seed = 424_242;
    const target = (n: number) => checkoutTarget(seed, '51-100', n);
    await db.insertInto('players').values({ id: 'p1', name: 'Anna', avatar: null, color: 1, guest: 0, created_at: createdAt }).execute();
    const practice = {
      type: 'practice',
      starting_score: null,
      legs_to_win: null,
      first_player_index: null,
      counts_to_stats: 0,
      created_at: createdAt,
    };
    await db
      .insertInto('matches')
      .values([
        { ...practice, id: 'c1', practice_mode: 'checkouts', checkout_range: '51-100', checkout_seed: seed },
        { ...practice, id: 'f1', practice_mode: 'free_run', checkout_range: null, checkout_seed: null },
      ])
      .execute();
    await db
      .insertInto('match_players')
      .values([
        { match_id: 'c1', player_id: 'p1', position: 0 },
        { match_id: 'f1', player_id: 'p1', position: 0 },
      ])
      .execute();
    const entry = { match_id: 'c1', throw_id: null, player_id: null, reason: null, created_at: createdAt };
    await db
      .insertInto('match_events')
      .values([
        { ...entry, seq: 1, type: 'checkout_attempt', success: 1 },
        { ...entry, seq: 2, type: 'checkout_attempt', success: 0 },
        { ...entry, seq: 3, type: 'checkout_attempt', success: 1 },
        { ...entry, seq: 4, type: 'checkout_attempt_undone', success: null },
        { ...entry, seq: 5, type: 'checkout_attempt', success: 0 },
      ])
      .execute();

    await migrateToLatest(db);
    const matches = await db.selectFrom('matches').select(['id', 'checkout_rule']).orderBy('id').execute();
    expect(matches).toEqual([
      { id: 'c1', checkout_rule: 'new_each_attempt' },
      { id: 'f1', checkout_rule: null },
    ]);

    const app = await buildApp({ db, auth: null, random: () => 0 });
    try {
      const session = await app.inject({ method: 'GET', url: '/matches/c1' });
      expect(session.statusCode).toBe(200);
      expect(session.json<MatchSnapshot>().checkouts).toEqual({
        range: '51-100',
        target: target(3),
        attempts: 3,
        successes: 1,
        skips: 0,
        history: [
          { target: target(0), success: true },
          { target: target(1), success: false },
          { target: target(2), success: false },
        ],
      });

      const failed = await app.inject({ method: 'POST', url: '/matches/c1/checkout-attempts', payload: { success: false } });
      expect(failed.statusCode).toBe(201);
      expect(failed.json<MatchSnapshot>().checkouts).toMatchObject({ target: target(4), attempts: 4 });
      expect(failed.json<MatchSnapshot>().checkouts?.history.at(-1)).toEqual({ target: target(3), success: false });
    } finally {
      await app.close();
      await db.destroy();
    }
  });

  it('gives the players and profile changes from before 0004_player_color the default color', async () => {
    const db = openDatabase(':memory:');
    await migrateTo(db, '0003_player_changes');
    const createdAt = '2026-10-15T18:30:00.000Z';
    await db
      .insertInto('players')
      .values([
        { id: 'anna', name: 'Anna', avatar: null, guest: 0, created_at: createdAt },
        { id: 'p2', name: 'Bartek', avatar: null, guest: 0, created_at: createdAt },
      ])
      .execute();
    await db
      .insertInto('player_changes')
      .values({ player_id: 'p2', seq: 1, name: 'Bartosz', avatar: '🎯', guest: 0, archived_at: null, created_at: createdAt })
      .execute();

    await migrateToLatest(db);
    const app = await buildApp({ db, auth: null });
    try {
      const response = await app.inject({ method: 'GET', url: '/players' });
      expect(response.statusCode).toBe(200);
      const players: { id: string; name: string; color: number }[] = response.json();
      expect(players.map(({ id, name }) => [id, name])).toEqual([
        ['anna', 'Anna'],
        ['p2', 'Bartosz'],
      ]);
      for (const player of players) {
        expect(player.color).toBe(defaultPlayerColor(player.id));
      }
    } finally {
      await app.close();
      await db.destroy();
    }
  });

  it('adds the list indexes under 0007_list_indexes and keeps the games written under 0006_checkout_rule', async () => {
    const db = openDatabase(':memory:');
    await migrateTo(db, '0006_checkout_rule');
    const createdAt = '2026-11-15T18:30:00.000Z';
    await db
      .insertInto('players')
      .values([
        { id: 'p1', name: 'Anna', avatar: null, color: 1, guest: 0, created_at: createdAt },
        { id: 'p2', name: 'Bartek', avatar: null, color: 2, guest: 0, created_at: createdAt },
      ])
      .execute();
    await db
      .insertInto('matches')
      .values({
        id: 'm1',
        type: 'match',
        practice_mode: null,
        starting_score: 301,
        legs_to_win: 1,
        first_player_index: 0,
        counts_to_stats: 1,
        checkout_range: null,
        checkout_seed: null,
        checkout_rule: null,
        created_at: createdAt,
      })
      .execute();
    await db
      .insertInto('match_players')
      .values([
        { match_id: 'm1', player_id: 'p1', position: 0 },
        { match_id: 'm1', player_id: 'p2', position: 1 },
      ])
      .execute();
    const darts = LEG_301.map(([segment, multiplier], index) => ({
      id: `t${index + 1}`,
      match_id: 'm1',
      event_id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      source: 'keypad',
      sequence: index,
      segment,
      multiplier,
      confidence: 1,
      detected_at: createdAt,
      received_at: createdAt,
    }));
    await db.insertInto('throws').values(darts).execute();
    await db
      .insertInto('match_events')
      .values(
        darts.map((dart, index) => ({
          match_id: 'm1',
          seq: index + 1,
          type: 'throw' as const,
          throw_id: dart.id,
          player_id: null,
          reason: null,
          success: null,
          created_at: createdAt,
        })),
      )
      .execute();
    const rows = async () => ({
      matches: await db.selectFrom('matches').selectAll().execute(),
      matchPlayers: await db.selectFrom('match_players').selectAll().orderBy('position').execute(),
      throws: await db.selectFrom('throws').selectAll().orderBy('id').execute(),
      events: await db.selectFrom('match_events').selectAll().orderBy('seq').execute(),
    });
    const indexes = async () =>
      (
        await sql<{ name: string }>`select name from sqlite_master where type = 'index' and name like '%_idx' order by name`.execute(db)
      ).rows.map((row) => row.name);
    const migrations = async () =>
      (await sql<{ name: string }>`select name from kysely_migration order by name`.execute(db)).rows.map((row) => row.name);
    const before = await rows();
    expect(await indexes()).toEqual([]);

    await migrateToLatest(db);
    expect(await indexes()).toEqual(['match_players_player_id_idx', 'throws_match_id_idx']);
    expect(await rows()).toEqual(before);
    const applied = await migrations();
    expect(applied.at(-1)).toBe('0007_list_indexes');

    await migrateToLatest(db);
    expect(await migrations()).toEqual(applied);
    expect(await indexes()).toEqual(['match_players_player_id_idx', 'throws_match_id_idx']);
    expect(await rows()).toEqual(before);

    const app = await buildApp({ db, auth: null, random: () => 0 });
    try {
      const list = await app.inject({ method: 'GET', url: '/matches' });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toMatchObject([{ id: 'm1', status: 'finished', winnerId: 'p1' }]);
      const rankings = await app.inject({ method: 'GET', url: '/stats/rankings' });
      expect(rankings.statusCode).toBe(200);
      expect(rankings.json()).toMatchObject({ games: 1, legs: 1 });
    } finally {
      await app.close();
      await db.destroy();
    }
  });
});
