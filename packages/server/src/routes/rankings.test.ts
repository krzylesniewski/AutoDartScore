import { ApiError, StatsRankings } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D, LEG_301, S, T, abandon, createGame, createPlayer, createPlayers, setup, throwDarts, type TestApp } from '../test-helpers.js';

let t: TestApp;
let anna: string;
let bartek: string;
beforeEach(async () => {
  t = await setup();
  [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];
});
afterEach(async () => {
  await t.close();
});

// Solo 501: 180, 180, potem 141 (T20 T19 D12).
const SOLO_501 = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];

async function rankings(type?: string): Promise<StatsRankings> {
  const response = await t.app.inject({ method: 'GET', url: `/stats/rankings${type ? `?type=${type}` : ''}` });
  expect(response.statusCode).toBe(200);
  return StatsRankings.parse(response.json());
}

async function playLeg301(playerIds: readonly string[] = [anna, bartek]): Promise<string> {
  const { id } = await createGame(t.app, { type: 'match', playerIds, startingScore: 301, bestOf: 1 });
  await throwDarts(t.app, id, LEG_301);
  return id;
}

describe('GET /stats/rankings', () => {
  it('answers zeros and empty lists for an empty database', async () => {
    expect(await rankings()).toEqual({
      filter: 'all',
      games: 0,
      legs: 0,
      players: [],
      bestLegAverage: [],
      highestCheckout: [],
      shortestLeg: [],
      scores180: [],
    });
  });

  it('leaves the interrupted leg of an abandoned game out of the average', async () => {
    await playLeg301();
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 3 });
    await throwDarts(t.app, id, LEG_301);
    // Drugi leg zaczyna Bartek: 180, Anna 3 punkty, potem porzucenie.
    await throwDarts(t.app, id, [T(20), T(20), T(20), S(1), S(1), S(1)]);
    expect((await abandon(t.app, id, { playerId: anna })).statusCode).toBe(200);

    const result = await rankings();
    expect(result).toMatchObject({ filter: 'all', games: 2, legs: 2 });
    expect(result.players).toEqual([
      { playerId: anna, name: 'Anna', avatar: null, position: null, average: 150.5, legs: 2 },
      { playerId: bartek, name: 'Bartek', avatar: null, position: null, average: 0, legs: 2 },
    ]);
    // 180 liczy każdą zamkniętą turę, jak karta gracza.
    expect(result.scores180.map((entry) => [entry.name, entry.position, entry.value])).toEqual([
      ['Anna', 1, 2],
      ['Bartek', 2, 1],
    ]);
    expect(result.highestCheckout).toEqual([{ playerId: anna, name: 'Anna', avatar: null, position: 1, value: 121 }]);
    expect(result.shortestLeg).toEqual([{ playerId: anna, name: 'Anna', avatar: null, position: 1, value: 6 }]);
    expect(result.bestLegAverage).toEqual([]);
  });

  it('ranks a player after 3 completed legs', async () => {
    for (let game = 0; game < 3; game += 1) {
      await playLeg301();
    }
    const result = await rankings();
    expect(result.players.map((entry) => [entry.name, entry.position, entry.average, entry.legs])).toEqual([
      ['Anna', 1, 150.5, 3],
      ['Bartek', 2, 0, 3],
    ]);
    expect(result.bestLegAverage.map((entry) => [entry.name, entry.position, entry.value])).toEqual([
      ['Anna', 1, 150.5],
      ['Bartek', 2, 0],
    ]);
  });

  it('filters by game type', async () => {
    await playLeg301();
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
    await throwDarts(t.app, id, SOLO_501);

    expect(await rankings('match')).toMatchObject({ filter: 'match', games: 1, legs: 1, highestCheckout: [{ name: 'Anna', value: 121 }] });
    const practice = await rankings('practice');
    expect(practice).toMatchObject({ filter: 'practice', games: 1, legs: 1, highestCheckout: [{ name: 'Anna', value: 141 }] });
    expect(practice.players).toEqual([{ playerId: anna, name: 'Anna', avatar: null, position: null, average: 167, legs: 1 }]);
    expect(await rankings('casual')).toMatchObject({ filter: 'casual', games: 0, legs: 0, players: [] });
    expect(await rankings()).toMatchObject({ games: 2, legs: 2 });
  });

  it('never counts a Free run', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(t.app, id, [T(20), T(20), T(20), T(20), T(20), T(20)]);
    expect(await rankings()).toMatchObject({ games: 0, legs: 0, players: [], scores180: [] });
    expect(await rankings('practice')).toMatchObject({ games: 0, legs: 0, players: [], scores180: [] });
  });

  it('counts a game with a guest without listing the guest', async () => {
    const guest = await createPlayer(t.app, 'Gość', { guest: true });
    await playLeg301([guest.id, anna]);
    const result = await rankings();
    expect(result).toMatchObject({ games: 1, legs: 1 });
    expect(result.players.map((entry) => entry.name)).toEqual(['Anna']);
    for (const tile of [result.bestLegAverage, result.highestCheckout, result.shortestLeg, result.scores180]) {
      expect(tile.map((entry) => entry.playerId)).not.toContain(guest.id);
    }
  });

  it('answers 400 for an unknown filter', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/stats/rankings?type=bogus' });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });
});
