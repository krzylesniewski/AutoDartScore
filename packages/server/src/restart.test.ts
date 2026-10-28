import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  S,
  T,
  abandon,
  checkoutAttempt,
  checkoutSkip,
  createGame,
  createPlayers,
  endPractice,
  getMatch,
  hitEvent,
  postThrow,
  reviewQueue,
  setup,
  throwDarts,
  undo,
  verifyThrow,
} from './test-helpers.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('restart', () => {
  it('rebuilds the same snapshot from a file database', async () => {
    const path = join(dir, 'games.sqlite');
    const first = await setup({ path });
    const [anna, bartek] = await createPlayers(first.app, 2);
    const { id } = await createGame(first.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    await throwDarts(first.app, id, [T(20), T(20), T(20), S(1), S(2)]);
    expect((await undo(first.app, id)).statusCode).toBe(200);
    const before = await getMatch(first.app, id);
    await first.close();

    const second = await setup({ path });
    try {
      const after = await getMatch(second.app, id);
      expect(after).toEqual(before);
      expect(after).toMatchObject({ eventSeq: 6, currentPlayerId: bartek, currentDarts: [{ segment: 1, multiplier: 1 }] });
    } finally {
      await second.close();
    }
  });

  it('keeps a pending throw pending after reopening the file database', async () => {
    const path = join(dir, 'games.sqlite');
    const first = await setup({ path });
    const [anna, bartek] = await createPlayers(first.app, 2);
    const { id } = await createGame(first.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    await throwDarts(first.app, id, [T(20), T(20), T(20), S(1)]);
    const review = { reason: 'near_wire', candidates: [{ segment: 5, multiplier: 1, probability: 0.48 }], frames: { before: 'a.jpg', after: 'b.jpg' }, tip: { x: 4, y: 2 } };
    const pending = await postThrow(first.app, id, hitEvent(id, S(20), { confidence: 0.4, review } as object));
    expect(pending.statusCode).toBe(201);
    await throwDarts(first.app, id, [S(3)]);
    const before = await getMatch(first.app, id);
    const queue = (await reviewQueue(first.app, id)).json();
    await first.close();

    const second = await setup({ path });
    try {
      const after = await getMatch(second.app, id);
      expect(after).toEqual(before);
      expect(after).toMatchObject({ awaitingReview: true, currentPlayerId: bartek, currentDarts: [{ segment: 1, multiplier: 1 }] });
      expect(after.lastTurnThrows.map((entry) => [entry.status, entry.scoring])).toEqual([
        ['confirmed', 'counted'],
        ['pending', 'waiting'],
        ['confirmed', 'waiting'],
      ]);
      expect((await reviewQueue(second.app, id)).json()).toEqual(queue);

      const verified = await verifyThrow(second.app, id, pending.json().throw.id, S(5));
      expect(verified.statusCode).toBe(200);
      expect(verified.json().events).toMatchObject([{ type: 'turn_completed', playerId: bartek, total: 9 }]);
    } finally {
      await second.close();
    }
  });

  it('keeps an abandoned game abandoned after reopening the file database', async () => {
    const path = join(dir, 'games.sqlite');
    const first = await setup({ path });
    const [anna, bartek] = await createPlayers(first.app, 2);
    const { id } = await createGame(first.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    await throwDarts(first.app, id, [T(20)]);
    expect((await abandon(first.app, id, { playerId: bartek, reason: 'koniec wieczoru' })).statusCode).toBe(200);
    const before = await getMatch(first.app, id);
    await first.close();

    const second = await setup({ path });
    try {
      const after = await getMatch(second.app, id);
      expect(after).toEqual(before);
      expect(after).toMatchObject({ status: 'abandoned', abandonment: { playerId: bartek, reason: 'koniec wieczoru' } });
    } finally {
      await second.close();
    }
  });

  it('keeps an ended practice session ended after reopening the file database', async () => {
    const path = join(dir, 'games.sqlite');
    const first = await setup({ path });
    const [anna] = await createPlayers(first.app, 1);
    const { id } = await createGame(first.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(first.app, id, [T(20), S(5)]);
    expect((await endPractice(first.app, id)).statusCode).toBe(200);
    const before = await getMatch(first.app, id);
    await first.close();

    const second = await setup({ path });
    try {
      const after = await getMatch(second.app, id);
      expect(after).toEqual(before);
      expect(after).toMatchObject({ status: 'ended', freeRun: { dartsThrown: 2, totalPoints: 65 }, checkouts: null });
      expect(after.endedAt).not.toBeNull();
    } finally {
      await second.close();
    }
  });

  it('keeps the checkout targets and history after reopening the file database with another random()', async () => {
    const path = join(dir, 'games.sqlite');
    const first = await setup({ path, random: () => 0.123 });
    const [anna] = await createPlayers(first.app, 1);
    const { id } = await createGame(first.app, { type: 'practice', practiceMode: 'checkouts', playerIds: [anna], checkoutRange: '51-100' });
    for (const success of [true, false, true]) {
      expect((await checkoutAttempt(first.app, id, success)).statusCode).toBe(201);
    }
    expect((await undo(first.app, id)).statusCode).toBe(200);
    expect((await checkoutAttempt(first.app, id, false)).statusCode).toBe(201);
    const before = await getMatch(first.app, id);
    await first.close();

    const second = await setup({ path, random: () => 0.987 });
    try {
      const after = await getMatch(second.app, id);
      expect(after).toEqual(before);
      expect(after.checkouts).toMatchObject({ range: '51-100', attempts: 3, successes: 1 });
      expect(after.checkouts?.history.map((attempt) => attempt.success)).toEqual([true, false, false]);
    } finally {
      await second.close();
    }
  });

  it('keeps the checkout attempts, skips and undos after reopening the file database', async () => {
    const path = join(dir, 'games.sqlite');
    const first = await setup({ path, random: () => 0.456 });
    const [anna] = await createPlayers(first.app, 1);
    const { id } = await createGame(first.app, { type: 'practice', practiceMode: 'checkouts', playerIds: [anna], checkoutRange: '2-50' });
    const steps = [
      () => checkoutAttempt(first.app, id, false),
      () => checkoutSkip(first.app, id),
      () => checkoutAttempt(first.app, id, true),
      () => checkoutSkip(first.app, id),
      () => undo(first.app, id),
      () => checkoutAttempt(first.app, id, false),
      () => undo(first.app, id),
      () => checkoutSkip(first.app, id),
      () => checkoutAttempt(first.app, id, false),
    ];
    for (const step of steps) {
      expect((await step()).statusCode).toBeLessThan(300);
    }
    const before = await getMatch(first.app, id);
    await first.close();

    const second = await setup({ path, random: () => 0.987 });
    try {
      const after = await getMatch(second.app, id);
      expect(after).toEqual(before);
      expect(after.checkouts).toMatchObject({ range: '2-50', attempts: 3, successes: 1, skips: 2 });
      expect(after.checkouts?.history.map((attempt) => attempt.success)).toEqual([false, true, false]);
    } finally {
      await second.close();
    }
  });
});
