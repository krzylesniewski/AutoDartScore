import { ApiError, MatchListItem } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEG_301, S, T, abandon, createGame, createPlayers, endPractice, listMatches, setup, throwDarts, type TestApp } from '../test-helpers.js';

let t: TestApp;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T10:00:00.000Z'));
  t = await setup();
});
afterEach(async () => {
  await t.close();
  vi.useRealTimers();
});

function at(time: string): void {
  vi.setSystemTime(new Date(`2026-10-18T${time}.000Z`));
}

async function list(query = ''): Promise<MatchListItem[]> {
  const response = await listMatches(t.app, query);
  expect(response.statusCode).toBe(200);
  return MatchListItem.array().parse(response.json());
}

describe('GET /matches', () => {
  it('lists unfinished games, newest activity first', async () => {
    const [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];

    at('10:01:00');
    const finished = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, finished.id, LEG_301);

    at('10:02:00');
    const inProgress = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 501 });
    at('10:03:00');
    const abandoned = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek], startingScore: 301 });
    at('10:04:00');
    const freeRun = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });

    at('10:05:00');
    await throwDarts(t.app, inProgress.id, [S(20)]);
    at('10:06:00');
    expect((await abandon(t.app, abandoned.id, { playerId: bartek, reason: 'kolacja' })).statusCode).toBe(200);

    const unfinished = await list('?status=unfinished');
    expect(unfinished.map((item) => [item.id, item.status, item.updatedAt])).toEqual([
      [abandoned.id, 'abandoned', '2026-10-18T10:06:00.000Z'],
      [inProgress.id, 'in_progress', '2026-10-18T10:05:00.000Z'],
      [freeRun.id, 'in_progress', '2026-10-18T10:04:00.000Z'],
    ]);
    expect(unfinished[0]).toMatchObject({
      type: 'casual',
      startingScore: 301,
      createdAt: '2026-10-18T10:03:00.000Z',
      abandonment: { playerId: bartek, reason: 'kolacja', at: '2026-10-18T10:06:00.000Z' },
    });
    expect(unfinished[1]).toMatchObject({ type: 'match', legsToWin: 2, currentPlayerId: anna, legIndex: 0, abandonment: null });
    expect(unfinished[1]?.players.map((player) => player.remaining)).toEqual([481, 501]);
    expect(unfinished[2]).toMatchObject({ practiceMode: 'free_run', startingScore: null, freeRun: { dartsThrown: 0 } });
  });

  it('returns every game without a filter', async () => {
    const [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];
    const finished = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, finished.id, LEG_301);
    at('10:10:00');
    const open = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });

    const all = await list();
    expect(all.map((item) => [item.id, item.status])).toEqual([
      [open.id, 'in_progress'],
      [finished.id, 'finished'],
    ]);
  });

  it('filters by player and by type, together with the status', async () => {
    const [anna, bartek, celina] = (await createPlayers(t.app, 3)) as [string, string, string];
    at('10:01:00');
    const match = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, match.id, LEG_301);
    at('10:02:00');
    const casual = await createGame(t.app, { type: 'casual', playerIds: [celina, bartek], startingScore: 301 });
    await throwDarts(t.app, casual.id, LEG_301);
    at('10:03:00');
    const practice = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [bartek] });

    expect((await list(`?playerId=${anna}`)).map((item) => item.id)).toEqual([match.id]);
    expect((await list(`?playerId=${bartek}`)).map((item) => item.id)).toEqual([practice.id, casual.id, match.id]);
    expect((await list('?type=casual')).map((item) => item.id)).toEqual([casual.id]);
    expect((await list(`?playerId=${bartek}&type=practice`)).map((item) => item.id)).toEqual([practice.id]);
    expect((await list(`?playerId=${celina}&type=match`)).map((item) => item.id)).toEqual([]);
    expect((await list(`?playerId=${bartek}&status=unfinished`)).map((item) => item.id)).toEqual([practice.id]);
    expect(await list('?playerId=nobody')).toEqual([]);
  });

  it('gives the result of finished games and the end of a practice', async () => {
    const [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];
    const match = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, match.id, LEG_301);
    const casual = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek], startingScore: 301 });
    await throwDarts(t.app, casual.id, LEG_301);
    const practice = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(t.app, practice.id, [T(20)]);
    at('10:20:00');
    expect((await endPractice(t.app, practice.id)).statusCode).toBe(200);

    const items = new Map((await list()).map((item) => [item.id, item]));
    expect(items.get(match.id)).toMatchObject({ status: 'finished', winnerId: anna, placements: [], endedAt: null });
    expect(items.get(casual.id)).toMatchObject({
      status: 'finished',
      winnerId: null,
      placements: [
        { playerId: anna, place: 1 },
        { playerId: bartek, place: 2 },
      ],
    });
    expect(items.get(practice.id)).toMatchObject({ status: 'ended', winnerId: null, endedAt: '2026-10-18T10:20:00.000Z' });
  });

  it('rejects an unknown type with 400', async () => {
    const response = await listMatches(t.app, '?type=bogus');
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });

  it('returns an empty list without games', async () => {
    expect(await list('?status=unfinished')).toEqual([]);
  });

  it('rejects any other status filter with 400', async () => {
    const response = await listMatches(t.app, '?status=finished');
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });
});
