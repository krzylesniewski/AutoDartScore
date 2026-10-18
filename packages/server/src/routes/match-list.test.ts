import { ApiError, MatchListItem } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEG_301, S, abandon, createGame, createPlayers, listMatches, setup, throwDarts, type TestApp } from '../test-helpers.js';

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

  it('returns an empty list without games', async () => {
    expect(await list('?status=unfinished')).toEqual([]);
  });

  it('rejects any other status filter with 400', async () => {
    const response = await listMatches(t.app, '?status=finished');
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });
});
