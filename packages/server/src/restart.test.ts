import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S, T, abandon, checkoutAttempt, createGame, createPlayers, endPractice, getMatch, setup, throwDarts, undo } from './test-helpers.js';

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
});
