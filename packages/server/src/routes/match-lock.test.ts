import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError, MatchSnapshot, ThrowResult, UndoResult } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D, LEG_301, S, T, countRows, createGame, createPlayers, getMatch, setup, throwDarts, undo, type Dart, type TestApp } from '../test-helpers.js';

const FINISH = '2026-10-21T20:00:00.000Z';

// Solo 501 w trzech turach: 180, 180 i 141 (T20, T19, D12).
const SOLO_501: readonly Dart[] = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];

let t: TestApp | null = null;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(FINISH);
});
afterEach(async () => {
  await t?.close();
  t = null;
  vi.useRealTimers();
});

function at(time: string): void {
  vi.setSystemTime(new Date(time));
}

function after(minutes: number, seconds = 0, base = FINISH): string {
  return new Date(Date.parse(base) + (minutes * 60 + seconds) * 1000).toISOString();
}

async function start(options: Parameters<typeof setup>[0] = {}): Promise<TestApp> {
  t = await setup(options);
  return t;
}

async function finish(app: TestApp, game: object, darts: readonly Dart[]): Promise<{ id: string; state: MatchSnapshot }> {
  const { id } = await createGame(app.app, game);
  const results = await throwDarts(app.app, id, darts);
  const state = ThrowResult.parse(results.at(-1)).state;
  expect(state.finished).toBe(true);
  return { id, state };
}

async function finishMatch(app: TestApp) {
  const [anna, bartek] = await createPlayers(app.app, 2);
  return finish(app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 }, LEG_301);
}

async function expectLocked(app: TestApp, id: string): Promise<void> {
  const rows = await countRows(app.db, 'match_events');
  const response = await undo(app.app, id);
  expect(response.statusCode).toBe(409);
  expect(ApiError.parse(response.json()).error).toBe('match_locked');
  expect(await countRows(app.db, 'match_events')).toBe(rows);
  expect((await getMatch(app.app, id)).finished).toBe(true);
}

describe('match lock', () => {
  it('opens a five minute window after the finishing dart of a 1v1 match', async () => {
    const app = await start();
    const { id, state } = await finishMatch(app);
    expect(state).toMatchObject({ finishedAt: FINISH, editableUntil: after(5) });
    expect(await getMatch(app.app, id)).toMatchObject({ finishedAt: FINISH, editableUntil: after(5) });
  });

  it('undoes at 4:59, starts the window again on a new finish and locks at exactly 5:00', async () => {
    const app = await start();
    const { id } = await finishMatch(app);

    at(after(4, 59));
    const response = await undo(app.app, id);
    expect(response.statusCode).toBe(200);
    expect(UndoResult.parse(response.json()).state).toMatchObject({ status: 'in_progress', finishedAt: null, editableUntil: null });

    const refinished = after(4, 59);
    const [last] = await throwDarts(app.app, id, [D(5)]);
    const result = ThrowResult.parse(last);
    expect(result.throw.receivedAt).toBe(refinished);
    expect(result.state).toMatchObject({ finished: true, finishedAt: refinished, editableUntil: after(5, 0, refinished) });

    at(after(5, 0, refinished));
    await expectLocked(app, id);
  });

  it('locks a casual game after five minutes and allows undo before', async () => {
    const app = await start();
    const [anna, bartek] = await createPlayers(app.app, 2);
    const game = { type: 'casual', playerIds: [anna, bartek], startingScore: 301 };
    const open = await finish(app, game, LEG_301);
    expect(open.state).toMatchObject({ finishedAt: FINISH, editableUntil: after(5) });

    at(after(4, 59));
    expect((await undo(app.app, open.id)).statusCode).toBe(200);

    at(FINISH);
    const closed = await finish(app, game, LEG_301);
    at(after(5));
    await expectLocked(app, closed.id);
  });

  it('locks a Solo 501 after five minutes and allows undo before', async () => {
    const app = await start();
    const [anna] = await createPlayers(app.app, 1);
    const game = { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] };
    const open = await finish(app, game, SOLO_501);
    expect(open.state).toMatchObject({ finishedAt: FINISH, editableUntil: after(5) });

    at(after(4, 59));
    expect((await undo(app.app, open.id)).statusCode).toBe(200);

    at(FINISH);
    const closed = await finish(app, game, SOLO_501);
    at(after(5));
    await expectLocked(app, closed.id);
  });

  it('locks right after the finishing dart with matchLockMinutes 0', async () => {
    const app = await start({ matchLockMinutes: 0 });
    const { id, state } = await finishMatch(app);
    expect(state).toMatchObject({ finishedAt: FINISH, editableUntil: FINISH });
    await expectLocked(app, id);
  });

  it('keeps both fields null in a game in progress and undoes hours later', async () => {
    const app = await start();
    const [anna, bartek] = await createPlayers(app.app, 2);
    const { id } = await createGame(app.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    const [first] = await throwDarts(app.app, id, [S(20), T(20)]);
    expect(ThrowResult.parse(first).state).toMatchObject({ finishedAt: null, editableUntil: null });

    at(after(180));
    const response = await undo(app.app, id);
    expect(response.statusCode).toBe(200);
    expect(UndoResult.parse(response.json()).state).toMatchObject({ finished: false, finishedAt: null, editableUntil: null });
  });

  describe('after a restart', () => {
    let dir: string;
    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
    });
    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('keeps finishedAt and the lock', async () => {
      const path = join(dir, 'games.sqlite');
      const first = await setup({ path });
      const { id } = await finishMatch(first);
      await first.close();

      const second = await start({ path });
      expect(await getMatch(second.app, id)).toMatchObject({ finished: true, finishedAt: FINISH, editableUntil: after(5) });
      at(after(5));
      await expectLocked(second, id);
    });
  });
});
