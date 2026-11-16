import { randomUUID } from 'node:crypto';
import { ApiError, REST_MISS_SOURCE, RestMissResult, StaleStateError } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEG_301,
  S,
  T,
  abandon,
  countRows,
  createGame,
  createPlayers,
  endPractice,
  hitEvent,
  logEntries,
  postThrow,
  restMiss,
  setup,
  throwDarts,
  undo,
  type TestApp,
} from '../test-helpers.js';

type Response = Awaited<ReturnType<typeof restMiss>>;

let t: TestApp;
let anna: string;
let bartek: string;
let celina: string;
beforeEach(async () => {
  t = await setup();
  [anna, bartek, celina] = (await createPlayers(t.app, 3)) as [string, string, string];
});
afterEach(async () => {
  await t.close();
});

function match301(bestOf = 3) {
  return createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf });
}

function expectError(response: Response, statusCode: number, code: string) {
  expect(response.statusCode).toBe(statusCode);
  expect(ApiError.parse(response.json()).error).toBe(code);
}

async function restMissOk(matchId: string, payload: object = { eventId: randomUUID() }): Promise<RestMissResult> {
  const response = await restMiss(t.app, matchId, payload);
  expect(response.statusCode).toBe(201);
  return RestMissResult.parse(response.json());
}

describe('POST /matches/:id/rest-miss', () => {
  it.each([
    [0, 3],
    [1, 2],
    [2, 1],
  ])('with %i darts in the turn writes %i Misses and passes the turn', async (thrown, misses) => {
    const { id } = await match301();
    await throwDarts(
      t.app,
      id,
      Array.from({ length: thrown }, () => T(20)),
    );
    const eventId = randomUUID();

    const result = await restMissOk(id, { eventId });
    expect(result.throws).toHaveLength(misses);
    expect(result.throws[0]?.eventId).toBe(eventId);
    expect(new Set(result.throws.map((record) => record.eventId)).size).toBe(misses);
    expect(
      result.throws.map(({ source, sequence, segment, multiplier, confidence }) => ({ source, sequence, segment, multiplier, confidence })),
    ).toEqual(
      Array.from({ length: misses }, (_, sequence) => ({ source: REST_MISS_SOURCE, sequence, segment: 0, multiplier: 0, confidence: 1 })),
    );
    expect(result.events.map((event) => event.type)).toEqual(['turn_completed']);
    expect(result.events[0]).toMatchObject({ playerId: anna, total: 60 * thrown, remaining: 301 - 60 * thrown });
    expect(result.state).toMatchObject({ currentPlayerId: bartek, currentDarts: [], eventSeq: thrown + misses });

    expect(await countRows(t.db, 'throws')).toBe(thrown + misses);
    const log = await logEntries(t.db, id);
    expect(log.map((entry) => entry.seq)).toEqual(Array.from({ length: thrown + misses }, (_, index) => index + 1));
    expect(log.every((entry) => entry.type === 'throw')).toBe(true);
    expect(log.slice(thrown).map((entry) => entry.throw_id)).toEqual(result.throws.map((record) => record.id));
  });

  it('accepts a matching expectedSeq', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(20)]);
    const result = await restMissOk(id, { eventId: randomUUID(), expectedSeq: 1 });
    expect(result.throws).toHaveLength(2);
    expect((await restMissOk(id, { eventId: randomUUID(), expectedSeq: 3 })).throws).toHaveLength(3);
  });

  it('answers a repeat with 200 and no throws and writes nothing, also with a stale expectedSeq', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(20)]);
    const eventId = randomUUID();
    const first = await restMissOk(id, { eventId, expectedSeq: 1 });

    for (const payload of [{ eventId }, { eventId, expectedSeq: 1 }]) {
      const again = await restMiss(t.app, id, payload);
      expect(again.statusCode).toBe(200);
      const result = RestMissResult.parse(again.json());
      expect(result).toEqual({ throws: [], events: [], state: first.state });
    }
    expect(await countRows(t.db, 'throws')).toBe(3);
    expect(await logEntries(t.db, id)).toHaveLength(3);
  });

  it('answers a repeat with 200 even after the Misses were undone', async () => {
    const { id } = await match301();
    const eventId = randomUUID();
    await restMissOk(id, { eventId });
    expect((await undo(t.app, id)).statusCode).toBe(200);

    const again = await restMiss(t.app, id, { eventId });
    expect(again.statusCode).toBe(200);
    expect(RestMissResult.parse(again.json()).state.currentDarts).toHaveLength(2);
    expect(await logEntries(t.db, id)).toHaveLength(4);
  });

  it('rejects a stale expectedSeq with 409 stale_state and writes nothing', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(20)]);
    const response = await restMiss(t.app, id, { eventId: randomUUID(), expectedSeq: 0 });
    expect(response.statusCode).toBe(409);
    expect(StaleStateError.parse(response.json()).state.eventSeq).toBe(1);
    expect(await countRows(t.db, 'throws')).toBe(1);
    expect(await logEntries(t.db, id)).toHaveLength(1);
  });

  it('rejects a finished match with match_finished', async () => {
    const { id } = await match301(1);
    await throwDarts(t.app, id, LEG_301);
    expectError(await restMiss(t.app, id, { eventId: randomUUID() }), 409, 'match_finished');
    expect(await logEntries(t.db, id)).toHaveLength(LEG_301.length);
  });

  it('rejects a checkout practice with throws_not_allowed', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'checkouts', playerIds: [anna], checkoutRange: '2-50' });
    expectError(await restMiss(t.app, id, { eventId: randomUUID() }), 409, 'throws_not_allowed');
  });

  it('rejects an abandoned match with match_abandoned', async () => {
    const { id } = await match301();
    expect((await abandon(t.app, id, { playerId: anna })).statusCode).toBe(200);
    expectError(await restMiss(t.app, id, { eventId: randomUUID() }), 409, 'match_abandoned');
    expect(await countRows(t.db, 'throws')).toBe(0);
  });

  it('rejects an ended practice with practice_ended', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(t.app, id, [S(20)]);
    expect((await endPractice(t.app, id)).statusCode).toBe(200);
    expectError(await restMiss(t.app, id, { eventId: randomUUID() }), 409, 'practice_ended');
  });

  it('rejects an eventId already used by a normal throw with event_id_conflict', async () => {
    const { id } = await match301();
    const hit = hitEvent(id, S(20));
    expect((await postThrow(t.app, id, hit)).statusCode).toBe(201);
    expectError(await restMiss(t.app, id, { eventId: hit.eventId }), 409, 'event_id_conflict');
    expect(await logEntries(t.db, id)).toHaveLength(1);
  });

  it('rejects an eventId stored for another match with event_id_conflict', async () => {
    const first = await match301();
    const second = await match301();
    const eventId = randomUUID();
    await restMissOk(first.id, { eventId });
    expectError(await restMiss(t.app, second.id, { eventId }), 409, 'event_id_conflict');
    expect(await logEntries(t.db, second.id)).toHaveLength(0);
  });

  it('rejects a missing body and a non-UUID eventId with 400', async () => {
    const { id } = await match301();
    expectError(await t.app.inject({ method: 'POST', url: `/matches/${id}/rest-miss` }), 400, 'invalid_request');
    expectError(await restMiss(t.app, id, { eventId: 'abc' }), 400, 'invalid_request');
    expectError(await restMiss(t.app, id, { eventId: randomUUID(), expectedSeq: -1 }), 400, 'invalid_request');
    expect(await countRows(t.db, 'throws')).toBe(0);
  });

  it('answers an unknown match with a valid body with 404', async () => {
    expectError(await restMiss(t.app, 'nope', { eventId: randomUUID() }), 404, 'not_found');
  });

  it('passes the turn to the next player in a casual game', async () => {
    const { id } = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek, celina], startingScore: 301 });
    await restMissOk(id);
    const result = await restMissOk(id);
    expect(result.events).toMatchObject([{ type: 'turn_completed', playerId: bartek, total: 0 }]);
    expect(result.state.currentPlayerId).toBe(celina);
  });

  it('closes a turn in solo 501', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
    await throwDarts(t.app, id, [T(20), T(20)]);
    const result = await restMissOk(id);
    expect(result.throws).toHaveLength(1);
    expect(result.events).toMatchObject([{ type: 'turn_completed', playerId: anna, total: 120, remaining: 381 }]);
    expect(result.state.currentDarts).toEqual([]);
  });

  it('fills the approach in Free run without domain events', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(t.app, id, [S(20)]);
    const result = await restMissOk(id);
    expect(result.throws).toHaveLength(2);
    expect(result.events).toEqual([]);
    expect(result.state.currentDarts).toEqual([]);
    expect(result.state.freeRun).toMatchObject({ dartsThrown: 3, totalPoints: 20 });
  });
});
