import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import {
  applyThrow,
  createX01Match,
  currentPlayerId,
  EngineError,
  replayX01Match,
  type X01MatchConfig,
  type X01MatchState,
} from './index.js';

const S = (n: number): Hit => ({ segment: n, multiplier: 1 }) as Hit;
const D = (n: number): Hit => ({ segment: n, multiplier: 2 }) as Hit;
const T = (n: number): Hit => ({ segment: n, multiplier: 3 }) as Hit;
const BULL: Hit = { segment: 25, multiplier: 2 };
const OUTER_BULL: Hit = { segment: 25, multiplier: 1 };
const MISS: Hit = { segment: 0, multiplier: 0 };

const config: X01MatchConfig = { playerIds: ['anna', 'bartek'], startingScore: 501, legsToWin: 2, firstPlayerIndex: 0 };

// Stan na początku tury gracza 0 z zadanym wynikiem (wygodniejsze niż rozgrywanie całego lega).
function atScore(score: number, base: X01MatchState = createX01Match(config)): X01MatchState {
  return { ...base, remaining: [score, base.remaining[1]], turnStartRemaining: score, currentPlayerIndex: 0, currentDarts: [] };
}

function throwAll(state: X01MatchState, hits: readonly Hit[]) {
  let current = state;
  const events = [];
  for (const hit of hits) {
    const result = applyThrow(current, hit);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

function expectEngineError(fn: () => unknown, code: EngineError['code']) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe(code);
    return;
  }
  throw new Error(`Expected EngineError ${code}`);
}

describe('createX01Match', () => {
  it('starts every player at the starting score with the drawn player throwing first', () => {
    const state = createX01Match({ ...config, startingScore: 301, firstPlayerIndex: 1 });
    expect(state.remaining).toEqual([301, 301]);
    expect(currentPlayerId(state)).toBe('bartek');
    expect(state.legIndex).toBe(0);
    expect(state.winnerIndex).toBeNull();
  });

  it.each([301, 501, 701] as const)('accepts starting score %i', (startingScore) => {
    expect(createX01Match({ ...config, startingScore }).remaining).toEqual([startingScore, startingScore]);
  });

  it('rejects the same player twice', () => {
    expectEngineError(() => createX01Match({ ...config, playerIds: ['anna', 'anna'] }), 'invalid_config');
  });

  it('rejects an unsupported starting score', () => {
    expectEngineError(() => createX01Match({ ...config, startingScore: 401 as 501 }), 'invalid_config');
  });

  it('rejects a non-positive legsToWin', () => {
    expectEngineError(() => createX01Match({ ...config, legsToWin: 0 }), 'invalid_config');
  });
});

describe('scoring a turn', () => {
  it('counts from the first dart (straight-in) and emits nothing before the turn ends', () => {
    const { state, events } = applyThrow(createX01Match(config), T(20));
    expect(state.remaining).toEqual([441, 501]);
    expect(state.currentDarts).toEqual([T(20)]);
    expect(events).toEqual([]);
  });

  it('completes the turn after three darts and passes the throw to the opponent', () => {
    const { state, events } = throwAll(createX01Match(config), [T(20), T(20), T(20)]);
    expect(events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [T(20), T(20), T(20)], total: 180, remaining: 321 },
    ]);
    expect(currentPlayerId(state)).toBe('bartek');
    expect(state.turnIndex).toBe(1);
    expect(state.currentDarts).toEqual([]);
  });

  it('gives a fourth dart to the next player, never to the same turn', () => {
    const { state, events } = throwAll(createX01Match(config), [S(1), S(1), S(1), S(5)]);
    expect(state.remaining).toEqual([498, 496]);
    expect(currentPlayerId(state)).toBe('bartek');
    expect(state.currentDarts).toEqual([S(5)]);
    expect(events).toHaveLength(1);
  });

  it('counts a miss as a thrown dart worth zero', () => {
    const { state, events } = throwAll(createX01Match(config), [MISS, MISS, MISS]);
    expect(events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [MISS, MISS, MISS], total: 0, remaining: 501 },
    ]);
    expect(state.dartsThrownInLeg).toEqual([3, 0]);
  });

  it('scores Outer Bull as 25 and Bull as 50', () => {
    const { state } = throwAll(createX01Match(config), [OUTER_BULL, BULL]);
    expect(state.remaining[0]).toBe(426);
  });

  it('rejects an impossible hit', () => {
    expectEngineError(() => applyThrow(createX01Match(config), { segment: 25, multiplier: 3 } as unknown as Hit), 'invalid_hit');
  });
});

describe('bust', () => {
  it.each([
    ['going below zero', 40, [T(20)]],
    ['leaving exactly 1', 41, [D(20)]],
    ['reaching zero without a double', 40, [S(20), S(20)]],
    ['reaching zero with Outer Bull', 25, [OUTER_BULL]],
    ['leaving 1 after a single', 2, [S(1)]],
  ] as const)('busts when %s', (_name, score, hits) => {
    const { state, events } = throwAll(atScore(score), hits);
    expect(events).toEqual([
      { type: 'bust', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [...hits], remaining: score },
    ]);
    expect(state.remaining[0]).toBe(score);
    expect(currentPlayerId(state)).toBe('bartek');
  });

  it('returns to the score from before the turn, not before the busting dart', () => {
    const { state, events } = throwAll(atScore(50), [S(20), T(20)]);
    expect(events[0]).toMatchObject({ type: 'bust', remaining: 50, darts: [S(20), T(20)] });
    expect(state.remaining[0]).toBe(50);
  });

  it('ends the turn early and counts the busted darts', () => {
    const { state } = throwAll(atScore(40), [T(20)]);
    expect(state.dartsThrownInLeg[0]).toBe(1);
    expect(state.currentDarts).toEqual([]);
    expect(state.turnStartRemaining).toBe(501); // opponent's score
  });
});

describe('checkout', () => {
  it('wins the leg with a double', () => {
    const { events } = applyThrow(atScore(40), D(20));
    expect(events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [D(20)], total: 40, remaining: 0 },
      { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 40, dartsThrown: 1 },
    ]);
  });

  it('wins the leg with Bull', () => {
    const { events } = applyThrow(atScore(50), BULL);
    expect(events[1]).toMatchObject({ type: 'leg_won', checkout: 50 });
  });

  it('finishes on the second dart of a turn', () => {
    const { events } = throwAll(atScore(60), [S(20), D(20)]);
    expect(events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [S(20), D(20)], total: 60, remaining: 0 },
      { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 60, dartsThrown: 2 },
    ]);
  });

  it('records a nine-dart leg', () => {
    const hits = [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(19), D(12)];
    const { events } = replayX01Match(config, hits);
    expect(events.at(-1)).toEqual({ type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 141, dartsThrown: 9 });
  });
});

describe('legs and match', () => {
  const quickLeg = (winnerFirst: boolean): Hit[] =>
    // Zwycięzca kończy leg 301 w swojej drugiej turze: 180, potem 121 (T20, T17, D5).
    winnerFirst ? [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)] : [MISS, MISS, MISS, T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)];

  const short: X01MatchConfig = { ...config, startingScore: 301 };

  it('starts the next leg from scratch with the other player throwing first', () => {
    const { state, events } = replayX01Match(short, quickLeg(true));
    expect(events.map((e) => e.type)).toEqual(['turn_completed', 'turn_completed', 'turn_completed', 'leg_won']);
    expect(state.legIndex).toBe(1);
    expect(state.legsWon).toEqual([1, 0]);
    expect(state.remaining).toEqual([301, 301]);
    expect(state.turnIndex).toBe(0);
    expect(state.dartsThrownInLeg).toEqual([0, 0]);
    expect(currentPlayerId(state)).toBe('bartek');
  });

  it('alternates the starter in every leg', () => {
    // Leg 1: zaczyna i wygrywa anna. Leg 2: zaczyna i wygrywa bartek. Leg 3 znów zaczyna anna.
    const { state } = replayX01Match(short, [...quickLeg(true), ...quickLeg(true)]);
    expect(state.legsWon).toEqual([1, 1]);
    expect(state.legIndex).toBe(2);
    expect(currentPlayerId(state)).toBe('anna');
  });

  it('wins a best of 3 match at two legs', () => {
    // anna wygrywa leg 1 (sama zaczyna) i leg 2 (zaczyna bartek, który pudłuje).
    const { state, events } = replayX01Match(short, [...quickLeg(true), ...quickLeg(false)]);
    expect(events.at(-1)).toEqual({ type: 'match_won', playerId: 'anna', legsWon: { anna: 2, bartek: 0 } });
    expect(state.winnerIndex).toBe(0);
    expect(state.legsWon).toEqual([2, 0]);
  });

  it('goes to a deciding leg at 1:1', () => {
    const { state, events } = replayX01Match(short, [...quickLeg(true), ...quickLeg(true), ...quickLeg(false)]);
    // Leg 3 zaczyna anna; quickLeg(false) oznacza, że wygrywa drugi rzucający, czyli bartek.
    expect(events.at(-1)).toEqual({ type: 'match_won', playerId: 'bartek', legsWon: { anna: 1, bartek: 2 } });
    expect(state.winnerIndex).toBe(1);
  });

  it('rejects a dart thrown after the match has finished', () => {
    const { state } = replayX01Match(short, [...quickLeg(true), ...quickLeg(false)]);
    expectEngineError(() => applyThrow(state, S(20)), 'match_finished');
  });

  it('supports a single-leg match', () => {
    const { events } = replayX01Match({ ...short, legsToWin: 1 }, quickLeg(true));
    expect(events.at(-1)).toMatchObject({ type: 'match_won', playerId: 'anna' });
  });
});

describe('replay', () => {
  it('produces the same state and events as applying throws one by one', () => {
    const hits = [T(20), S(5), S(1), T(19), T(19), MISS, D(20), S(20), S(20)];
    const replayed = replayX01Match(config, hits);
    const stepwise = throwAll(createX01Match(config), hits);
    expect(replayed).toEqual(stepwise);
  });

  it('undo is a replay without the last throw', () => {
    const hits = [T(20), T(20), S(5)];
    const undone = replayX01Match(config, hits.slice(0, -1));
    expect(undone.state.remaining).toEqual([381, 501]);
    expect(undone.state.currentDarts).toEqual([T(20), T(20)]);
  });

  it('does not mutate the previous state', () => {
    const start = createX01Match(config);
    const snapshot = structuredClone(start);
    applyThrow(start, T(20));
    expect(start).toEqual(snapshot);
  });
});
