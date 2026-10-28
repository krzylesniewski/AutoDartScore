import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { EngineError, replayGame, replayThrowLog, type GameConfig, type ThrowLogStep } from './index.js';

const S = (n: number): Hit => ({ segment: n, multiplier: 1 }) as Hit;
const D = (n: number): Hit => ({ segment: n, multiplier: 2 }) as Hit;
const T = (n: number): Hit => ({ segment: n, multiplier: 3 }) as Hit;
const MISS: Hit = { segment: 0, multiplier: 0 };

const match: GameConfig = { type: 'match', playerIds: ['anna', 'bartek'], startingScore: 301, legsToWin: 1, firstPlayerIndex: 0 };
const casual: GameConfig = { type: 'casual', playerIds: ['anna', 'bartek', 'celina'], startingScore: 301, firstPlayerIndex: 0 };
const solo: GameConfig = { type: 'practice', practiceMode: 'solo_501', playerId: 'anna' };
const freeRun: GameConfig = { type: 'practice', practiceMode: 'free_run', playerId: 'anna' };
const checkouts: GameConfig = { type: 'practice', practiceMode: 'checkouts', playerId: 'anna', range: '2-50', seed: 1, rule: 'repeat_on_miss' };

let nextId = 0;

function throws(hits: readonly Hit[]): ThrowLogStep[] {
  return hits.map((hit) => ({ type: 'throw', throwId: `p${(nextId += 1)}`, hit }));
}

const thrown = (throwId: string, hit: Hit): ThrowLogStep => ({ type: 'throw', throwId, hit });
const flag = (throwId: string): ThrowLogStep => ({ type: 'flag', throwId });
const verify = (throwId: string, hit: Hit): ThrowLogStep => ({ type: 'verify', throwId, hit });
const undo = (throwId: string): ThrowLogStep => ({ type: 'undo', throwId });
// Rzutka z niską pewnością: zapis rzutki i oznaczenie przez system idą razem.
const pending = (throwId: string, hit: Hit): ThrowLogStep[] => [thrown(throwId, hit), flag(throwId)];

// 1v1 na 301: Anna i Bartek, oboje z 20 na koniec, Anna rzuca.
const ANNA_AT_20 = throws([T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(13), S(2), MISS, MISS, MISS]);

function scoring(replay: ReturnType<typeof replayThrowLog>) {
  return Object.fromEntries(replay.throws.map((entry) => [entry.throwId, entry.scoring]));
}

function engineError(run: () => unknown): EngineError {
  try {
    run();
  } catch (error) {
    if (error instanceof EngineError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected an EngineError');
}

function x01(replay: ReturnType<typeof replayThrowLog>) {
  if (replay.state.type !== 'match') {
    throw new Error('Expected a 1v1 match');
  }
  return replay.state.state;
}

describe('replayThrowLog without flags', () => {
  it.each([
    ['1v1', match, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)]],
    ['casual', casual, [T(20), T(20), T(20), S(1), S(2), S(3), MISS, T(19)]],
    ['Solo 501', solo, [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)]],
    ['Free run', freeRun, [T(20), S(5), MISS, D(16)]],
  ] as const)('gives the same state and events as replayGame in %s', (_name, config, hits) => {
    const replay = replayThrowLog(config, throws(hits));
    const expected = replayGame(config, hits);
    expect(replay.state).toEqual(expected.state);
    expect(replay.events).toEqual(expected.events);
    expect(replay.throws.every((entry) => entry.scoring === 'counted' && !entry.pending)).toBe(true);
    expect(replay.counted).toEqual(replay.throws.map((entry) => entry.throwId));
    expect(replay.turnFull).toBe(false);
  });

  it('keeps the closed turn as the latest one until the next throw', () => {
    const replay = replayThrowLog(match, [thrown('a1', T(20)), thrown('a2', T(20)), thrown('a3', T(20))]);
    expect(replay.lastTurn).toEqual(['a1', 'a2', 'a3']);
    expect(replayThrowLog(match, [thrown('a1', T(20)), thrown('a2', T(20)), thrown('a3', T(20)), thrown('b1', MISS)]).lastTurn).toEqual(['b1']);
  });

  it('applies an undo of the last throw', () => {
    const replay = replayThrowLog(match, [thrown('a1', T(20)), thrown('a2', S(1)), undo('a2')]);
    expect(replay.state).toEqual(replayGame(match, [T(20)]).state);
    expect(replay.counted).toEqual(['a1']);
  });

  it('keeps the wrong_mode error of checkout practice', () => {
    expect(engineError(() => replayThrowLog(checkouts, [thrown('a1', T(20))])).code).toBe('wrong_mode');
    expect(replayThrowLog(checkouts, []).state).toEqual(replayGame(checkouts, []).state);
  });

  it('keeps the match_finished error after the game ends', () => {
    const steps = throws([T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)]);
    expect(engineError(() => replayThrowLog(match, [...steps, thrown('late', MISS)])).code).toBe('match_finished');
    expect(replayThrowLog(match, steps).finishedAtStep).toBe(8);
  });
});

describe('replayThrowLog with a pending dart', () => {
  it('holds the turn while the dart waits for a review', () => {
    const replay = replayThrowLog(match, [...pending('a1', T(20)), thrown('a2', T(20)), thrown('a3', T(20))]);
    expect(replay.events).toEqual([]);
    expect(x01(replay)).toMatchObject({ currentPlayerIndex: 0, currentDarts: [], remaining: [301, 301] });
    expect(replay.throws).toEqual([
      { throwId: 'a1', value: T(20), scoring: 'waiting', pending: true },
      { throwId: 'a2', value: T(20), scoring: 'waiting', pending: false },
      { throwId: 'a3', value: T(20), scoring: 'waiting', pending: false },
    ]);
    expect(replay.counted).toEqual([]);
    expect(replay.lastTurn).toEqual(['a1', 'a2', 'a3']);
    expect(replay.turnFull).toBe(true);
  });

  it('keeps only the darts thrown before the pending one in the open turn', () => {
    const replay = replayThrowLog(match, [thrown('a1', S(20)), ...pending('a2', T(20)), thrown('a3', T(20))]);
    expect(replay.events).toEqual([]);
    expect(x01(replay)).toMatchObject({ currentDarts: [S(20)], remaining: [281, 301] });
    expect(replay.counted).toEqual(['a1']);
    expect(replay.turnFull).toBe(true);
  });

  it('gives the same result as a replay without flags when the review confirms the dart', () => {
    const hits = [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)];
    const steps: ThrowLogStep[] = [...pending('a1', T(20)), thrown('a2', T(20)), thrown('a3', T(20)), verify('a1', T(20))];
    steps.push(...throws(hits.slice(3)));
    const replay = replayThrowLog(match, steps);
    const expected = replayGame(match, hits);
    expect(replay.state).toEqual(expected.state);
    expect(replay.events).toEqual(expected.events);
    expect(replay.throws.every((entry) => entry.scoring === 'counted' && !entry.pending)).toBe(true);
  });

  it('changes the turn total when the review corrects the dart', () => {
    const replay = replayThrowLog(match, [...pending('a1', T(20)), thrown('a2', T(20)), thrown('a3', T(20)), verify('a1', S(20))]);
    expect(replay.events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [S(20), T(20), T(20)], total: 140, remaining: 161 },
    ]);
    expect(replay.throws[0]).toEqual({ throwId: 'a1', value: S(20), scoring: 'counted', pending: false });
    expect(replay.counted).toEqual(['a1', 'a2', 'a3']);
  });

  it('busts when a finishing double is corrected to a single and voids the waiting darts', () => {
    const steps = [...ANNA_AT_20, ...pending('d1', D(10)), thrown('d2', S(5)), thrown('d3', S(5)), verify('d1', S(20))];
    const replay = replayThrowLog(match, steps);
    expect(replay.events.at(-1)).toEqual({ type: 'bust', playerId: 'anna', legIndex: 0, turnIndex: 4, darts: [S(20)], remaining: 20 });
    expect(x01(replay)).toMatchObject({ currentPlayerIndex: 1, remaining: [20, 301], winnerIndex: null });
    expect(scoring(replay)).toMatchObject({ d1: 'counted', d2: 'void', d3: 'void' });
    expect(replay.throws.filter((entry) => entry.pending)).toEqual([]);
    expect(replay.lastTurn).toEqual(['d1', 'd2', 'd3']);
    expect(replay.turnFull).toBe(false);

    const next = replayThrowLog(match, [...steps, thrown('b1', T(20))]);
    expect(next.events).toEqual(replay.events);
    expect(x01(next)).toMatchObject({ currentPlayerIndex: 1, currentDarts: [T(20)], remaining: [20, 241] });
    expect(next.lastTurn).toEqual(['b1']);
  });

  it('busts when the correction goes below zero', () => {
    const replay = replayThrowLog(match, [...ANNA_AT_20, ...pending('d1', S(10)), thrown('d2', S(5)), verify('d1', T(20))]);
    expect(replay.events.at(-1)).toMatchObject({ type: 'bust', playerId: 'anna', remaining: 20 });
    expect(scoring(replay)).toMatchObject({ d1: 'counted', d2: 'void' });
  });

  it('wins when the correction checks out and voids the waiting darts', () => {
    const steps = [...ANNA_AT_20, ...pending('d1', S(20)), thrown('d2', MISS), thrown('d3', MISS), verify('d1', D(10))];
    const replay = replayThrowLog(match, steps);
    expect(replay.events.slice(-3)).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 4, darts: [D(10)], total: 20, remaining: 0 },
      { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 20, dartsThrown: 7 },
      { type: 'match_won', playerId: 'anna', legsWon: { anna: 1, bartek: 0 } },
    ]);
    expect(x01(replay).winnerIndex).toBe(0);
    expect(scoring(replay)).toMatchObject({ d1: 'counted', d2: 'void', d3: 'void' });
    expect(replay.finishedAtStep).toBe(steps.length - 1);
  });

  it('rejects a throw after a verification finished the game', () => {
    const steps = [...ANNA_AT_20, ...pending('d1', S(20)), verify('d1', D(10))];
    expect(engineError(() => replayThrowLog(match, [...steps, thrown('late', MISS)])).code).toBe('match_finished');
  });

  it('clears the winner when the winning dart is flagged and keeps the game open after a correction', () => {
    const won = [...ANNA_AT_20, thrown('d1', D(10))];
    expect(replayThrowLog(match, won).finishedAtStep).toBe(won.length - 1);

    const flagged = replayThrowLog(match, [...won, flag('d1')]);
    expect(x01(flagged)).toMatchObject({ winnerIndex: null, currentPlayerIndex: 0, remaining: [20, 301] });
    expect(flagged.finishedAtStep).toBeNull();
    expect(flagged.events.some((event) => event.type === 'match_won')).toBe(false);
    expect(flagged.throws.at(-1)).toEqual({ throwId: 'd1', value: D(10), scoring: 'waiting', pending: true });

    const corrected = replayThrowLog(match, [...won, flag('d1'), verify('d1', S(10))]);
    expect(x01(corrected)).toMatchObject({ winnerIndex: null, currentPlayerIndex: 0, currentDarts: [S(10)], remaining: [10, 301] });
    expect(corrected.finishedAtStep).toBeNull();
  });

  it('reopens a closed turn when its last dart is flagged and moves the later darts of the turn behind it', () => {
    const steps = [thrown('a1', T(20)), thrown('a2', T(20)), thrown('a3', T(20))];
    const replay = replayThrowLog(match, [...steps, flag('a2')]);
    expect(x01(replay)).toMatchObject({ currentPlayerIndex: 0, currentDarts: [T(20)], remaining: [241, 301] });
    expect(replay.events).toEqual([]);
    expect(scoring(replay)).toEqual({ a1: 'counted', a2: 'waiting', a3: 'waiting' });
    expect(replay.throws.map((entry) => entry.pending)).toEqual([false, true, false]);
    expect(replay.turnFull).toBe(true);
  });

  it('drains only from the first pending dart', () => {
    const steps = [...pending('a1', S(1)), ...pending('a2', S(1)), thrown('a3', S(1))];
    const second = replayThrowLog(match, [...steps, verify('a2', S(2))]);
    expect(second.counted).toEqual([]);
    expect(second.throws.map((entry) => [entry.scoring, entry.pending])).toEqual([
      ['waiting', true],
      ['waiting', false],
      ['waiting', false],
    ]);

    const both = replayThrowLog(match, [...steps, verify('a2', S(2)), verify('a1', S(3))]);
    expect(both.counted).toEqual(['a1', 'a2', 'a3']);
    expect(both.events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [S(3), S(2), S(1)], total: 6, remaining: 295 },
    ]);
  });

  it('voids a second pending dart when the first one busts after the review', () => {
    const steps = [...ANNA_AT_20, ...pending('d1', D(10)), ...pending('d2', S(5)), verify('d1', T(20))];
    const replay = replayThrowLog(match, steps);
    expect(replay.events.at(-1)).toMatchObject({ type: 'bust', playerId: 'anna' });
    expect(replay.throws.at(-1)).toEqual({ throwId: 'd2', value: S(5), scoring: 'void', pending: false });
    expect(engineError(() => replayThrowLog(match, [...steps, verify('d2', S(5))])).code).toBe('throw_not_pending');
  });

  it('rejects a 4th dart while darts are held', () => {
    const held = [...pending('a1', S(1)), thrown('a2', S(1)), thrown('a3', S(1))];
    expect(engineError(() => replayThrowLog(match, [...held, thrown('a4', S(1))])).code).toBe('turn_pending');
    const afterCounted = [thrown('a1', S(1)), ...pending('a2', S(1)), thrown('a3', S(1))];
    expect(engineError(() => replayThrowLog(match, [...afterCounted, thrown('a4', S(1))])).code).toBe('turn_pending');
  });
});

describe('replayThrowLog errors', () => {
  it.each([
    ['a throw of an earlier turn', [thrown('a1', S(1)), thrown('a2', S(1)), thrown('a3', S(1)), thrown('b1', S(1)), flag('a1')]],
    ['a void throw', [...ANNA_AT_20, ...pending('d1', D(10)), thrown('d2', S(5)), verify('d1', S(20)), flag('d2')]],
    ['an unknown throw', [thrown('a1', S(1)), flag('nope')]],
    ['an undone throw', [thrown('a1', S(1)), undo('a1'), flag('a1')]],
  ])('rejects a flag of %s with throw_not_flaggable', (_name, steps) => {
    expect(engineError(() => replayThrowLog(match, steps)).code).toBe('throw_not_flaggable');
  });

  it('rejects a second flag of a pending throw with throw_already_pending', () => {
    expect(engineError(() => replayThrowLog(match, [...pending('a1', S(1)), flag('a1')])).code).toBe('throw_already_pending');
  });

  it.each([
    ['a counted throw', [thrown('a1', S(1)), verify('a1', S(2))]],
    ['a waiting throw that is not flagged', [...pending('a1', S(1)), thrown('a2', S(1)), verify('a2', S(2))]],
    ['an unknown throw', [verify('nope', S(2))]],
    ['a throw verified before', [...pending('a1', S(1)), ...pending('a2', S(1)), verify('a2', S(2)), verify('a2', S(3))]],
  ])('rejects a verify of %s with throw_not_pending', (_name, steps) => {
    expect(engineError(() => replayThrowLog(match, steps)).code).toBe('throw_not_pending');
  });

  it('rejects an invalid corrected hit', () => {
    expect(engineError(() => replayThrowLog(match, [...pending('a1', S(1)), verify('a1', { segment: 25, multiplier: 3 } as unknown as Hit)])).code).toBe(
      'invalid_hit',
    );
  });

  it('treats an undo of a throw that is not the last one as a corrupt log', () => {
    expect(() => replayThrowLog(match, [thrown('a1', S(1)), thrown('a2', S(1)), undo('a1')])).toThrow(/^Corrupt log/);
  });
});

describe('replayThrowLog undo', () => {
  it('removes a pending throw and frees the turn', () => {
    const replay = replayThrowLog(match, [thrown('a1', S(1)), ...pending('a2', S(1)), undo('a2'), thrown('a3', S(1))]);
    expect(replay.throws.map((entry) => entry.throwId)).toEqual(['a1', 'a3']);
    expect(replay.counted).toEqual(['a1', 'a3']);
    expect(x01(replay).currentDarts).toEqual([S(1), S(1)]);
  });

  it('removes a waiting throw and keeps the pending one', () => {
    const replay = replayThrowLog(match, [...pending('a1', S(1)), thrown('a2', S(1)), undo('a2')]);
    expect(replay.throws).toEqual([{ throwId: 'a1', value: S(1), scoring: 'waiting', pending: true }]);
    expect(replay.turnFull).toBe(false);
  });

  it('removes a void throw without touching the game', () => {
    const steps = [...ANNA_AT_20, ...pending('d1', D(10)), thrown('d2', S(5)), verify('d1', S(20))];
    const before = replayThrowLog(match, steps);
    const after = replayThrowLog(match, [...steps, undo('d2')]);
    expect(after.state).toEqual(before.state);
    expect(after.events).toEqual(before.events);
    expect(after.lastTurn).toEqual(['d1']);
  });

  it('undoes a counted throw that closed the turn after a verification', () => {
    const steps = [...ANNA_AT_20, ...pending('d1', S(20)), verify('d1', D(10)), undo('d1')];
    const replay = replayThrowLog(match, steps);
    expect(x01(replay)).toMatchObject({ winnerIndex: null, currentPlayerIndex: 0, remaining: [20, 301] });
    expect(replay.finishedAtStep).toBeNull();
  });
});

describe('replayThrowLog in casual', () => {
  // Anna i Bartek mają po 20, Celina pudłuje. Rzuca Anna.
  const prefix = throws([T(20), T(20), T(20), T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(13), S(2), T(20), T(13), S(2), MISS, MISS, MISS]);

  it('lets a verification finish one player while the others keep playing', () => {
    const replay = replayThrowLog(casual, [...prefix, ...pending('a1', S(20)), thrown('a2', MISS), verify('a1', D(10))]);
    expect(replay.events.at(-1)).toEqual({ type: 'player_finished', playerId: 'anna', legIndex: 0, place: 1, checkout: 20, dartsThrown: 7 });
    expect(scoring(replay)).toMatchObject({ a1: 'counted', a2: 'void' });
    expect(replay.finishedAtStep).toBeNull();
    if (replay.state.type !== 'casual') {
      throw new Error('Expected a casual game');
    }
    expect(replay.state.state).toMatchObject({ finished: false, currentPlayerIndex: 1, placements: [{ playerId: 'anna', place: 1 }] });
  });

  it('busts a player still in the game after another one finished', () => {
    const finished = [...prefix, thrown('a1', D(10))];
    const replay = replayThrowLog(casual, [...finished, ...pending('b1', D(10)), thrown('b2', MISS), verify('b1', S(20)), thrown('c1', T(20))]);
    expect(replay.events.filter((event) => event.type === 'bust')).toEqual([
      { type: 'bust', playerId: 'bartek', legIndex: 0, turnIndex: 7, darts: [S(20)], remaining: 20 },
    ]);
    expect(scoring(replay)).toMatchObject({ b1: 'counted', b2: 'void', c1: 'counted' });
    if (replay.state.type !== 'casual') {
      throw new Error('Expected a casual game');
    }
    expect(replay.state.state).toMatchObject({ remaining: [0, 20, 241], currentPlayerIndex: 2, currentDarts: [T(20)] });
  });
});

describe('replayThrowLog in Solo 501', () => {
  const prefix = throws([T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19)]);

  it('busts through a verification', () => {
    const replay = replayThrowLog(solo, [...prefix, ...pending('a1', S(12)), verify('a1', T(20))]);
    expect(replay.events.at(-1)).toMatchObject({ type: 'bust', playerId: 'anna', remaining: 141 });
    if (replay.state.type !== 'practice' || replay.state.practiceMode !== 'solo_501') {
      throw new Error('Expected Solo 501');
    }
    expect(replay.state.state).toMatchObject({ remaining: 141, finished: false, turnIndex: 3 });
  });

  it('checks out through a verification', () => {
    const steps = [...prefix, ...pending('a1', S(12)), verify('a1', D(12))];
    const replay = replayThrowLog(solo, steps);
    expect(replay.events.slice(-2)).toMatchObject([
      { type: 'turn_completed', playerId: 'anna', total: 141, remaining: 0 },
      { type: 'leg_won', playerId: 'anna', checkout: 141 },
    ]);
    expect(replay.finishedAtStep).toBe(steps.length - 1);
  });
});

describe('replayThrowLog in Free run', () => {
  it('holds a visit for a pending dart and counts it after the review without events', () => {
    const held = replayThrowLog(freeRun, [...pending('a1', S(1)), thrown('a2', T(20)), thrown('a3', T(20))]);
    expect(held.events).toEqual([]);
    expect(held.state.state).toMatchObject({ dartsThrown: 0, totalPoints: 0 });
    expect(held.turnFull).toBe(true);

    const verified = replayThrowLog(freeRun, [...pending('a1', S(1)), thrown('a2', T(20)), thrown('a3', T(20)), verify('a1', T(19))]);
    expect(verified.events).toEqual([]);
    expect(verified.state.state).toMatchObject({ dartsThrown: 3, totalPoints: 177, turnIndex: 1, currentDarts: [] });
    expect(verified.finishedAtStep).toBeNull();
  });
});
