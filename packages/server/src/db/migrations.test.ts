import { checkoutTarget } from '@autoscore/engine';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { defaultPlayerColor } from '../store/player-color.js';
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
      { match_id: 'm1', seq: 1, type: 'throw', throw_id: 't1', player_id: null, reason: null, success: null, segment: null, multiplier: null, actor: null, created_at: createdAt },
      { match_id: 'm1', seq: 2, type: 'throw', throw_id: 't2', player_id: null, reason: null, success: null, segment: null, multiplier: null, actor: null, created_at: createdAt },
      { match_id: 'm1', seq: 3, type: 'undo', throw_id: 't2', player_id: null, reason: null, success: null, segment: null, multiplier: null, actor: null, created_at: createdAt },
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
        { id: 'm1', type: 'match', practice_mode: null, starting_score: 301, legs_to_win: 1, first_player_index: 0, counts_to_stats: 1, created_at: createdAt },
        { id: 'f1', type: 'practice', practice_mode: 'free_run', starting_score: null, legs_to_win: null, first_player_index: null, counts_to_stats: 0, created_at: createdAt },
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
    const matches = await db.selectFrom('matches').select(['id', 'checkout_range', 'checkout_seed', 'checkout_rule']).orderBy('id').execute();
    expect(matches).toEqual([
      { id: 'f1', checkout_range: null, checkout_seed: null, checkout_rule: null },
      { id: 'm1', checkout_range: null, checkout_seed: null, checkout_rule: null },
    ]);
    const events = await db.selectFrom('match_events').select('success').execute();
    expect(events).toEqual([{ success: null }, { success: null }, { success: null }]);

    const app = await buildApp({ db, random: () => 0 });
    try {
      const match = await app.inject({ method: 'GET', url: '/matches/m1' });
      expect(match.statusCode).toBe(200);
      expect(match.json()).toMatchObject({ eventSeq: 1, status: 'in_progress', currentDarts: [{ segment: 20, multiplier: 3 }], freeRun: null, checkouts: null });
      expect(match.json().players.map((player: { remaining: number }) => player.remaining)).toEqual([241, 301]);

      const freeRun = await app.inject({ method: 'GET', url: '/matches/f1' });
      expect(freeRun.statusCode).toBe(200);
      expect(freeRun.json()).toMatchObject({ eventSeq: 2, practiceMode: 'free_run', freeRun: { dartsThrown: 2, totalPoints: 24 }, checkouts: null });

      const created = await app.inject({
        method: 'POST',
        url: '/matches',
        payload: { type: 'practice', practiceMode: 'checkouts', playerIds: ['p1'], checkoutRange: '2-50' },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ practiceMode: 'checkouts', checkouts: { range: '2-50', attempts: 0 } });
      const attempt = await app.inject({ method: 'POST', url: `/matches/${created.json().id}/checkout-attempts`, payload: { success: true } });
      expect(attempt.statusCode).toBe(201);
      expect(attempt.json().checkouts).toMatchObject({ attempts: 1, successes: 1 });
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
    const practice = { type: 'practice', starting_score: null, legs_to_win: null, first_player_index: null, counts_to_stats: 0, created_at: createdAt };
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

    const app = await buildApp({ db, random: () => 0 });
    try {
      const session = await app.inject({ method: 'GET', url: '/matches/c1' });
      expect(session.statusCode).toBe(200);
      expect(session.json().checkouts).toEqual({
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
      expect(failed.json().checkouts).toMatchObject({ target: target(4), attempts: 4 });
      expect(failed.json().checkouts.history.at(-1)).toEqual({ target: target(3), success: false });
    } finally {
      await app.close();
      await db.destroy();
    }
  });

  it('reads the throws and log entries written before 0007_throw_review with null in the new columns', async () => {
    const db = openDatabase(':memory:');
    await migrateTo(db, '0006_checkout_rule');
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
      .values({ id: 'm1', type: 'match', practice_mode: null, starting_score: 301, legs_to_win: 1, first_player_index: 0, counts_to_stats: 1, created_at: createdAt })
      .execute();
    await db
      .insertInto('match_players')
      .values([
        { match_id: 'm1', player_id: 'p1', position: 0 },
        { match_id: 'm1', player_id: 'p2', position: 1 },
      ])
      .execute();
    const dart = { match_id: 'm1', source: 'camera-1', sequence: 0, confidence: 0.4, detected_at: createdAt, received_at: createdAt };
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
        { match_id: 'm1', seq: 3, type: 'match_abandoned', player_id: 'p2', reason: 'koniec', created_at: createdAt },
      ])
      .execute();

    await migrateToLatest(db);
    expect(await db.selectFrom('throws').select(['id', 'review']).orderBy('id').execute()).toEqual([
      { id: 't1', review: null },
      { id: 't2', review: null },
    ]);
    expect(await db.selectFrom('match_events').select(['seq', 'segment', 'multiplier', 'actor']).orderBy('seq').execute()).toEqual([
      { seq: 1, segment: null, multiplier: null, actor: null },
      { seq: 2, segment: null, multiplier: null, actor: null },
      { seq: 3, segment: null, multiplier: null, actor: null },
    ]);

    // Stara rzutka z niską pewnością była już policzona i taka zostaje.
    const app = await buildApp({ db });
    try {
      const response = await app.inject({ method: 'GET', url: '/matches/m1' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ eventSeq: 3, status: 'abandoned', currentDarts: [{ segment: 20, multiplier: 3 }, { segment: 19, multiplier: 1 }], awaitingReview: false });
      expect(response.json().lastTurnThrows.map((entry: { status: string; scoring: string; review: unknown }) => [entry.status, entry.scoring, entry.review])).toEqual([
        ['confirmed', 'counted', null],
        ['confirmed', 'counted', null],
      ]);
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
    const app = await buildApp({ db });
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
});
