import { MatchSnapshot, MatchSummary, ThrowResult, UndoResult } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D, LEG_301, MISS, S, T, abandon, createGame, createPlayers, getMatch, resume, setup, throwDarts, undo, type Dart, type TestApp } from '../test-helpers.js';

const START = '2026-10-21T18:00:00.000Z';

const NO_TIMES = { startedAt: null, legStartedAt: null, pausedMs: 0, legPausedMs: 0 };

let t: TestApp;
let anna: string;
let bartek: string;
let celina: string;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(0);
  t = await setup();
  [anna, bartek, celina] = (await createPlayers(t.app, 3)) as [string, string, string];
});
afterEach(async () => {
  await t.close();
  vi.useRealTimers();
});

// Chwila START + seconds jako tekst ISO, tak jak serwer zapisuje receivedAt i createdAt.
function time(seconds: number): string {
  return new Date(Date.parse(START) + seconds * 1000).toISOString();
}

function at(seconds: number): void {
  vi.setSystemTime(new Date(time(seconds)));
}

function match301(bestOf = 3) {
  return createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf });
}

// Wszystkie rzutki w tej samej chwili. Zwraca stan z odpowiedzi na ostatnią z nich.
async function throwAt(seconds: number, id: string, darts: readonly Dart[]): Promise<MatchSnapshot> {
  at(seconds);
  const results = await throwDarts(t.app, id, darts);
  return ThrowResult.parse(results.at(-1)).state;
}

async function undoAt(seconds: number, id: string): Promise<MatchSnapshot> {
  at(seconds);
  const response = await undo(t.app, id);
  expect(response.statusCode).toBe(200);
  return UndoResult.parse(response.json()).state;
}

async function pause(id: string, from: number, to: number | null): Promise<void> {
  at(from);
  expect((await abandon(t.app, id, { playerId: anna })).statusCode).toBe(200);
  if (to !== null) {
    at(to);
    expect((await resume(t.app, id)).statusCode).toBe(200);
  }
}

async function legs(id: string): Promise<MatchSummary['legs']> {
  const response = await t.app.inject({ method: 'GET', url: `/matches/${id}/summary` });
  expect(response.statusCode).toBe(200);
  return MatchSummary.parse(response.json()).legs;
}

const durations = async (id: string) => (await legs(id)).map(({ legIndex, durationMs }) => ({ legIndex, durationMs }));

describe('round and game times', () => {
  it('starts a new game at round 1 without times', async () => {
    const created = await match301();
    expect(created).toMatchObject({ round: 1, ...NO_TIMES });
    expect(await getMatch(t.app, created.id)).toMatchObject({ round: 1, ...NO_TIMES });
  });

  it('counts rounds in a 1v1, a bust too, and starts leg 2 at round 1', async () => {
    const { id } = await match301();
    expect(await throwAt(10, id, [T(20)])).toMatchObject({ round: 1, startedAt: time(10), legStartedAt: time(10) });
    expect(await throwAt(11, id, [T(20), T(20)])).toMatchObject({ currentPlayerId: bartek, round: 1 });
    expect(await throwAt(20, id, [MISS, MISS, MISS])).toMatchObject({ currentPlayerId: anna, round: 2 });
    // Ze 121 dwa razy T20 zostawia 1, więc bust po dwóch rzutkach.
    expect(await throwAt(30, id, [T(20), T(20)])).toMatchObject({ currentPlayerId: bartek, round: 2 });
    expect(await throwAt(40, id, [MISS, MISS, MISS])).toMatchObject({ currentPlayerId: anna, round: 3 });

    const legTwo = await throwAt(50, id, [T(20), T(17), D(5)]);
    expect(legTwo).toMatchObject({ legIndex: 1, currentPlayerId: bartek, round: 1, startedAt: time(10), legStartedAt: null });
    expect(await throwAt(100, id, [S(1)])).toMatchObject({ legIndex: 1, round: 1, startedAt: time(10), legStartedAt: time(100) });
    expect(await throwAt(101, id, [S(1), S(1)])).toMatchObject({ currentPlayerId: anna, round: 1 });
  });

  it('has no round in a finished match and keeps the start of the last leg', async () => {
    const { id } = await match301(1);
    const finished = await throwAt(10, id, LEG_301);
    expect(finished).toMatchObject({ finished: true, round: null, startedAt: time(10), legStartedAt: time(10), finishedAt: time(10) });
  });

  it('moves the leg start back and forth on undo', async () => {
    const { id } = await match301();
    await throwAt(10, id, LEG_301.slice(0, 3));
    await throwAt(20, id, LEG_301.slice(3));
    await throwAt(100, id, [S(1)]);

    expect(await undoAt(110, id)).toMatchObject({ legIndex: 1, round: 1, startedAt: time(10), legStartedAt: null });
    expect(await undoAt(120, id)).toMatchObject({ legIndex: 0, round: 2, startedAt: time(10), legStartedAt: time(10) });
    expect(await getMatch(t.app, id)).toMatchObject({ legIndex: 0, legStartedAt: time(10) });
  });

  it('clears the game start on undo of the only throw', async () => {
    const { id } = await match301();
    await throwAt(10, id, [S(20)]);
    expect(await undoAt(20, id)).toMatchObject({ round: 1, ...NO_TIMES });
  });

  it('sums closed pauses and leaves out an open abandonment', async () => {
    const { id } = await match301();
    await throwAt(10, id, [S(1)]);
    await pause(id, 100, 160);
    await pause(id, 200, 230);
    expect(await getMatch(t.app, id)).toMatchObject({ pausedMs: 90_000, legPausedMs: 90_000 });

    await pause(id, 300, null);
    at(1000);
    expect(await getMatch(t.app, id)).toMatchObject({ status: 'abandoned', round: 1, pausedMs: 90_000, legPausedMs: 90_000 });

    at(400);
    expect((await resume(t.app, id)).statusCode).toBe(200);
    expect(await throwAt(500, id, [S(1)])).toMatchObject({ pausedMs: 190_000, legPausedMs: 190_000 });
  });

  it('leaves a pause before the first throw of a leg out of the leg and one before the game out of both', async () => {
    const { id } = await match301();
    await pause(id, 0, 50);
    expect(await throwAt(60, id, LEG_301)).toMatchObject({ legIndex: 1, startedAt: time(60), legStartedAt: null, pausedMs: 0, legPausedMs: 0 });

    await pause(id, 100, 160);
    expect(await getMatch(t.app, id)).toMatchObject({ pausedMs: 60_000, legPausedMs: 0 });
    expect(await throwAt(200, id, [S(1)])).toMatchObject({ legStartedAt: time(200), pausedMs: 60_000, legPausedMs: 0 });
  });

  it('counts rounds per player in a casual game after a player drops out', async () => {
    const { id } = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek, celina], startingScore: 301 });
    await throwAt(10, id, [T(20), T(20), T(20), MISS, MISS, MISS, MISS, MISS, MISS]);
    const out = await throwAt(20, id, [T(20), T(17), D(5)]);
    expect(out.placements).toEqual([{ playerId: anna, place: 1 }]);
    expect(out).toMatchObject({ currentPlayerId: bartek, round: 2, startedAt: time(10), legStartedAt: time(10) });
    expect(await throwAt(30, id, [MISS, MISS, MISS])).toMatchObject({ currentPlayerId: celina, round: 2 });
    expect(await throwAt(40, id, [MISS, MISS, MISS])).toMatchObject({ currentPlayerId: bartek, round: 3 });
  });

  it('counts Solo 501 turns and has no round after the checkout', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
    expect(await throwAt(10, id, [T(20), T(20), T(20)])).toMatchObject({ round: 2, startedAt: time(10), legStartedAt: time(10) });
    expect(await throwAt(20, id, [T(20), T(20), T(20)])).toMatchObject({ round: 3 });
    expect(await throwAt(30, id, [T(20), T(19), D(12)])).toMatchObject({ finished: true, round: null, legStartedAt: time(10) });
  });

  it('has no round in Free run and starts the leg with the session', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    expect(await getMatch(t.app, id)).toMatchObject({ round: null, ...NO_TIMES });
    await throwAt(10, id, [S(20)]);
    await pause(id, 20, 50);
    expect(await throwAt(60, id, [S(1), S(1), S(1)])).toMatchObject({ round: null, startedAt: time(10), legStartedAt: time(10), pausedMs: 30_000, legPausedMs: 30_000 });
  });

  it('returns the same state from a throw as the next GET', async () => {
    const { id } = await match301();
    const darts: readonly Dart[] = [...LEG_301, S(1), S(1), S(1), ...LEG_301];
    for (const [index, dart] of darts.entries()) {
      if (index === 9) {
        await pause(id, 85, 89);
      }
      const state = await throwAt(index * 10, id, [dart]);
      expect(state).toEqual(await getMatch(t.app, id));
    }
    expect(await getMatch(t.app, id)).toMatchObject({ finished: true, round: null, pausedMs: 4000 });
  });
});

describe('leg durations in GET /matches/:id/summary', () => {
  // W legu 1 zaczyna Bartek, więc LEG_301 daje mu wygraną.
  it('times each won leg from its first to its closing dart', async () => {
    const { id } = await match301();
    await throwAt(10, id, LEG_301.slice(0, 8));
    await throwAt(20, id, LEG_301.slice(8));
    await throwAt(100, id, LEG_301.slice(0, 8));
    await throwAt(125, id, LEG_301.slice(8));
    expect(await durations(id)).toEqual([
      { legIndex: 0, durationMs: 10_000 },
      { legIndex: 1, durationMs: 25_000 },
    ]);
  });

  it('subtracts a closed pause inside a leg', async () => {
    const { id } = await match301();
    await throwAt(10, id, LEG_301.slice(0, 8));
    await pause(id, 30, 90);
    await throwAt(100, id, LEG_301.slice(8));
    expect(await durations(id)).toEqual([{ legIndex: 0, durationMs: 30_000 }]);
  });

  it('subtracts a pause between legs from neither leg', async () => {
    const { id } = await match301();
    await throwAt(10, id, LEG_301.slice(0, 8));
    await throwAt(20, id, LEG_301.slice(8));
    await pause(id, 30, 90);
    await throwAt(100, id, LEG_301.slice(0, 8));
    await throwAt(130, id, LEG_301.slice(8));
    expect(await durations(id)).toEqual([
      { legIndex: 0, durationMs: 10_000 },
      { legIndex: 1, durationMs: 30_000 },
    ]);
  });

  it('drops a leg on undo of its closing dart and ends it at the dart thrown again', async () => {
    const { id } = await match301();
    await throwAt(10, id, LEG_301.slice(0, 8));
    await throwAt(20, id, LEG_301.slice(8));
    expect(await durations(id)).toEqual([{ legIndex: 0, durationMs: 10_000 }]);

    await undoAt(30, id);
    expect(await legs(id)).toEqual([]);

    await throwAt(50, id, [D(5)]);
    expect(await durations(id)).toEqual([{ legIndex: 0, durationMs: 40_000 }]);
  });

  it('moves the end of a leg with a checkout moved to a later dart', async () => {
    const { id } = await match301();
    await throwAt(10, id, LEG_301.slice(0, 8));
    await throwAt(100, id, [D(5)]);
    expect(await durations(id)).toEqual([{ legIndex: 0, durationMs: 90_000 }]);

    await undoAt(110, id);
    await throwAt(120, id, [MISS]);
    await throwAt(130, id, [MISS, MISS, MISS]);
    await throwAt(160, id, [D(5)]);
    expect(await durations(id)).toEqual([{ legIndex: 0, durationMs: 150_000 }]);
  });

  it('gives the last leg the time of the live leg clock at the finish', async () => {
    const { id } = await match301();
    await throwAt(10, id, LEG_301);
    await throwAt(50, id, LEG_301);
    await throwAt(100, id, LEG_301.slice(0, 3));
    await pause(id, 110, 150);
    const finished = await throwAt(200, id, LEG_301.slice(3));
    expect(finished).toMatchObject({ finished: true, legIndex: 2 });

    const { finishedAt, legStartedAt, legPausedMs } = finished;
    if (finishedAt === null || legStartedAt === null) {
      throw new Error('A finished match has its times');
    }
    const last = (await legs(id)).at(-1);
    expect(last?.legIndex).toBe(2);
    expect(last?.durationMs).toBe(Date.parse(finishedAt) - Date.parse(legStartedAt) - legPausedMs);
    expect(last?.durationMs).toBe(60_000);
  });
});
