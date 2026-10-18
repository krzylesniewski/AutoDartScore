import { ApiError, PlayerForm } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D, LEG_301, T, createGame, createPlayers, setup, throwDarts, type TestApp } from '../test-helpers.js';

let t: TestApp;
let anna: string;
let bartek: string;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  t = await setup();
  [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];
});
afterEach(async () => {
  await t.close();
  vi.useRealTimers();
});

function at(minute: number): void {
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 18, 10, minute)));
}

async function form(playerId: string, type?: string): Promise<PlayerForm> {
  const response = await t.app.inject({ method: 'GET', url: `/players/${playerId}/form${type ? `?type=${type}` : ''}` });
  expect(response.statusCode).toBe(200);
  return PlayerForm.parse(response.json());
}

describe('GET /players/:id/form', () => {
  it('returns one point per game with a completed leg, oldest first, without Free run', async () => {
    at(1);
    const first = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, first.id, LEG_301);
    at(2);
    const freeRun = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(t.app, freeRun.id, [T(20), T(20), T(20)]);
    at(3);
    const interrupted = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, interrupted.id, [T(20), T(20), T(20)]);
    at(4);
    // Solo 501: 180, 180, potem 141 (T20 T19 D12).
    const solo = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
    await throwDarts(t.app, solo.id, [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)]);

    expect(await form(anna)).toEqual({
      playerId: anna,
      filter: 'all',
      points: [
        { matchId: first.id, type: 'match', createdAt: '2026-10-18T10:01:00.000Z', average: 150.5, legs: 1 },
        { matchId: solo.id, type: 'practice', createdAt: '2026-10-18T10:04:00.000Z', average: 167, legs: 1 },
      ],
    });
    expect((await form(anna, 'match')).points.map((point) => point.matchId)).toEqual([first.id]);
    expect(await form(bartek, 'practice')).toEqual({ playerId: bartek, filter: 'practice', points: [] });
  });

  it('answers 404 for an unknown player', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/players/nobody/form' });
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error).toBe('not_found');
  });

  it('answers 400 for an unknown filter', async () => {
    const response = await t.app.inject({ method: 'GET', url: `/players/${anna}/form?type=bogus` });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });
});
