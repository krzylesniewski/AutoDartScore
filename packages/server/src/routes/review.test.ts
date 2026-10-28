import { ApiError, LiveMessage, ReviewQueue, ReviewResult, ThrowResult, UndoResult, type HitEvent } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  D,
  LEG_301,
  MISS,
  S,
  T,
  abandon,
  countRows,
  createGame,
  createPlayers,
  endPractice,
  flagThrow,
  getMatch,
  hitEvent,
  postThrow,
  reviewQueue,
  setup,
  throwDarts,
  undo,
  verifyThrow,
  type Dart,
  type TestApp,
} from '../test-helpers.js';

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  terminate(): void;
}

let t: TestApp;
const sockets: TestSocket[] = [];
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.terminate();
  }
  await t.close();
  vi.useRealTimers();
});

async function subscribe(matchId: string): Promise<unknown[]> {
  const messages: unknown[] = [];
  const socket: TestSocket = await t.app.injectWS(`/matches/${matchId}/live`, {}, {
    onInit(ws: TestSocket) {
      ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
    },
  });
  sockets.push(socket);
  await vi.waitFor(() => expect(messages).toHaveLength(1));
  messages.length = 0;
  return messages;
}

async function received(messages: unknown[], count: number): Promise<LiveMessage[]> {
  await vi.waitFor(() => expect(messages.length).toBeGreaterThanOrEqual(count));
  return messages.splice(0).map((message) => LiveMessage.parse(message));
}

// Aplikacja bierze zegar przy starcie, więc po podmianie Date startuje od nowa.
async function useFakeDate(time: string): Promise<void> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(time));
  await t.close();
  t = await setup();
}

async function match301() {
  const [anna = '', bartek = ''] = await createPlayers(t.app, 2);
  const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
  return { id, anna, bartek };
}

async function post(matchId: string, dart: Dart, overrides: Partial<HitEvent> = {}) {
  const response = await postThrow(t.app, matchId, hitEvent(matchId, dart, overrides));
  expect(response.statusCode).toBe(201);
  return ThrowResult.parse(response.json());
}

async function postPending(matchId: string, dart: Dart, overrides: Partial<HitEvent> = {}) {
  return post(matchId, dart, { confidence: 0.5, ...overrides });
}

async function verify(matchId: string, throwId: string, dart: Dart) {
  const response = await verifyThrow(t.app, matchId, throwId, dart);
  expect(response.statusCode).toBe(200);
  return ReviewResult.parse(response.json());
}

async function flag(matchId: string, throwId: string) {
  const response = await flagThrow(t.app, matchId, throwId);
  expect(response.statusCode).toBe(200);
  return ReviewResult.parse(response.json());
}

async function expectError(response: { statusCode: number; json(): unknown }, statusCode: number, code: string) {
  expect(response.statusCode).toBe(statusCode);
  expect(ApiError.parse(response.json()).error).toBe(code);
}

async function reviewEntries(matchId: string) {
  return t.db
    .selectFrom('match_events')
    .select(['seq', 'type', 'throw_id', 'reason', 'actor', 'segment', 'multiplier'])
    .where('match_id', '=', matchId)
    .where('type', 'in', ['throw_flagged', 'throw_verified'])
    .orderBy('seq')
    .execute();
}

describe('pending throws', () => {
  it('holds a throw below the default threshold of 0.8 and counts one at 0.8', async () => {
    const { id } = await match301();
    const confirmed = await post(id, T(20), { confidence: 0.8 });
    expect(confirmed.state.awaitingReview).toBe(false);
    expect(confirmed.state.lastTurnThrows.map((entry) => [entry.status, entry.scoring])).toEqual([['confirmed', 'counted']]);

    const pending = await post(id, T(20), { confidence: 0.79 });
    expect(pending.events).toEqual([]);
    expect(pending.state.awaitingReview).toBe(true);
    expect(pending.state.currentDarts).toEqual([{ segment: 20, multiplier: 3 }]);
    expect(pending.state.lastTurnThrows.map((entry) => [entry.status, entry.scoring])).toEqual([
      ['confirmed', 'counted'],
      ['pending', 'waiting'],
    ]);
  });

  it('uses a custom pendingConfidence', async () => {
    await t.close();
    t = await setup({ pendingConfidence: 0.5 });
    const { id } = await match301();
    expect((await post(id, T(20), { confidence: 0.6 })).state.awaitingReview).toBe(false);
    expect((await post(id, T(20), { confidence: 0.49 })).state.awaitingReview).toBe(true);
  });

  it('keeps the turn open for a hit with confidence 0.5 until it is verified', async () => {
    const { id, anna } = await match301();
    const messages = await subscribe(id);

    const pending = await postPending(id, T(20));
    expect(pending.events).toEqual([]);
    expect(pending.state).toMatchObject({ awaitingReview: true, currentPlayerId: anna, currentDarts: [] });
    expect(await reviewEntries(id)).toEqual([
      { seq: 2, type: 'throw_flagged', throw_id: pending.throw.id, reason: 'low_confidence', actor: 'system', segment: null, multiplier: null },
    ]);
    const first = await received(messages, 3);
    expect(first.map((message) => message.type)).toEqual(['throw_registered', 'throw_flagged', 'state_updated']);
    expect(first.every((message) => message.eventSeq === 2)).toBe(true);
    expect(first[1]).toMatchObject({ throw: { id: pending.throw.id, status: 'pending', scoring: 'waiting' } });

    for (const dart of [T(20), T(20)]) {
      const waiting = await post(id, dart);
      expect(waiting.events).toEqual([]);
      expect(waiting.state.currentDarts).toEqual([]);
      expect((await received(messages, 2)).map((message) => message.type)).toEqual(['throw_registered', 'state_updated']);
    }

    const verified = await verify(id, pending.throw.id, T(20));
    expect(verified.events).toEqual([
      { type: 'turn_completed', playerId: anna, legIndex: 0, turnIndex: 0, darts: [T(20), T(20), T(20)].map(([segment, multiplier]) => ({ segment, multiplier })), total: 180, remaining: 121 },
    ]);
    expect(verified.throw).toMatchObject({ status: 'confirmed', scoring: 'counted', review: { reason: 'low_confidence', flaggedBy: 'system', resolved: { segment: 20, multiplier: 3, by: 'player' } } });
    expect(verified.state).toMatchObject({ awaitingReview: false, turnIndex: 1 });
    const last = await received(messages, 3);
    expect(last.map((message) => message.type)).toEqual(['throw_verified', 'turn_completed', 'state_updated']);
    expect(last.every((message) => message.eventSeq === 5)).toBe(true);
    expect(last.at(-1)).toMatchObject({ state: verified.state });
  });

  it('takes the reason, candidates, frames and tip from the review the hit carried', async () => {
    const { id } = await match301();
    const review = {
      reason: 'near_wire' as const,
      candidates: [
        { segment: 5, multiplier: 1 as const, probability: 0.48 },
        { segment: 20, multiplier: 1 as const, probability: 0.45 },
      ],
      frames: { before: 'session-01/0042-before.jpg', after: 'session-01/0042-after.jpg' },
      tip: { x: 412, y: 238 },
    };
    const pending = await postPending(id, S(20), { review } as Partial<HitEvent>);
    expect(pending.throw.review).toEqual(review);
    expect(pending.state.lastTurnThrows[0]?.review).toEqual({ ...review, flaggedBy: 'system', resolved: null });
    expect((await reviewEntries(id))[0]).toMatchObject({ reason: 'near_wire', actor: 'system' });

    const plain = await postPending(id, S(1));
    expect(plain.throw).not.toHaveProperty('review');
    expect(plain.state.lastTurnThrows[1]?.review).toEqual({ reason: 'low_confidence', flaggedBy: 'system', candidates: [], resolved: null });
  });

  it('stores the review of a confident hit without flagging it', async () => {
    const { id } = await match301();
    const result = await post(id, S(20), { confidence: 0.9, review: { reason: 'occlusion', candidates: [] } });
    expect(result.throw.review).toEqual({ reason: 'occlusion', candidates: [] });
    expect(result.state.lastTurnThrows).toMatchObject([{ status: 'confirmed', scoring: 'counted', review: null }]);
    expect(await reviewEntries(id)).toEqual([]);
    expect((await getMatch(t.app, id)).currentDarts).toEqual([{ segment: 20, multiplier: 1 }]);
  });

  it('writes and flags nothing on an idempotent resend of a pending hit', async () => {
    const { id } = await match301();
    const hit = hitEvent(id, S(20), { confidence: 0.3, review: { reason: 'occlusion', candidates: [{ segment: 20, multiplier: 1, probability: 0.3 }] } });
    const first = await postThrow(t.app, id, hit);
    expect(first.statusCode).toBe(201);
    const rows = await countRows(t.db, 'match_events');

    const again = await postThrow(t.app, id, hit);
    expect(again.statusCode).toBe(200);
    expect(again.json().throw).toEqual(first.json().throw);
    expect(again.json().throw.review).toEqual({ reason: 'occlusion', candidates: [{ segment: 20, multiplier: 1, probability: 0.3 }] });
    expect(again.json().events).toEqual([]);
    expect(await countRows(t.db, 'match_events')).toBe(rows);
  });

  it('rejects a 4th dart while the turn waits and writes nothing', async () => {
    const { id } = await match301();
    await postPending(id, S(20));
    await throwDarts(t.app, id, [S(1), S(1)]);
    const rows = await countRows(t.db, 'match_events');
    const throws = await countRows(t.db, 'throws');
    await expectError(await postThrow(t.app, id, hitEvent(id, S(1))), 409, 'turn_pending');
    expect(await countRows(t.db, 'match_events')).toBe(rows);
    expect(await countRows(t.db, 'throws')).toBe(throws);
  });

  it('keeps the stats unchanged while throws wait', async () => {
    const { id, anna, bartek } = await match301();
    await throwDarts(t.app, id, [T(20), T(20), T(20), MISS, MISS, MISS]);
    const stats = async (playerId: string) => (await t.app.inject({ method: 'GET', url: `/players/${playerId}/stats` })).json();
    const before = [await stats(anna), await stats(bartek)];

    await postPending(id, T(20));
    await throwDarts(t.app, id, [T(20), T(20)]);
    expect([await stats(anna), await stats(bartek)]).toEqual(before);
  });
});

describe('POST /matches/:id/throws/:throwId/flag', () => {
  it('flags a counted throw of the current turn and takes it out of the game', async () => {
    const { id } = await match301();
    const [first] = await throwDarts(t.app, id, [S(20), S(19)]);
    const messages = await subscribe(id);

    const result = await flag(id, first.throw.id);
    expect(result.events).toEqual([]);
    expect(result.throw).toMatchObject({
      id: first.throw.id,
      status: 'pending',
      scoring: 'waiting',
      review: { reason: 'manual', flaggedBy: 'player', candidates: [], resolved: null },
    });
    expect(result.state).toMatchObject({ awaitingReview: true, currentDarts: [], eventSeq: 3 });
    expect(result.state.players[0]?.remaining).toBe(301);
    expect(result.state.lastTurnThrows.map((entry) => [entry.status, entry.scoring])).toEqual([
      ['pending', 'waiting'],
      ['confirmed', 'waiting'],
    ]);
    expect(await reviewEntries(id)).toEqual([
      { seq: 3, type: 'throw_flagged', throw_id: first.throw.id, reason: 'manual', actor: 'player', segment: null, multiplier: null },
    ]);
    const live = await received(messages, 2);
    expect(live.map((message) => message.type)).toEqual(['throw_flagged', 'state_updated']);
    expect(live.every((message) => message.eventSeq === 3)).toBe(true);
  });

  it('ignores a request body', async () => {
    const { id } = await match301();
    const [thrown] = await throwDarts(t.app, id, [S(20)]);
    const response = await t.app.inject({
      method: 'POST',
      url: `/matches/${id}/throws/${thrown.throw.id}/flag`,
      headers: { 'content-type': 'application/json' },
      payload: '{broken',
    });
    expect(response.statusCode).toBe(200);
  });

  it('reopens a finished game inside the lock window and gives match_locked after it', async () => {
    await useFakeDate('2026-10-21T20:00:00.000Z');
    const { id } = await match301();
    const results = await throwDarts(t.app, id, LEG_301);
    const winning = results.at(-1).throw.id;

    vi.setSystemTime(new Date('2026-10-21T20:04:59.999Z'));
    const reopened = await flag(id, winning);
    expect(reopened.state).toMatchObject({ finished: false, status: 'in_progress', winnerId: null, finishedAt: null, editableUntil: null, awaitingReview: true });

    vi.setSystemTime(new Date('2026-10-21T20:06:00.000Z'));
    const verified = await verify(id, winning, D(5));
    expect(verified.events.map((event) => event.type)).toEqual(['turn_completed', 'leg_won', 'match_won']);
    expect(verified.state).toMatchObject({ finished: true, finishedAt: '2026-10-21T20:06:00.000Z', editableUntil: '2026-10-21T20:11:00.000Z' });

    vi.setSystemTime(new Date('2026-10-21T20:11:00.000Z'));
    const rows = await countRows(t.db, 'match_events');
    await expectError(await flagThrow(t.app, id, winning), 409, 'match_locked');
    await expectError(await verifyThrow(t.app, id, winning, D(5)), 409, 'match_locked');
    expect(await countRows(t.db, 'match_events')).toBe(rows);
    expect((await getMatch(t.app, id)).finished).toBe(true);
  });

  it.each([
    ['an earlier turn', async (id: string) => (await throwDarts(t.app, id, [S(1), S(1), S(1), S(2)]))[0].throw.id],
    [
      'an undone throw',
      async (id: string) => {
        const [thrown] = await throwDarts(t.app, id, [S(1)]);
        expect((await undo(t.app, id)).statusCode).toBe(200);
        return thrown.throw.id;
      },
    ],
  ])('gives throw_not_flaggable for a throw of %s', async (_name, prepare) => {
    const { id } = await match301();
    const throwId = await prepare(id);
    await expectError(await flagThrow(t.app, id, throwId), 409, 'throw_not_flaggable');
  });

  it('gives throw_already_pending for a pending throw', async () => {
    const { id } = await match301();
    const pending = await postPending(id, S(1));
    const rows = await countRows(t.db, 'match_events');
    await expectError(await flagThrow(t.app, id, pending.throw.id), 409, 'throw_already_pending');
    expect(await countRows(t.db, 'match_events')).toBe(rows);
  });
});

describe('POST /matches/:id/throws/:throwId/verify', () => {
  it('keeps the reading and updates the value and the resolution on a correction', async () => {
    await useFakeDate('2026-10-21T20:00:00.000Z');
    const { id } = await match301();
    const pending = await postPending(id, T(20));
    await throwDarts(t.app, id, [T(20), T(20)]);

    vi.setSystemTime(new Date('2026-10-21T20:00:30.000Z'));
    const result = await verify(id, pending.throw.id, S(20));
    expect(result.throw).toMatchObject({
      reading: { segment: 20, multiplier: 3 },
      value: { segment: 20, multiplier: 1 },
      status: 'confirmed',
      scoring: 'counted',
      review: { resolved: { segment: 20, multiplier: 1, by: 'player', at: '2026-10-21T20:00:30.000Z' } },
    });
    expect(result.events).toMatchObject([{ type: 'turn_completed', total: 140, remaining: 161 }]);
    expect(await reviewEntries(id)).toMatchObject([
      { type: 'throw_flagged', throw_id: pending.throw.id },
      { type: 'throw_verified', throw_id: pending.throw.id, actor: 'player', segment: 20, multiplier: 1 },
    ]);
    const stored = await t.db.selectFrom('throws').select(['segment', 'multiplier']).where('id', '=', pending.throw.id).executeTakeFirstOrThrow();
    expect(stored).toEqual({ segment: 20, multiplier: 3 });
  });

  it('voids the waiting darts when the correction busts and passes the turn on', async () => {
    const { id, bartek } = await match301();
    await throwDarts(t.app, id, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(13), S(2), MISS, MISS, MISS]);
    const pending = await postPending(id, D(10));
    await throwDarts(t.app, id, [S(5)]);
    const result = await verify(id, pending.throw.id, S(20));
    expect(result.events).toMatchObject([{ type: 'bust', remaining: 20 }]);
    expect(result.state).toMatchObject({ currentPlayerId: bartek, awaitingReview: false });
    expect(result.state.lastTurnThrows.map((entry) => entry.scoring)).toEqual(['counted', 'void']);
  });

  it('rejects an invalid body with invalid_request', async () => {
    const { id } = await match301();
    const pending = await postPending(id, S(1));
    await expectError(
      await t.app.inject({ method: 'POST', url: `/matches/${id}/throws/${pending.throw.id}/verify`, payload: { segment: 25, multiplier: 3 } }),
      400,
      'invalid_request',
    );
  });

  it('gives throw_not_pending for a counted throw', async () => {
    const { id } = await match301();
    const [thrown] = await throwDarts(t.app, id, [S(1)]);
    await expectError(await verifyThrow(t.app, id, thrown.throw.id, S(2)), 409, 'throw_not_pending');
  });
});

describe('flag and verify checks', () => {
  const commands = [
    ['flag', (matchId: string, throwId: string) => flagThrow(t.app, matchId, throwId)],
    ['verify', (matchId: string, throwId: string) => verifyThrow(t.app, matchId, throwId, S(1))],
  ] as const;

  it.each(commands)('%s gives 404 for an unknown match, an unknown throw and a throw of another match', async (_name, command) => {
    const { id } = await match301();
    const other = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [(await getMatch(t.app, id)).players[0]?.id] });
    const [foreign] = await throwDarts(t.app, other.id, [S(1)]);
    await expectError(await command('nope', foreign.throw.id), 404, 'not_found');
    await expectError(await command(id, 'nope'), 404, 'not_found');
    await expectError(await command(id, foreign.throw.id), 404, 'not_found');
  });

  it.each(commands)('%s gives throws_not_allowed in checkout practice', async (_name, command) => {
    const [anna] = await createPlayers(t.app, 1);
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'checkouts', playerIds: [anna], checkoutRange: '2-50' });
    await expectError(await command(id, 'any'), 409, 'throws_not_allowed');
  });

  it.each(commands)('%s gives practice_ended after the practice ended', async (_name, command) => {
    const [anna] = await createPlayers(t.app, 1);
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    const pending = await postPending(id, S(1));
    expect((await endPractice(t.app, id)).statusCode).toBe(200);
    await expectError(await command(id, pending.throw.id), 409, 'practice_ended');
  });

  it.each(commands)('%s gives match_abandoned in an abandoned match', async (_name, command) => {
    const { id, anna } = await match301();
    const pending = await postPending(id, S(1));
    expect((await abandon(t.app, id, { playerId: anna })).statusCode).toBe(200);
    await expectError(await command(id, pending.throw.id), 409, 'match_abandoned');
  });
});

describe('GET /matches/:id/review-queue', () => {
  it('lists the pending throws in log order before and after a verification', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(5)]);
    const first = await postPending(id, S(1));
    const second = await postPending(id, S(2));

    const before = await reviewQueue(t.app, id);
    expect(before.statusCode).toBe(200);
    const queue = ReviewQueue.parse(before.json());
    expect(queue).toMatchObject({ matchId: id, eventSeq: 5 });
    expect(queue.throws.map((entry) => entry.id)).toEqual([first.throw.id, second.throw.id]);

    await verify(id, first.throw.id, S(1));
    const after = ReviewQueue.parse((await reviewQueue(t.app, id)).json());
    expect(after.eventSeq).toBe(6);
    expect(after.throws.map((entry) => entry.id)).toEqual([second.throw.id]);
  });

  it('gives 404 for an unknown match', async () => {
    await expectError(await reviewQueue(t.app, 'nope'), 404, 'not_found');
  });
});

describe('undo with pending throws', () => {
  it('removes a pending throw without domain events', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(20), S(20)]);
    const pending = await postPending(id, S(20));
    const messages = await subscribe(id);

    const response = await undo(t.app, id);
    expect(response.statusCode).toBe(200);
    const result = UndoResult.parse(response.json());
    expect(result.undoneThrowId).toBe(pending.throw.id);
    expect(result.state).toMatchObject({ awaitingReview: false, currentDarts: [S(20), S(20)].map(([segment, multiplier]) => ({ segment, multiplier })) });
    expect((await received(messages, 2)).map((message) => message.type)).toEqual(['throw_undone', 'state_updated']);
    expect(ReviewQueue.parse((await reviewQueue(t.app, id)).json()).throws).toEqual([]);
  });
});
