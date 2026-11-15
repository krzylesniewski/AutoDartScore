import { StatsOverall } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D, LEG_301, S, T, abandon, createGame, createPlayer, patchPlayer, setup, throwDarts, type TestApp } from '../test-helpers.js';

let t: TestApp;
let anna: string;
let bartek: string;
beforeEach(async () => {
  t = await setup();
  anna = (await createPlayer(t.app, 'Anna', { color: 4 })).id;
  bartek = (await createPlayer(t.app, 'Bartek', { color: 7 })).id;
});
afterEach(async () => {
  await t.close();
});

// Solo 501: 180, 180, potem 141 (T20 T19 D12).
const SOLO_501 = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];

async function overall(): Promise<StatsOverall> {
  const response = await t.app.inject({ method: 'GET', url: '/stats/overall' });
  expect(response.statusCode).toBe(200);
  return StatsOverall.parse(response.json());
}

async function playLeg301(playerIds: readonly string[] = [anna, bartek]): Promise<string> {
  const { id } = await createGame(t.app, { type: 'match', playerIds, startingScore: 301, bestOf: 1 });
  await throwDarts(t.app, id, LEG_301);
  return id;
}

describe('GET /stats/overall', () => {
  it('answers zeros and an empty list for an empty database', async () => {
    expect(await overall()).toEqual({ games: 0, legs: 0, darts: 0, average: null, players: [] });
  });

  it('takes the mean of the player averages, not the average of all darts', async () => {
    await playLeg301();
    // Ze wszystkich 9 rzutek średnia wyniosłaby 100,33.
    expect(await overall()).toEqual({
      games: 1,
      legs: 1,
      darts: 9,
      average: 75.25,
      players: [
        { playerId: anna, name: 'Anna', avatar: null, color: 4, darts: 6, legs: 1, average: 150.5, difference: 75.25 },
        { playerId: bartek, name: 'Bartek', avatar: null, color: 7, darts: 3, legs: 1, average: 0, difference: -75.25 },
      ],
    });
  });

  it('adds darts from casual and Solo 501 games but not from a Free run', async () => {
    await playLeg301();
    const casual = await createGame(t.app, { type: 'casual', playerIds: [bartek, anna], startingScore: 301 });
    await throwDarts(t.app, casual.id, LEG_301);
    const solo = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
    await throwDarts(t.app, solo.id, SOLO_501);
    const freeRun = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [bartek] });
    await throwDarts(t.app, freeRun.id, [T(20), T(20), T(20), T(20), T(20), T(20)]);

    const result = await overall();
    expect(result).toMatchObject({ games: 3, legs: 3, darts: 27 });
    expect(result.players.map((entry) => [entry.name, entry.darts, entry.legs])).toEqual([
      ['Anna', 18, 3],
      ['Bartek', 9, 2],
    ]);
  });

  it('counts darts from a bust turn and an abandoned leg without adding them to the averages', async () => {
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 3 });
    await throwDarts(t.app, id, LEG_301);
    // Drugi leg zaczyna Bartek: 180, Anna 3 punkty, Bartek bust po dwóch rzutkach (zostałoby 1), Anna 3 punkty, potem porzucenie.
    await throwDarts(t.app, id, [T(20), T(20), T(20), S(1), S(1), S(1), T(20), T(20), S(1), S(1), S(1)]);
    expect((await abandon(t.app, id, { playerId: anna })).statusCode).toBe(200);

    expect(await overall()).toEqual({
      games: 1,
      legs: 1,
      darts: 20,
      average: 75.25,
      players: [
        { playerId: anna, name: 'Anna', avatar: null, color: 4, darts: 12, legs: 1, average: 150.5, difference: 75.25 },
        { playerId: bartek, name: 'Bartek', avatar: null, color: 7, darts: 8, legs: 1, average: 0, difference: -75.25 },
      ],
    });
  });

  it('lists a player without a completed leg last, with darts and no average', async () => {
    const celina = await createPlayer(t.app, 'Celina', { color: 12 });
    const darek = await createPlayer(t.app, 'Darek', { color: 16 });
    const { id } = await createGame(t.app, { type: 'match', playerIds: [celina.id, darek.id], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, id, [T(20), T(20), T(20), S(5), S(5), S(5)]);
    await playLeg301();

    const result = await overall();
    expect(result).toMatchObject({ games: 1, legs: 1, darts: 15, average: 75.25 });
    expect(result.players.map((entry) => [entry.name, entry.darts, entry.average, entry.difference])).toEqual([
      ['Anna', 6, 150.5, 75.25],
      ['Bartek', 3, 0, -75.25],
      ['Celina', 3, null, null],
      ['Darek', 3, null, null],
    ]);
  });

  it('leaves a guest out and keeps an archived player', async () => {
    const guest = await createPlayer(t.app, 'Gość', { guest: true });
    await playLeg301([guest.id, anna]);
    expect((await patchPlayer(t.app, anna, { archived: true })).statusCode).toBe(200);

    expect(await overall()).toEqual({
      games: 1,
      legs: 1,
      darts: 3,
      average: 0,
      players: [{ playerId: anna, name: 'Anna', avatar: null, color: 4, darts: 3, legs: 1, average: 0, difference: 0 }],
    });
  });
});
