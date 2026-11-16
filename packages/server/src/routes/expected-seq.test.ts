import { ApiError, MatchSnapshot, StaleStateError, UndoResult } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  S,
  T,
  abandon,
  checkoutAttempt,
  checkoutSkip,
  createGame,
  createPlayer,
  createPlayers,
  endPractice,
  getMatch,
  logEntries,
  resume,
  setup,
  throwDarts,
  undo,
  type TestApp,
} from '../test-helpers.js';

type Response = Awaited<ReturnType<typeof undo>>;

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

function match301() {
  return createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
}

function checkouts() {
  return createGame(t.app, { type: 'practice', practiceMode: 'checkouts', playerIds: [anna], checkoutRange: '2-50' });
}

function freeRun() {
  return createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
}

function attempt(matchId: string, payload: object) {
  return t.app.inject({ method: 'POST', url: `/matches/${matchId}/checkout-attempts`, payload });
}

function expectError(response: Response, statusCode: number, code: string) {
  expect(response.statusCode).toBe(statusCode);
  expect(ApiError.parse(response.json()).error).toBe(code);
}

// 409 z bieżącym stanem i bez nowego wpisu w logu.
async function expectStale(response: Response, matchId: string, logLength: number) {
  expect(response.statusCode).toBe(409);
  const body = StaleStateError.parse(response.json());
  const current = await getMatch(t.app, matchId);
  expect(body.state).toEqual(current);
  expect(body.state.eventSeq).toBe(logLength);
  expect(await logEntries(t.db, matchId)).toHaveLength(logLength);
}

describe('expectedSeq on undo', () => {
  it('lets only the first of two undos with the same expectedSeq through', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [T(20), S(19)]);

    const first = await undo(t.app, id, { expectedSeq: 2 });
    expect(first.statusCode).toBe(200);
    expect(UndoResult.parse(first.json()).state.eventSeq).toBe(3);

    const second = await undo(t.app, id, { expectedSeq: 2 });
    expect(second.statusCode).toBe(409);
    const body = StaleStateError.parse(second.json());
    expect(body.error).toBe('stale_state');
    expect(body.message).toBe(`Match ${id} changed since seq 2`);
    expect(body.state.eventSeq).toBe(3);
    expect(body.state.currentDarts).toEqual([{ segment: 20, multiplier: 3 }]);
    expect((await logEntries(t.db, id)).filter((entry) => entry.type === 'undo')).toHaveLength(1);
  });

  it('treats an expectedSeq ahead of the log as stale too', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(20)]);
    await expectStale(await undo(t.app, id, { expectedSeq: 5 }), id, 1);
  });

  it.each([
    ['a negative expectedSeq', '{"expectedSeq":-1}'],
    ['a string expectedSeq', '{"expectedSeq":"3"}'],
    ['a fractional expectedSeq', '{"expectedSeq":1.5}'],
  ])('rejects %s with 400 invalid_request and writes nothing', async (_name, payload) => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(20)]);
    const response = await t.app.inject({
      method: 'POST',
      url: `/matches/${id}/undo`,
      headers: { 'content-type': 'application/json' },
      payload,
    });
    expectError(response, 400, 'invalid_request');
    expect(await logEntries(t.db, id)).toHaveLength(1);
  });

  it('validates the body before looking up the match', async () => {
    expectError(await undo(t.app, 'nope', { expectedSeq: -1 }), 400, 'invalid_request');
    expectError(await undo(t.app, 'nope', { expectedSeq: 0 }), 404, 'not_found');
  });

  it.each([
    ['an array', '[1]'],
    ['a string', '"x"'],
    ['a number', '3'],
    ['null', 'null'],
  ])('treats %s as a missing body', async (_name, payload) => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(20)]);
    const response = await t.app.inject({
      method: 'POST',
      url: `/matches/${id}/undo`,
      headers: { 'content-type': 'application/json' },
      payload,
    });
    expect(response.statusCode).toBe(200);
  });

  it('ignores unknown keys and reads the body whatever the content type', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(20), S(20)]);
    expect((await undo(t.app, id, { expectedSeq: 2, extra: true })).statusCode).toBe(200);
    const plain = await t.app.inject({
      method: 'POST',
      url: `/matches/${id}/undo`,
      headers: { 'content-type': 'text/plain' },
      payload: '{"expectedSeq":2}',
    });
    expectError(plain, 409, 'stale_state');
  });
});

describe('stale expectedSeq on each command', () => {
  it('rejects a checkout attempt', async () => {
    const { id } = await checkouts();
    await expectStale(await attempt(id, { success: true, expectedSeq: 1 }), id, 0);
  });

  it('rejects a checkout skip', async () => {
    const { id } = await checkouts();
    await expectStale(await checkoutSkip(t.app, id, { expectedSeq: 3 }), id, 0);
  });

  it('rejects an undo in checkout practice', async () => {
    const { id } = await checkouts();
    expect((await checkoutAttempt(t.app, id, false)).statusCode).toBe(201);
    await expectStale(await undo(t.app, id, { expectedSeq: 0 }), id, 1);
  });

  it('rejects an abandon', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(20)]);
    await expectStale(await abandon(t.app, id, { playerId: anna, expectedSeq: 0 }), id, 1);
  });

  it('rejects a resume', async () => {
    const { id } = await match301();
    expect((await abandon(t.app, id, { playerId: anna })).statusCode).toBe(200);
    await expectStale(await resume(t.app, id, { expectedSeq: 0 }), id, 1);
  });

  it('rejects an end of practice', async () => {
    const { id } = await freeRun();
    await throwDarts(t.app, id, [S(20)]);
    await expectStale(await endPractice(t.app, id, { expectedSeq: 0 }), id, 1);
  });
});

describe('matching expectedSeq', () => {
  it('accepts a checkout attempt and a skip, also expectedSeq 0 on a fresh session', async () => {
    const { id } = await checkouts();
    const first = await attempt(id, { success: true, expectedSeq: 0 });
    expect(first.statusCode).toBe(201);
    expect(MatchSnapshot.parse(first.json()).eventSeq).toBe(1);
    expect((await checkoutSkip(t.app, id, { expectedSeq: 1 })).statusCode).toBe(201);

    const fresh = await checkouts();
    expect((await checkoutSkip(t.app, fresh.id, { expectedSeq: 0 })).statusCode).toBe(201);
  });

  it('accepts an undo in checkout practice', async () => {
    const { id } = await checkouts();
    expect((await checkoutAttempt(t.app, id, true)).statusCode).toBe(201);
    const response = await undo(t.app, id, { expectedSeq: 1 });
    expect(response.statusCode).toBe(200);
    expect(UndoResult.parse(response.json()).state.checkouts?.attempts).toBe(0);
  });

  it('accepts an abandon with expectedSeq 0 on a fresh match and a resume after it', async () => {
    const { id } = await match301();
    const abandoned = await abandon(t.app, id, { playerId: anna, expectedSeq: 0 });
    expect(abandoned.statusCode).toBe(200);
    expect(MatchSnapshot.parse(abandoned.json()).status).toBe('abandoned');

    const resumed = await resume(t.app, id, { expectedSeq: 1 });
    expect(resumed.statusCode).toBe(200);
    expect(MatchSnapshot.parse(resumed.json()).status).toBe('in_progress');
  });

  it('accepts an end of practice', async () => {
    const { id } = await freeRun();
    await throwDarts(t.app, id, [S(20)]);
    const response = await endPractice(t.app, id, { expectedSeq: 1 });
    expect(response.statusCode).toBe(200);
    expect(MatchSnapshot.parse(response.json()).status).toBe('ended');
  });
});

describe('check order', () => {
  it('answers a stale undo on an ended practice with stale_state', async () => {
    const { id } = await freeRun();
    await throwDarts(t.app, id, [S(20)]);
    expect((await endPractice(t.app, id)).statusCode).toBe(200);
    await expectStale(await undo(t.app, id, { expectedSeq: 1 }), id, 2);
    // Z aktualnym seq zostaje zwykły błąd z logu.
    expectError(await undo(t.app, id, { expectedSeq: 2 }), 409, 'practice_ended');
  });

  it('answers a stale abandon by a non-participant with not_a_participant', async () => {
    const { id } = await match301();
    const celina = await createPlayer(t.app, 'Celina');
    expectError(await abandon(t.app, id, { playerId: celina.id, expectedSeq: 7 }), 400, 'not_a_participant');
  });

  it('checks the match type before expectedSeq', async () => {
    const { id } = await match301();
    expectError(await endPractice(t.app, id, { expectedSeq: 7 }), 409, 'not_practice');
    expectError(await checkoutSkip(t.app, id, { expectedSeq: 7 }), 409, 'not_checkouts');
  });

  it('validates the abandon and checkout attempt body before the match lookup', async () => {
    expectError(await abandon(t.app, 'nope', { playerId: anna, expectedSeq: -1 }), 400, 'invalid_request');
    expectError(await attempt('nope', { success: true, expectedSeq: '1' }), 400, 'invalid_request');
  });
});
