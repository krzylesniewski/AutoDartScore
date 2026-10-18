import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S, T, abandon, createGame, createPlayers, endPractice, getMatch, setup, throwDarts, undo } from './test-helpers.js';

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
      expect(after).toMatchObject({ status: 'ended', freeRun: { dartsThrown: 2, totalPoints: 65 } });
      expect(after.endedAt).not.toBeNull();
    } finally {
      await second.close();
    }
  });
});
