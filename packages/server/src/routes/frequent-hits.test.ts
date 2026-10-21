import { ApiError, FrequentHitsResponse } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TOKEN_TTL_MS, createToken } from '../auth/credentials.js';
import { D, LEG_301, MISS, S, T, createGame, createPlayer, createPlayers, setup, throwDarts, undo, type TestApp } from '../test-helpers.js';

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

async function frequentHits(playerId: string): Promise<FrequentHitsResponse> {
  const response = await t.app.inject({ method: 'GET', url: `/players/${playerId}/frequent-hits` });
  expect(response.statusCode).toBe(200);
  return FrequentHitsResponse.parse(response.json());
}

function newMatch() {
  return createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
}

describe('GET /players/:id/frequent-hits', () => {
  it('counts the hits of each player in a finished game, without Miss', async () => {
    const { id } = await newMatch();
    await throwDarts(t.app, id, LEG_301);

    expect(await frequentHits(anna)).toEqual({
      playerId: anna,
      hits: [
        { segment: 20, multiplier: 3, count: 4 },
        { segment: 17, multiplier: 3, count: 1 },
        { segment: 5, multiplier: 2, count: 1 },
      ],
    });
    expect(await frequentHits(bartek)).toEqual({ playerId: bartek, hits: [] });
  });

  it('leaves Free run out and counts Solo 501', async () => {
    const freeRun = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(t.app, freeRun.id, [S(1), S(1), S(1)]);
    const solo = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
    await throwDarts(t.app, solo.id, [S(19), S(19), D(19)]);

    expect(await frequentHits(anna)).toEqual({
      playerId: anna,
      hits: [
        { segment: 19, multiplier: 1, count: 2 },
        { segment: 19, multiplier: 2, count: 1 },
      ],
    });
  });

  it('does not count an undone dart', async () => {
    const { id } = await newMatch();
    await throwDarts(t.app, id, [T(20), T(20), S(1)]);
    expect((await undo(t.app, id)).statusCode).toBe(200);
    await throwDarts(t.app, id, [T(19)]);

    expect((await frequentHits(anna)).hits).toEqual([
      { segment: 20, multiplier: 3, count: 2 },
      { segment: 19, multiplier: 3, count: 1 },
    ]);
  });

  it('does not count the darts of the open turn', async () => {
    const { id } = await newMatch();
    await throwDarts(t.app, id, [S(20), S(20), S(20), S(5), MISS]);

    expect((await frequentHits(anna)).hits).toEqual([{ segment: 20, multiplier: 1, count: 3 }]);
    expect((await frequentHits(bartek)).hits).toEqual([]);
  });

  it('gives no hits to a player without games', async () => {
    const celina = await createPlayer(t.app, 'Celina');
    expect(await frequentHits(celina.id)).toEqual({ playerId: celina.id, hits: [] });
  });

  it('answers 404 for an unknown player', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/players/nobody/frequent-hits' });
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error).toBe('not_found');
  });
});

describe('GET /players/:id/frequent-hits with a password', () => {
  const tokenSecret = 's'.repeat(32);
  const now = Date.parse('2026-10-20T18:00:00.000Z');
  let secured: TestApp;
  beforeEach(async () => {
    secured = await setup({ auth: { password: 'tajne hasło', tokenSecret }, now: () => now });
  });
  afterEach(async () => {
    await secured.close();
  });

  it('answers 401 without a token and 200 with one', async () => {
    const authorization = `Bearer ${createToken(tokenSecret, now + TOKEN_TTL_MS)}`;
    const created = await secured.app.inject({ method: 'POST', url: '/players', payload: { name: 'Anna' }, headers: { authorization } });
    expect(created.statusCode).toBe(201);
    const url = `/players/${created.json().id}/frequent-hits`;

    const withoutToken = await secured.app.inject({ method: 'GET', url });
    expect(withoutToken.statusCode).toBe(401);
    expect(ApiError.parse(withoutToken.json()).error).toBe('unauthorized');

    const withToken = await secured.app.inject({ method: 'GET', url, headers: { authorization } });
    expect(withToken.statusCode).toBe(200);
    expect(FrequentHitsResponse.parse(withToken.json()).hits).toEqual([]);
  });
});
