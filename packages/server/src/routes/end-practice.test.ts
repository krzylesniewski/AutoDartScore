import { ApiError, LiveMessage, MatchListItem, MatchSnapshot, StatsRankings } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  D,
  S,
  T,
  abandon,
  countRows,
  createGame,
  createPlayers,
  endPractice,
  getMatch,
  hitEvent,
  listMatches,
  logEntries,
  postThrow,
  remaining,
  resume,
  setup,
  throwDarts,
  undo,
  type TestApp,
} from '../test-helpers.js';

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

function freeRun() {
  return createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
}

function solo501() {
  return createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
}

async function endOk(matchId: string): Promise<MatchSnapshot> {
  const response = await endPractice(t.app, matchId);
  expect(response.statusCode).toBe(200);
  return MatchSnapshot.parse(response.json());
}

function errorCode(response: { json(): unknown }): string {
  return ApiError.parse(response.json()).error;
}

async function expectError(response: { statusCode: number; json(): unknown }, statusCode: number, code: string) {
  expect(response.statusCode).toBe(statusCode);
  expect(errorCode(response)).toBe(code);
}

describe('POST /matches/:id/end', () => {
  it('ends a free run mid-turn and keeps the session counter', async () => {
    const { id } = await freeRun();
    await throwDarts(t.app, id, [T(20), S(5), S(1), T(19)]);
    const before = await getMatch(t.app, id);
    const throwsBefore = await countRows(t.db, 'throws');

    const state = await endOk(id);
    expect(state).toMatchObject({
      status: 'ended',
      finished: false,
      eventSeq: 5,
      abandonment: null,
      currentPlayerId: anna,
      currentDarts: [{ segment: 19, multiplier: 3 }],
      freeRun: { dartsThrown: 4, totalPoints: 123 },
    });
    expect(state.freeRun).toEqual(before.freeRun);
    expect(Date.parse(state.endedAt ?? '')).not.toBeNaN();
    expect((await logEntries(t.db, id)).at(-1)).toEqual({ seq: 5, type: 'practice_ended', throw_id: null, player_id: null, reason: null });
    expect(await logEntries(t.db, id)).toHaveLength(5);
    expect(await countRows(t.db, 'throws')).toBe(throwsBefore);
    expect(await getMatch(t.app, id)).toEqual(state);
  });

  it('ends a solo 501 before zero without a winner', async () => {
    const { id } = await solo501();
    await throwDarts(t.app, id, [T(20), T(19), S(20)]);
    const state = await endOk(id);
    expect(state).toMatchObject({ status: 'ended', finished: false, winnerId: null });
    expect(remaining(state)).toEqual([364]);
  });

  it('rejects every command after the end but answers a resent eventId', async () => {
    const { id } = await freeRun();
    const earlier = hitEvent(id, S(20));
    expect((await postThrow(t.app, id, earlier)).statusCode).toBe(201);
    await endOk(id);
    const entries = await logEntries(t.db, id);

    await expectError(await postThrow(t.app, id, hitEvent(id, S(5))), 409, 'practice_ended');

    const resent = await postThrow(t.app, id, earlier);
    expect(resent.statusCode).toBe(200);
    expect(resent.json()).toMatchObject({ events: [], state: { status: 'ended' } });

    await expectError(await undo(t.app, id), 409, 'practice_ended');
    await expectError(await abandon(t.app, id, { playerId: anna }), 409, 'practice_ended');
    await expectError(await resume(t.app, id), 409, 'match_not_abandoned');
    await expectError(await endPractice(t.app, id), 409, 'practice_ended');

    expect(await logEntries(t.db, id)).toEqual(entries);
    expect(await countRows(t.db, 'throws')).toBe(1);
  });

  it.each([
    ['match', () => ({ type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 3 })],
    ['casual', () => ({ type: 'casual', playerIds: [anna, bartek], startingScore: 301 })],
  ])('answers 409 not_practice for a %s', async (_type, payload) => {
    const { id } = await createGame(t.app, payload());
    await throwDarts(t.app, id, [S(20)]);
    await expectError(await endPractice(t.app, id), 409, 'not_practice');
    expect(await logEntries(t.db, id)).toHaveLength(1);
  });

  it('answers 409 nothing_to_end without throws', async () => {
    const { id } = await freeRun();
    await expectError(await endPractice(t.app, id), 409, 'nothing_to_end');
    expect(await logEntries(t.db, id)).toHaveLength(0);
  });

  it('answers 409 nothing_to_end after all throws are undone', async () => {
    const { id } = await solo501();
    await throwDarts(t.app, id, [S(20), S(5)]);
    expect((await undo(t.app, id)).statusCode).toBe(200);
    expect((await undo(t.app, id)).statusCode).toBe(200);
    await expectError(await endPractice(t.app, id), 409, 'nothing_to_end');
    expect(await logEntries(t.db, id)).toHaveLength(4);
  });

  it('answers 409 match_finished for a checked-out solo 501', async () => {
    const { id } = await solo501();
    await throwDarts(t.app, id, [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)]);
    await expectError(await endPractice(t.app, id), 409, 'match_finished');
  });

  it('answers 409 match_abandoned for an abandoned practice', async () => {
    const { id } = await freeRun();
    await throwDarts(t.app, id, [S(20)]);
    expect((await abandon(t.app, id, { playerId: anna })).statusCode).toBe(200);
    await expectError(await endPractice(t.app, id), 409, 'match_abandoned');
  });

  it('answers an unknown match with 404', async () => {
    await expectError(await endPractice(t.app, 'nope'), 404, 'not_found');
  });

  it('ignores an empty and a broken JSON body', async () => {
    const first = await freeRun();
    const second = await freeRun();
    await throwDarts(t.app, first.id, [S(1)]);
    await throwDarts(t.app, second.id, [S(2)]);

    const empty = await t.app.inject({ method: 'POST', url: `/matches/${first.id}/end`, payload: '' });
    expect(empty.statusCode).toBe(200);
    const broken = await t.app.inject({
      method: 'POST',
      url: `/matches/${second.id}/end`,
      headers: { 'content-type': 'application/json' },
      payload: '{"oops',
    });
    expect(broken.statusCode).toBe(200);
    expect(MatchSnapshot.parse(broken.json()).status).toBe('ended');
  });
});

describe('GET /matches', () => {
  it('leaves an ended practice out of the unfinished list only', async () => {
    const { id } = await freeRun();
    await throwDarts(t.app, id, [S(20)]);
    await endOk(id);

    const unfinished = await listMatches(t.app, '?status=unfinished');
    expect(unfinished.statusCode).toBe(200);
    expect(unfinished.json()).toEqual([]);

    const all = await listMatches(t.app);
    expect(all.statusCode).toBe(200);
    const items = MatchListItem.array().parse(all.json());
    expect(items.map((item) => [item.id, item.status])).toEqual([[id, 'ended']]);
  });
});

describe('GET /stats/rankings', () => {
  it('adds no game and no leg for a solo 501 ended before zero', async () => {
    const { id } = await solo501();
    await throwDarts(t.app, id, [T(20), T(19), S(20), S(5), S(5), S(5)]);
    await endOk(id);

    const response = await t.app.inject({ method: 'GET', url: '/stats/rankings?type=practice' });
    expect(response.statusCode).toBe(200);
    expect(StatsRankings.parse(response.json())).toMatchObject({ filter: 'practice', games: 0, legs: 0, players: [] });
  });
});

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  terminate(): void;
}

describe('live updates', () => {
  it('broadcasts only state_updated on the end', async () => {
    const { id } = await freeRun();
    await throwDarts(t.app, id, [S(20)]);
    const messages: unknown[] = [];
    const socket: TestSocket = await t.app.injectWS(`/matches/${id}/live`, {}, {
      onInit(ws: TestSocket) {
        ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
      },
    });
    try {
      await vi.waitFor(() => expect(messages).toHaveLength(1));
      await endOk(id);
      await vi.waitFor(() => expect(messages).toHaveLength(2));

      const [, last] = messages.map((message) => LiveMessage.parse(message));
      expect(last).toMatchObject({ type: 'state_updated', eventSeq: 2, state: { status: 'ended' } });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(messages).toHaveLength(2);
    } finally {
      socket.terminate();
    }
  });
});
