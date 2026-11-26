import type { MatchListItem } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import {
  D,
  LEG_301,
  MISS,
  S,
  T,
  abandon,
  checkoutAttempt,
  checkoutSkip,
  createGame,
  createPlayers,
  endPractice,
  patchPlayer,
  resume,
  setup,
  throwDarts,
  undo,
  type TestApp,
} from '../test-helpers.js';

// t.app ma pamięć podręczną odtworzeń, uncached nie ma. Obie aplikacje czytają i piszą tę samą bazę.
let t: TestApp;
let uncached: FastifyInstance;
beforeEach(async () => {
  t = await setup();
  uncached = await buildApp({ db: t.db, auth: null, random: () => 0, replayCacheSize: 0 });
  await uncached.ready();
});
afterEach(async () => {
  await uncached.close();
  await t.close();
});

const TYPES = ['all', 'match', 'casual', 'practice'];
const PERIODS = ['7d', '30d', 'all'];

function endpoints(playerIds: readonly string[], matchIds: readonly string[]): string[] {
  const [anna, bartek] = playerIds;
  return [
    '/matches',
    ...['match', 'casual', 'practice'].map((type) => `/matches?type=${type}`),
    ...playerIds.map((id) => `/matches?playerId=${id}`),
    '/matches?status=unfinished',
    ...TYPES.flatMap((type) => PERIODS.map((period) => `/stats/rankings?type=${type}&period=${period}`)),
    ...PERIODS.map((period) => `/stats/overall?period=${period}`),
    ...playerIds.flatMap((id) => [
      ...TYPES.map((type) => `/players/${id}/stats?type=${type}`),
      ...TYPES.map((type) => `/players/${id}/form?type=${type}`),
      `/players/${id}/frequent-hits`,
    ]),
    `/players/${anna}/head-to-head/${bartek}`,
    `/players/${bartek}/head-to-head/${anna}`,
    ...matchIds.map((id) => `/matches/${id}/summary`),
  ];
}

// Dwa odczyty z pamięcią podręczną (zimny i ciepły) muszą dać to samo co odczyt bez niej.
async function expectSameResponses(urls: readonly string[]): Promise<void> {
  for (const url of urls) {
    const first = await t.app.inject({ method: 'GET', url });
    const second = await t.app.inject({ method: 'GET', url });
    const reference = await uncached.inject({ method: 'GET', url });
    expect(reference.statusCode, url).toBe(200);
    expect({ url, status: first.statusCode, body: first.json<unknown>() }).toEqual({ url, status: 200, body: reference.json<unknown>() });
    expect({ url, status: second.statusCode, body: second.json<unknown>() }).toEqual({ url, status: 200, body: reference.json<unknown>() });
  }
}

function ok(response: { statusCode: number }): void {
  expect(response.statusCode).toBeLessThan(300);
}

// Kilka tysięcy żądań po kolei. Przy testach wszystkich pakietów naraz domyślne 5 s nie wystarcza.
const TIMEOUT_MS = 60_000;

describe('lists and stats with the replay cache', () => {
  it('answer the same as without the cache after every kind of write', { timeout: TIMEOUT_MS }, async () => {
    const [anna, bartek, celina, darek] = await createPlayers(t.app, 4);
    if (!anna || !bartek || !celina || !darek) {
      throw new Error('players not created');
    }

    const finished = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, finished.id, LEG_301);

    const inProgress = await createGame(t.app, { type: 'match', playerIds: [anna, celina], startingScore: 301, bestOf: 3 });
    await throwDarts(t.app, inProgress.id, [T(20), T(20), S(1)]);
    ok(await undo(t.app, inProgress.id));

    // Anna kończy w drugiej turze i zajmuje 1. miejsce, Bartek i Celina grają dalej.
    const casual = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek, celina], startingScore: 301 });
    await throwDarts(t.app, casual.id, [T(20), T(20), T(20), MISS, MISS, MISS, S(5), S(5), S(5), T(20), T(17), D(5), S(20)]);

    const solo = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [bartek] });
    await throwDarts(t.app, solo.id, [T(20), T(19), S(18), T(20)]);

    const freeRun = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [celina] });
    await throwDarts(t.app, freeRun.id, [S(20), T(5), D(1), MISS, S(25)]);

    const checkouts = await createGame(t.app, { type: 'practice', practiceMode: 'checkouts', playerIds: [darek], checkoutRange: '2-50' });
    ok(await checkoutAttempt(t.app, checkouts.id, true));
    ok(await checkoutSkip(t.app, checkouts.id));
    ok(await checkoutAttempt(t.app, checkouts.id, false));

    const paused = await createGame(t.app, { type: 'match', playerIds: [bartek, darek], startingScore: 501, bestOf: 1 });
    await throwDarts(t.app, paused.id, [T(20), S(19), S(18), S(1)]);
    ok(await abandon(t.app, paused.id, { playerId: darek, reason: 'przerwa' }));
    ok(await resume(t.app, paused.id));
    await throwDarts(t.app, paused.id, [S(2)]);

    const urls = endpoints(
      [anna, bartek, celina, darek],
      [finished.id, inProgress.id, casual.id, solo.id, freeRun.id, checkouts.id, paused.id],
    );
    await expectSameResponses(urls);

    // Każdy krok raz, po nim porównanie. Część kroków idzie przez aplikację bez pamięci podręcznej,
    // więc aplikacja z pamięcią musi zauważyć zapis, którego sama nie zrobiła.
    const steps: [name: string, run: () => Promise<unknown>][] = [
      ['throw', () => throwDarts(t.app, inProgress.id, [T(20)])],
      ['undo through the uncached app', async () => ok(await undo(uncached, inProgress.id))],
      ['throw through the uncached app', () => throwDarts(uncached, inProgress.id, [T(20)])],
      ['abandon', async () => ok(await abandon(t.app, paused.id, { playerId: bartek }))],
      ['resume through the uncached app', async () => ok(await resume(uncached, paused.id))],
      ['end practice', async () => ok(await endPractice(t.app, freeRun.id))],
      ['checkout attempt through the uncached app', async () => ok(await checkoutAttempt(uncached, checkouts.id, true))],
      ['checkout skip', async () => ok(await checkoutSkip(t.app, checkouts.id))],
      ['undo of a checkout skip through the uncached app', async () => ok(await undo(uncached, checkouts.id))],
      ['rename through the uncached app', async () => ok(await patchPlayer(uncached, anna, { name: 'Ania', avatar: '🎯' }))],
      ['rename', async () => ok(await patchPlayer(t.app, celina, { name: 'Cela', color: 9 }))],
      ['leg won', () => throwDarts(t.app, inProgress.id, [MISS, MISS, MISS, T(20), T(17), D(5)])],
      ['casual finished', () => throwDarts(t.app, casual.id, [S(1), S(1), T(20), T(20), T(20)])],
      ['solo 501 throw through the uncached app', () => throwDarts(uncached, solo.id, [S(20)])],
    ];
    for (const [name, run] of steps) {
      await run();
      await expect(expectSameResponses(urls), name).resolves.toBeUndefined();
    }

    const list = await t.app.inject({ method: 'GET', url: '/matches' });
    const names = list
      .json<MatchListItem[]>()
      .flatMap((item: { players: { name: string }[] }) => item.players.map((player) => player.name));
    expect(names).toContain('Ania');
    expect(names).toContain('Cela');
    expect(names).not.toContain('Anna');
  });
});
