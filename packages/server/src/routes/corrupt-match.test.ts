import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEG_301,
  MISS,
  S,
  T,
  createGame,
  createPlayer,
  listMatches,
  postThrow,
  hitEvent,
  setup,
  throwDarts,
  type TestApp,
} from '../test-helpers.js';

let t: TestApp;
let anna: string;
let bartek: string;
beforeEach(async () => {
  t = await setup();
  anna = (await createPlayer(t.app, 'Anna')).id;
  bartek = (await createPlayer(t.app, 'Bartek')).id;
});
afterEach(async () => {
  await t.close();
});

// Mecz 1v1 Anny i Bartka zapisany wprost w bazie, z podanymi rzutkami i wpisami logu.
async function insertMatch(
  id: string,
  {
    legsToWin = 1,
    throws = [],
    entries = [],
  }: { legsToWin?: number | null; throws?: string[]; entries?: { type: 'throw' | 'undo'; throwId: string | null }[] },
): Promise<void> {
  const createdAt = new Date().toISOString();
  await t.db
    .insertInto('matches')
    .values({
      id,
      type: 'match',
      practice_mode: null,
      starting_score: 301,
      legs_to_win: legsToWin,
      first_player_index: 0,
      counts_to_stats: 1,
      checkout_range: null,
      checkout_seed: null,
      checkout_rule: null,
      created_at: createdAt,
    })
    .execute();
  await t.db
    .insertInto('match_players')
    .values([
      { match_id: id, player_id: anna, position: 0 },
      { match_id: id, player_id: bartek, position: 1 },
    ])
    .execute();
  for (const throwId of throws) {
    await t.db
      .insertInto('throws')
      .values({
        id: throwId,
        match_id: id,
        event_id: randomUUID(),
        source: 'keypad',
        sequence: 0,
        segment: 20,
        multiplier: 1,
        confidence: 1,
        detected_at: createdAt,
        received_at: createdAt,
      })
      .execute();
  }
  for (const [index, { type, throwId }] of entries.entries()) {
    await t.db
      .insertInto('match_events')
      .values({
        match_id: id,
        seq: index + 1,
        type,
        throw_id: throwId,
        player_id: null,
        reason: null,
        success: null,
        created_at: createdAt,
      })
      .execute();
  }
}

const CORRUPT = ['undo-not-last', 'throw-without-id', 'no-legs-to-win'];

async function insertCorruptMatches(): Promise<void> {
  await insertMatch('undo-not-last', {
    throws: ['u1', 'u2'],
    entries: [
      { type: 'throw', throwId: 'u1' },
      { type: 'throw', throwId: 'u2' },
      { type: 'undo', throwId: 'u1' },
    ],
  });
  await insertMatch('throw-without-id', {
    throws: ['n1'],
    entries: [
      { type: 'throw', throwId: 'n1' },
      { type: 'throw', throwId: null },
    ],
  });
  await insertMatch('no-legs-to-win', { legsToWin: null, throws: ['l1'], entries: [{ type: 'throw', throwId: 'l1' }] });
}

async function get(url: string) {
  const response = await t.app.inject({ method: 'GET', url });
  return { statusCode: response.statusCode, body: response.json() };
}

function aggregates(): Promise<{ statusCode: number; body: unknown }[]> {
  return Promise.all(
    [
      '/matches',
      '/stats/rankings',
      '/stats/rankings?type=match',
      '/stats/overall',
      `/players/${anna}/stats`,
      `/players/${bartek}/stats`,
    ].map(get),
  );
}

describe('corrupt matches', () => {
  it('leaves them out of lists and aggregates and keeps the healthy results', async () => {
    const finished = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, finished.id, LEG_301);
    const unfinished = await createGame(t.app, { type: 'match', playerIds: [bartek, anna], startingScore: 301, bestOf: 3 });
    await throwDarts(t.app, unfinished.id, [T(20), S(5), MISS]);
    const before = await aggregates();
    expect(before.map(({ statusCode }) => statusCode)).toEqual([200, 200, 200, 200, 200, 200]);

    await insertCorruptMatches();
    expect(await aggregates()).toEqual(before);
    const list = await listMatches(t.app);
    expect(
      list
        .json()
        .map((item: { id: string }) => item.id)
        .sort(),
    ).toEqual([finished.id, unfinished.id].sort());
  });

  it('still fails the single match and its summary', async () => {
    await insertCorruptMatches();
    for (const id of CORRUPT) {
      expect((await get(`/matches/${id}`)).statusCode).toBe(500);
      expect((await get(`/matches/${id}/summary`)).statusCode).toBe(500);
    }
  });

  it('accepts a full turn in a new 1v1 match of a player with a corrupt earlier match', async () => {
    const earlier = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, earlier.id, LEG_301);
    await insertCorruptMatches();

    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    for (const dart of [T(20), T(20), T(20)]) {
      expect((await postThrow(t.app, id, hitEvent(id, dart))).statusCode).toBe(201);
    }
  });
});
