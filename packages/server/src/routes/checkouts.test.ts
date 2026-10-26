import { CHECKOUT_RANGES, checkoutTarget, MAX_CHECKOUT_SEED } from '@autoscore/engine';
import { ApiError, LiveMessage, MatchListItem, MatchSnapshot, MatchSummary, UndoResult, type CheckoutRange } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  D,
  LEG_301,
  S,
  T,
  abandon,
  checkoutAttempt,
  countRows,
  createGame,
  createPlayers,
  endPractice,
  getMatch,
  hitEvent,
  listMatches,
  logEntries,
  postThrow,
  setup,
  throwDarts,
  undo,
  type TestApp,
} from '../test-helpers.js';

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  terminate(): void;
}

let t: TestApp;
let anna: string;
let bartek: string;
const sockets: TestSocket[] = [];
beforeEach(async () => {
  t = await setup();
  [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];
});
afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.terminate();
  }
  await t.close();
});

function checkouts(range: CheckoutRange = '2-50') {
  return createGame(t.app, { type: 'practice', practiceMode: 'checkouts', playerIds: [anna], checkoutRange: range });
}

async function storedSeed(matchId: string): Promise<number> {
  const row = await t.db.selectFrom('matches').select('checkout_seed').where('id', '=', matchId).executeTakeFirstOrThrow();
  if (row.checkout_seed === null) {
    throw new Error(`Match ${matchId} has no checkout seed`);
  }
  return row.checkout_seed;
}

async function attemptOk(matchId: string, success: boolean): Promise<MatchSnapshot> {
  const response = await checkoutAttempt(t.app, matchId, success);
  expect(response.statusCode).toBe(201);
  return MatchSnapshot.parse(response.json());
}

async function expectError(response: { statusCode: number; json(): unknown }, statusCode: number, code: string) {
  expect(response.statusCode).toBe(statusCode);
  expect(ApiError.parse(response.json()).error).toBe(code);
}

describe('POST /matches with practiceMode checkouts', () => {
  it.each([
    ['0', () => 0, 0],
    ['0.37', () => 0.37, Math.floor(0.37 * (MAX_CHECKOUT_SEED + 1))],
    ['just below 1', () => 1 - Number.EPSILON, MAX_CHECKOUT_SEED],
    ['1', () => 1, MAX_CHECKOUT_SEED],
  ])('starts a session with the seed drawn from random() %s', async (_name, random, seed) => {
    await t.close();
    t = await setup({ random });
    [anna] = (await createPlayers(t.app, 1)) as [string];

    for (const range of ['2-50', '51-100'] as const) {
      const state = MatchSnapshot.parse(await checkouts(range));
      const { min, max } = CHECKOUT_RANGES[range];
      expect(state).toMatchObject({
        type: 'practice',
        practiceMode: 'checkouts',
        startingScore: null,
        legsToWin: null,
        countsToStats: false,
        finished: false,
        status: 'in_progress',
        round: null,
        startedAt: null,
        legStartedAt: null,
        eventSeq: 0,
        currentPlayerId: anna,
        legIndex: 0,
        turnIndex: 0,
        currentDarts: [],
        winnerId: null,
        placements: [],
        freeRun: null,
        players: [{ id: anna, remaining: null, legsWon: null, place: null, dartsThrownInLeg: 0 }],
      });
      expect(state.checkouts).toEqual({ range, target: checkoutTarget(seed, range, 0), attempts: 0, successes: 0, history: [] });
      expect(state.checkouts?.target).toBeGreaterThanOrEqual(min);
      expect(state.checkouts?.target).toBeLessThanOrEqual(max);
      expect(await storedSeed(state.id)).toBe(seed);
      expect(JSON.stringify(state)).not.toMatch(/seed/i);
    }
  });

  it('stores no checkout range or seed for the other modes', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    const row = await t.db.selectFrom('matches').select(['checkout_range', 'checkout_seed', 'first_player_index']).where('id', '=', id).executeTakeFirstOrThrow();
    expect(row).toEqual({ checkout_range: null, checkout_seed: null, first_player_index: null });
  });

  it.each([
    ['checkouts without a range', { type: 'practice', practiceMode: 'checkouts', playerIds: ['p'] }],
    ['a range on free_run', { type: 'practice', practiceMode: 'free_run', playerIds: ['p'], checkoutRange: '2-50' }],
    ['a range on solo_501', { type: 'practice', practiceMode: 'solo_501', playerIds: ['p'], checkoutRange: '51-100' }],
    ['an unknown range', { type: 'practice', practiceMode: 'checkouts', playerIds: ['p'], checkoutRange: '0-50' }],
  ])('rejects %s with 400', async (_name, payload) => {
    const response = await t.app.inject({ method: 'POST', url: '/matches', payload: { ...payload, playerIds: [anna] } });
    await expectError(response, 400, 'invalid_request');
    expect(await t.db.selectFrom('matches').selectAll().execute()).toEqual([]);
  });
});

describe('POST /matches/:id/checkout-attempts', () => {
  it('records attempts and draws the targets from the stored seed', async () => {
    const { id } = await checkouts('51-100');
    const seed = await storedSeed(id);
    const target = (n: number) => checkoutTarget(seed, '51-100', n);

    await attemptOk(id, true);
    await attemptOk(id, false);
    const state = await attemptOk(id, true);
    expect(state.checkouts).toEqual({
      range: '51-100',
      target: target(3),
      attempts: 3,
      successes: 2,
      history: [
        { target: target(0), success: true },
        { target: target(1), success: false },
        { target: target(2), success: true },
      ],
    });
    expect(state).toMatchObject({ eventSeq: 3, turnIndex: 3, round: null, startedAt: null, legStartedAt: null, currentDarts: [] });
    expect(state.players[0]).toMatchObject({ remaining: null, dartsThrownInLeg: 0 });
    expect(await getMatch(t.app, id)).toEqual(state);
    expect((await logEntries(t.db, id)).map((entry) => entry.type)).toEqual(['checkout_attempt', 'checkout_attempt', 'checkout_attempt']);
    const rows = await t.db.selectFrom('match_events').select('success').where('match_id', '=', id).orderBy('seq').execute();
    expect(rows.map((row) => row.success)).toEqual([1, 0, 1]);
    expect(await countRows(t.db, 'throws')).toBe(0);
  });

  it('publishes state_updated', async () => {
    const { id } = await checkouts();
    const messages: unknown[] = [];
    const socket: TestSocket = await t.app.injectWS(`/matches/${id}/live`, {}, {
      onInit(ws: TestSocket) {
        ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
      },
    });
    sockets.push(socket);
    await vi.waitFor(() => expect(messages).toHaveLength(1));

    const state = await attemptOk(id, true);
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(LiveMessage.parse(messages[1])).toEqual({ type: 'state_updated', matchId: id, eventSeq: 1, state });
  });

  it.each([
    ['an empty body', {}],
    ['a string', { success: 'yes' }],
    ['a number', { success: 1 }],
  ])('rejects %s with 400', async (_name, payload) => {
    const { id } = await checkouts();
    const response = await t.app.inject({ method: 'POST', url: `/matches/${id}/checkout-attempts`, payload });
    await expectError(response, 400, 'invalid_request');
    expect(await logEntries(t.db, id)).toEqual([]);
  });

  it('answers 404 for an unknown match', async () => {
    await expectError(await checkoutAttempt(t.app, 'missing', true), 404, 'not_found');
  });

  it('answers 409 not_checkouts in a 1v1 match and a Free run', async () => {
    const match = await createGame(t.app, { type: 'match', playerIds: [anna, bartek] });
    const freeRun = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    for (const { id } of [match, freeRun]) {
      await expectError(await checkoutAttempt(t.app, id, true), 409, 'not_checkouts');
      expect(await logEntries(t.db, id)).toEqual([]);
    }
  });

  it('answers 409 practice_ended after the session ended', async () => {
    const { id } = await checkouts();
    await attemptOk(id, false);
    expect((await endPractice(t.app, id)).statusCode).toBe(200);
    await expectError(await checkoutAttempt(t.app, id, true), 409, 'practice_ended');
    await expectError(await undo(t.app, id), 409, 'practice_ended');
    expect((await getMatch(t.app, id)).checkouts).toMatchObject({ attempts: 1 });
  });

  it('answers 409 match_abandoned in an abandoned session', async () => {
    const { id } = await checkouts();
    expect((await abandon(t.app, id, { playerId: anna })).statusCode).toBe(200);
    await expectError(await checkoutAttempt(t.app, id, true), 409, 'match_abandoned');
    await expectError(await undo(t.app, id), 409, 'match_abandoned');
  });
});

describe('POST /matches/:id/throws in checkout practice', () => {
  it('answers 409 throws_not_allowed and stores no throw', async () => {
    const { id } = await checkouts();
    const throwsBefore = await countRows(t.db, 'throws');
    await expectError(await postThrow(t.app, id, hitEvent(id, T(20))), 409, 'throws_not_allowed');
    expect(await countRows(t.db, 'throws')).toBe(throwsBefore);
    expect(await logEntries(t.db, id)).toEqual([]);
  });
});

describe('POST /matches/:id/undo in checkout practice', () => {
  it('removes the last attempt and restores its target', async () => {
    const { id } = await checkouts();
    await attemptOk(id, true);
    const before = await attemptOk(id, false);
    const last = before.checkouts?.history.at(-1);

    const response = await undo(t.app, id);
    expect(response.statusCode).toBe(200);
    const result = UndoResult.parse(response.json());
    expect(result.undoneThrowId).toBeNull();
    expect(result.state.checkouts).toEqual({
      range: '2-50',
      target: last?.target,
      attempts: 1,
      successes: 1,
      history: before.checkouts?.history.slice(0, 1),
    });
    expect(result.state.eventSeq).toBe(3);
    expect(await getMatch(t.app, id)).toEqual(result.state);
    expect((await logEntries(t.db, id)).at(-1)).toEqual({ seq: 3, type: 'checkout_attempt_undone', throw_id: null, player_id: null, reason: null });

    // Po cofnięciu ten sam numer próby dostaje ten sam cel.
    const again = await attemptOk(id, true);
    expect(again.checkouts?.history).toEqual([...(before.checkouts?.history.slice(0, 1) ?? []), { target: last?.target, success: true }]);
    expect(again.checkouts?.target).toBe(before.checkouts?.target);
  });

  it('publishes only state_updated', async () => {
    const { id } = await checkouts();
    await attemptOk(id, true);
    const messages: unknown[] = [];
    const socket: TestSocket = await t.app.injectWS(`/matches/${id}/live`, {}, {
      onInit(ws: TestSocket) {
        ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
      },
    });
    sockets.push(socket);
    await vi.waitFor(() => expect(messages).toHaveLength(1));

    const response = await undo(t.app, id);
    expect(response.statusCode).toBe(200);
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(LiveMessage.parse(messages[1])).toEqual({ type: 'state_updated', matchId: id, eventSeq: 2, state: response.json().state });
  });

  it('answers 409 nothing_to_undo without attempts', async () => {
    const { id } = await checkouts();
    await expectError(await undo(t.app, id), 409, 'nothing_to_undo');
    await attemptOk(id, true);
    expect((await undo(t.app, id)).statusCode).toBe(200);
    await expectError(await undo(t.app, id), 409, 'nothing_to_undo');
  });
});

describe('POST /matches/:id/end in checkout practice', () => {
  it('answers 409 nothing_to_end before the first attempt and 200 after it', async () => {
    const { id } = await checkouts();
    await expectError(await endPractice(t.app, id), 409, 'nothing_to_end');
    const before = await attemptOk(id, false);

    const response = await endPractice(t.app, id);
    expect(response.statusCode).toBe(200);
    const state = MatchSnapshot.parse(response.json());
    expect(state).toMatchObject({ status: 'ended', finished: false, currentPlayerId: anna, checkouts: before.checkouts });
    expect(state.endedAt).not.toBeNull();
  });

  it('answers 409 nothing_to_end after every attempt is undone', async () => {
    const { id } = await checkouts();
    await attemptOk(id, true);
    expect((await undo(t.app, id)).statusCode).toBe(200);
    await expectError(await endPractice(t.app, id), 409, 'nothing_to_end');
  });
});

describe('GET /matches with checkout practice', () => {
  it('lists the checkouts block, also among unfinished games', async () => {
    const { id } = await checkouts('51-100');
    const state = await attemptOk(id, true);
    const freeRun = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });

    for (const query of ['', '?status=unfinished']) {
      const response = await listMatches(t.app, query);
      expect(response.statusCode).toBe(200);
      const items = MatchListItem.array().parse(response.json());
      expect(items.find((item) => item.id === id)).toMatchObject({ practiceMode: 'checkouts', status: 'in_progress', checkouts: state.checkouts });
      expect(items.find((item) => item.id === freeRun.id)?.checkouts).toBeNull();
    }
    expect(JSON.stringify((await listMatches(t.app)).json())).not.toMatch(/seed/i);
  });

  it('drops an ended session from the unfinished list', async () => {
    const { id } = await checkouts();
    await attemptOk(id, true);
    expect((await endPractice(t.app, id)).statusCode).toBe(200);
    const items = MatchListItem.array().parse((await listMatches(t.app, '?status=unfinished')).json());
    expect(items.map((item) => item.id)).not.toContain(id);
  });
});

describe('GET /matches/:id/summary for checkout practice', () => {
  it('returns the checkouts block', async () => {
    const { id } = await checkouts();
    await attemptOk(id, false);
    const state = await attemptOk(id, true);
    const response = await t.app.inject({ method: 'GET', url: `/matches/${id}/summary` });
    expect(response.statusCode).toBe(200);
    const summary = MatchSummary.parse(response.json());
    expect(summary).toMatchObject({ matchId: id, type: 'practice', finished: false, eventSeq: 2, legs: [], lastLegProgress: null });
    expect(summary.checkouts).toEqual(state.checkouts);
  });
});

describe('stats after a checkout practice', () => {
  async function statsSnapshot() {
    const responses = await Promise.all(
      [
        ...['all', 'match', 'casual', 'practice'].map((type) => `/players/${anna}/stats?type=${type}`),
        ...['all', 'practice'].map((type) => `/stats/rankings?type=${type}`),
      ].map((url) => t.app.inject({ method: 'GET', url })),
    );
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
    }
    return responses.map((response) => response.json());
  }

  it('leaves the player stats and rankings unchanged', async () => {
    const match = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    await throwDarts(t.app, match.id, LEG_301);
    const solo = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
    await throwDarts(t.app, solo.id, [T(20), S(1), D(20)]);
    const before = await statsSnapshot();

    const { id } = await checkouts();
    for (const success of [true, true, false, true]) {
      await attemptOk(id, success);
    }
    expect((await endPractice(t.app, id)).statusCode).toBe(200);
    expect(await statsSnapshot()).toEqual(before);
  });
});
