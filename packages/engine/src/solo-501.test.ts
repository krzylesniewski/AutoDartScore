import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import {
  applySolo501Throw,
  createSolo501,
  EngineError,
  replaySolo501,
  SOLO_501_STARTING_SCORE,
  type Solo501Config,
  type Solo501State,
} from './index.js';

const S = (n: number): Hit => ({ segment: n, multiplier: 1 }) as Hit;
const D = (n: number): Hit => ({ segment: n, multiplier: 2 }) as Hit;
const T = (n: number): Hit => ({ segment: n, multiplier: 3 }) as Hit;
const BULL: Hit = { segment: 25, multiplier: 2 };
const OUTER_BULL: Hit = { segment: 25, multiplier: 1 };
const MISS: Hit = { segment: 0, multiplier: 0 };

const config: Solo501Config = { playerId: 'anna' };
const nineDarter = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];

// Stan na początku tury z zadanym wynikiem (wygodniejsze niż schodzenie z 501).
function atScore(score: number): Solo501State {
  return { ...createSolo501(config), remaining: score, turnStartRemaining: score };
}

function throwAll(state: Solo501State, hits: readonly Hit[]) {
  let current = state;
  const events = [];
  for (const hit of hits) {
    const result = applySolo501Throw(current, hit);
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

describe('createSolo501', () => {
  it('starts at 501', () => {
    const state = createSolo501(config);
    expect(SOLO_501_STARTING_SCORE).toBe(501);
    expect(state.remaining).toBe(501);
    expect(state.turnStartRemaining).toBe(501);
    expect(state.turnIndex).toBe(0);
    expect(state.dartsThrown).toBe(0);
    expect(state.finished).toBe(false);
  });

  it('rejects an empty player id', () => {
    expectEngineError(() => createSolo501({ playerId: '' }), 'invalid_config');
  });
});

describe('turns', () => {
  it('gives a fourth dart to a new turn of the same player', () => {
    const { state, events } = throwAll(createSolo501(config), [S(1), S(1), S(1), S(5)]);
    expect(events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [S(1), S(1), S(1)], total: 3, remaining: 498 },
    ]);
    expect(state.turnIndex).toBe(1);
    expect(state.turnStartRemaining).toBe(498);
    expect(state.remaining).toBe(493);
    expect(state.currentDarts).toEqual([S(5)]);
  });

  it('counts a miss as a thrown dart worth zero', () => {
    const { state } = throwAll(createSolo501(config), [MISS, MISS]);
    expect(state.remaining).toBe(501);
    expect(state.dartsThrown).toBe(2);
  });

  it('rejects an impossible hit', () => {
    expectEngineError(() => applySolo501Throw(createSolo501(config), { segment: 25, multiplier: 3 } as unknown as Hit), 'invalid_hit');
  });
});

describe('bust', () => {
  it.each([
    ['going below zero', 40, [T(20)]],
    ['leaving exactly 1', 41, [D(20)]],
    ['reaching zero without a double', 40, [S(20), S(20)]],
    ['reaching zero with Outer Bull', 25, [OUTER_BULL]],
  ] as const)('busts when %s and keeps the same player', (_name, score, hits) => {
    const { state, events } = throwAll(atScore(score), hits);
    expect(events).toEqual([{ type: 'bust', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [...hits], remaining: score }]);
    expect(state.remaining).toBe(score);
    expect(state.turnStartRemaining).toBe(score);
    expect(state.turnIndex).toBe(1);
    expect(state.currentDarts).toEqual([]);
    expect(state.dartsThrown).toBe(hits.length);
  });

  it('returns to the score from before the turn and lets the same player go on', () => {
    const { state, events } = throwAll(atScore(50), [S(20), T(20), S(10), D(20)]);
    expect(events).toEqual([
      { type: 'bust', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [S(20), T(20)], remaining: 50 },
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 1, darts: [S(10), D(20)], total: 50, remaining: 0 },
      { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 50, dartsThrown: 4 },
    ]);
    expect(state.finished).toBe(true);
  });
});

describe('checkout', () => {
  it('records a nine-dart leg without match_won', () => {
    const { state, events } = replaySolo501(config, nineDarter);
    expect(events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [T(20), T(20), T(20)], total: 180, remaining: 321 },
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 1, darts: [T(20), T(20), T(20)], total: 180, remaining: 141 },
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 2, darts: [T(20), T(19), D(12)], total: 141, remaining: 0 },
      { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 141, dartsThrown: 9 },
    ]);
    expect(events.some((event) => event.type === 'match_won')).toBe(false);
    expect(state.finished).toBe(true);
    expect(state.remaining).toBe(0);
    expect(state.currentDarts).toEqual([]);
  });

  it('rejects a dart thrown after the session has finished', () => {
    const { state } = replaySolo501(config, nineDarter);
    expectEngineError(() => applySolo501Throw(state, S(20)), 'match_finished');
  });

  it('finishes on the second dart of a turn', () => {
    const { state, events } = throwAll(atScore(60), [S(20), D(20)]);
    expect(events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [S(20), D(20)], total: 60, remaining: 0 },
      { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 60, dartsThrown: 2 },
    ]);
    expect(state.finished).toBe(true);
  });

  it('finishes with Bull', () => {
    const { events } = applySolo501Throw(atScore(50), BULL);
    expect(events[1]).toEqual({ type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 50, dartsThrown: 1 });
  });
});

describe('replay', () => {
  it('produces the same state and events as applying throws one by one', () => {
    // Przy 141 trzy T20 dają bust, kolejna tura zamyka 141.
    const hits = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];
    const replayed = replaySolo501(config, hits);
    const stepwise = throwAll(createSolo501(config), hits);
    expect(replayed).toEqual(stepwise);
    expect(replayed.events.map((event) => event.type)).toEqual(['turn_completed', 'turn_completed', 'bust', 'turn_completed', 'leg_won']);
    expect(replayed.events.at(-1)).toEqual({ type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 141, dartsThrown: 12 });
  });

  it('does not mutate the previous state', () => {
    const start = atScore(40);
    const snapshot = structuredClone(start);
    applySolo501Throw(start, D(20));
    expect(start).toEqual(snapshot);
  });
});
