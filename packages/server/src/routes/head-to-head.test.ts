import { ApiError, HeadToHead } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEG_301, MISS, S, T, abandon, createGame, createPlayers, setup, throwDarts, type TestApp } from '../test-helpers.js';

let t: TestApp;
let anna: string;
let bartek: string;
let celina: string;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T10:00:00.000Z'));
  t = await setup();
  [anna, bartek, celina] = (await createPlayers(t.app, 3)) as [string, string, string];
});
afterEach(async () => {
  await t.close();
  vi.useRealTimers();
});

async function headToHead(playerId: string, opponentId: string): Promise<HeadToHead> {
  const response = await t.app.inject({ method: 'GET', url: `/players/${playerId}/head-to-head/${opponentId}` });
  expect(response.statusCode).toBe(200);
  return HeadToHead.parse(response.json());
}

describe('GET /players/:id/head-to-head/:opponentId', () => {
  it('counts a finished 1v1 game from both sides', async () => {
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    vi.setSystemTime(new Date('2026-10-18T10:05:00.000Z'));
    await throwDarts(t.app, id, LEG_301);

    expect(await headToHead(anna, bartek)).toEqual({
      playerId: anna,
      opponentId: bartek,
      matchesPlayed: 1,
      matchesWon: 1,
      opponentMatchesWon: 0,
      legsWon: 1,
      opponentLegsWon: 0,
      average: 150.5,
      opponentAverage: 0,
      lastPlayedAt: '2026-10-18T10:05:00.000Z',
    });
    expect(await headToHead(bartek, anna)).toMatchObject({ matchesWon: 0, opponentMatchesWon: 1, legsWon: 0, opponentLegsWon: 1, average: 0, opponentAverage: 150.5 });
  });

  it('ignores an abandoned 1v1 game even with a completed leg, and casual games', async () => {
    const abandoned = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 3 });
    await throwDarts(t.app, abandoned.id, LEG_301);
    expect((await abandon(t.app, abandoned.id, { playerId: anna })).statusCode).toBe(200);
    const casual = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek], startingScore: 301 });
    await throwDarts(t.app, casual.id, LEG_301);
    const other = await createGame(t.app, { type: 'match', playerIds: [anna, celina], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, other.id, LEG_301);

    expect(await headToHead(anna, bartek)).toEqual({
      playerId: anna,
      opponentId: bartek,
      matchesPlayed: 0,
      matchesWon: 0,
      opponentMatchesWon: 0,
      legsWon: 0,
      opponentLegsWon: 0,
      average: null,
      opponentAverage: null,
      lastPlayedAt: null,
    });
  });

  it('leaves an unfinished game out', async () => {
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 3 });
    await throwDarts(t.app, id, [...LEG_301, S(1), MISS, T(20)]);
    expect(await headToHead(anna, bartek)).toMatchObject({ matchesPlayed: 0, legsWon: 0 });
  });

  it('answers 400 for the same player twice', async () => {
    const response = await t.app.inject({ method: 'GET', url: `/players/${anna}/head-to-head/${anna}` });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });

  it('answers 404 when either player is unknown', async () => {
    for (const url of [`/players/nobody/head-to-head/${anna}`, `/players/${anna}/head-to-head/nobody`]) {
      const response = await t.app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(404);
      expect(ApiError.parse(response.json()).error).toBe('not_found');
    }
  });
});
