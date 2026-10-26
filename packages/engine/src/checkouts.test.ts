import type { CheckoutRange } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import {
  applyCheckoutAttempt,
  applyCheckoutSkip,
  CHECKOUT_RANGES,
  checkoutTarget,
  createCheckouts,
  EngineError,
  MAX_CHECKOUT_SEED,
  nextCheckoutTarget,
  replayCheckouts,
  type CheckoutRule,
  type CheckoutStep,
  type CheckoutsConfig,
  type CheckoutsState,
} from './index.js';

const RANGES: readonly CheckoutRange[] = ['2-50', '51-100'];
const RULES: readonly CheckoutRule[] = ['new_each_attempt', 'repeat_on_miss'];
const config: CheckoutsConfig = { playerId: 'anna', range: '51-100', seed: 123_456_789, rule: 'new_each_attempt' };
const repeatConfig: CheckoutsConfig = { ...config, rule: 'repeat_on_miss' };

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

function sequence(seed: number, range: CheckoutRange, count: number): number[] {
  const targets = [checkoutTarget(seed, range, 0)];
  for (let n = 1; n < count; n += 1) {
    targets.push(nextCheckoutTarget(seed, range, targets[n - 1] ?? 0, n));
  }
  return targets;
}

function attemptAll(state: CheckoutsState, results: readonly boolean[]) {
  let current = state;
  const events = [];
  for (const success of results) {
    const result = applyCheckoutAttempt(current, success);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

function attempts(results: readonly boolean[]): CheckoutStep[] {
  return results.map((success) => ({ type: 'attempt', success }));
}

function stepAll(state: CheckoutsState, steps: readonly CheckoutStep[]) {
  let current = state;
  const states = [];
  const events = [];
  for (const step of steps) {
    const result = step.type === 'attempt' ? applyCheckoutAttempt(current, step.success) : applyCheckoutSkip(current);
    current = result.state;
    states.push(current);
    events.push(...result.events);
  }
  return { state: current, events, states };
}

const SKIP: CheckoutStep = { type: 'skip' };
const HIT: CheckoutStep = { type: 'attempt', success: true };
const MISS: CheckoutStep = { type: 'attempt', success: false };

describe('checkoutTarget', () => {
  it.each(RANGES)('gives the same targets for the same seed in %s', (range) => {
    expect(sequence(42, range, 50)).toEqual(sequence(42, range, 50));
    expect(checkoutTarget(42, range, 7)).toBe(checkoutTarget(42, range, 7));
  });

  it.each(RANGES)('gives different sequences for different seeds in %s', (range) => {
    expect(sequence(1, range, 20)).not.toEqual(sequence(2, range, 20));
    expect(sequence(0, range, 20)).not.toEqual(sequence(MAX_CHECKOUT_SEED, range, 20));
  });

  it.each(RANGES)('works with seed 0 and the largest seed in %s', (range) => {
    const { min, max } = CHECKOUT_RANGES[range];
    for (const seed of [0, MAX_CHECKOUT_SEED]) {
      const target = checkoutTarget(seed, range, 0);
      expect(target).toBeGreaterThanOrEqual(min);
      expect(target).toBeLessThanOrEqual(max);
    }
  });

  it('equals the n-th target reached step by step and through the replay', () => {
    const targets = sequence(config.seed, config.range, 30);
    const results = Array.from({ length: 29 }, (_, index) => index % 3 === 0);
    const { state } = replayCheckouts(config, attempts(results));
    for (let n = 0; n < targets.length; n += 1) {
      expect(checkoutTarget(config.seed, config.range, n)).toBe(targets[n]);
    }
    expect(state.attempts.map((attempt) => attempt.target)).toEqual(targets.slice(0, -1));
    expect(state.target).toBe(targets.at(-1));
  });

  describe.each(RANGES)('over 10 000 consecutive targets in %s', (range) => {
    const { min, max } = CHECKOUT_RANGES[range];
    const count = 10_000;
    const targets = sequence(987_654_321, range, count);

    it('stays within the range', () => {
      expect(targets.every((target) => Number.isInteger(target) && target >= min && target <= max)).toBe(true);
    });

    it('never repeats the previous target', () => {
      expect(targets.some((target, n) => n > 0 && target === targets[n - 1])).toBe(false);
    });

    it('draws every value within ±50% of the mean', () => {
      const counts = new Map<number, number>();
      for (const target of targets) {
        counts.set(target, (counts.get(target) ?? 0) + 1);
      }
      const mean = count / (max - min + 1);
      for (let value = min; value <= max; value += 1) {
        const seen = counts.get(value) ?? 0;
        expect(seen, `target ${value}`).toBeGreaterThanOrEqual(mean * 0.5);
        expect(seen, `target ${value}`).toBeLessThanOrEqual(mean * 1.5);
      }
    });
  });

  it.each([
    ['a negative seed', -1, 0],
    ['a seed above the maximum', MAX_CHECKOUT_SEED + 1, 0],
    ['a fractional seed', 1.5, 0],
    ['a NaN seed', Number.NaN, 0],
    ['a negative n', 1, -1],
    ['a fractional n', 1, 0.5],
  ])('rejects %s', (_name, seed, n) => {
    expectEngineError(() => checkoutTarget(seed, '2-50', n), 'invalid_config');
  });

  it('rejects an unknown range', () => {
    expectEngineError(() => checkoutTarget(1, '0-50' as CheckoutRange, 0), 'invalid_config');
    expectEngineError(() => checkoutTarget(1, 'toString' as CheckoutRange, 0), 'invalid_config');
  });
});

describe('nextCheckoutTarget', () => {
  it.each([
    ['a bad seed', -1, '2-50', 10, 1],
    ['n 0', 1, '2-50', 10, 0],
    ['a fractional n', 1, '2-50', 10, 1.5],
    ['an unknown range', 1, '0-50', 10, 1],
    ['a previous target outside the range', 1, '51-100', 50, 1],
  ] as const)('rejects %s', (_name, seed, range, previous, n) => {
    expectEngineError(() => nextCheckoutTarget(seed, range as CheckoutRange, previous, n), 'invalid_config');
  });
});

describe('createCheckouts', () => {
  it.each(RULES)('starts with target 0, no draws, no skips and no attempts under %s', (rule) => {
    const ruled = { ...config, rule };
    expect(createCheckouts(ruled)).toEqual({
      config: ruled,
      target: checkoutTarget(config.seed, config.range, 0),
      draws: 0,
      skips: 0,
      attempts: [],
    });
  });

  it.each([
    ['an empty player id', { ...config, playerId: '' }],
    ['an unknown range', { ...config, range: '0-50' as CheckoutRange }],
    ['a negative seed', { ...config, seed: -1 }],
    ['a seed above the maximum', { ...config, seed: MAX_CHECKOUT_SEED + 1 }],
    ['a fractional seed', { ...config, seed: 0.5 }],
    ['an unknown rule', { ...config, rule: 'repeat_forever' as CheckoutRule }],
    ['a missing rule', { ...config, rule: undefined as unknown as CheckoutRule }],
  ])('rejects %s', (_name, bad) => {
    expectEngineError(() => createCheckouts(bad), 'invalid_config');
  });
});

describe('applyCheckoutAttempt', () => {
  it('draws after every attempt under new_each_attempt, so attempt n has target n', () => {
    const results = [false, false, true, false, true, true, false];
    const { state } = attemptAll(createCheckouts(config), results);
    state.attempts.forEach((attempt, n) => {
      expect(attempt.target).toBe(checkoutTarget(config.seed, config.range, n));
    });
    expect(state.draws).toBe(results.length);
    expect(state.target).toBe(checkoutTarget(config.seed, config.range, results.length));
  });

  it('keeps the target and draws after a failure under repeat_on_miss', () => {
    const start = createCheckouts(repeatConfig);
    const { state } = applyCheckoutAttempt(start, false);
    expect(state.target).toBe(start.target);
    expect(state.draws).toBe(0);
    expect(state.attempts).toEqual([{ target: start.target, success: false }]);
  });

  it('keeps the same target over several failures in a row under repeat_on_miss', () => {
    const start = createCheckouts(repeatConfig);
    const { state } = attemptAll(start, [false, false, false, false]);
    expect(state.attempts.every((attempt) => attempt.target === start.target)).toBe(true);
    expect(state.target).toBe(start.target);
    expect(state.draws).toBe(0);
  });

  it('draws a new target after a success under repeat_on_miss', () => {
    const { state } = attemptAll(createCheckouts(repeatConfig), [false, false, true]);
    const first = checkoutTarget(config.seed, config.range, 0);
    expect(state.attempts.map((attempt) => attempt.target)).toEqual([first, first, first]);
    expect(state.draws).toBe(1);
    expect(state.target).toBe(checkoutTarget(config.seed, config.range, 1));
    expect(state.target).not.toBe(first);
  });

  it('records successes and failures in order and draws the next target', () => {
    const targets = sequence(config.seed, config.range, 5);
    const { state, events } = attemptAll(createCheckouts(config), [true, false, false, true]);
    expect(events).toEqual([]);
    expect(state.attempts).toEqual([
      { target: targets[0], success: true },
      { target: targets[1], success: false },
      { target: targets[2], success: false },
      { target: targets[3], success: true },
    ]);
    expect(state.attempts.filter((attempt) => attempt.success)).toHaveLength(2);
    expect(state.target).toBe(targets[4]);
    expect(state.config).toBe(config);
  });

  it('does not mutate the previous state', () => {
    const start = createCheckouts(config);
    const snapshot = structuredClone(start);
    applyCheckoutAttempt(start, true);
    expect(start).toEqual(snapshot);
  });
});

describe('applyCheckoutSkip', () => {
  it.each(RULES)('draws a new target without an attempt under %s', (rule) => {
    const start = applyCheckoutAttempt(createCheckouts({ ...config, rule }), false).state;
    const { state, events } = applyCheckoutSkip(start);
    expect(events).toEqual([]);
    expect(state.skips).toBe(1);
    expect(state.draws).toBe(start.draws + 1);
    expect(state.target).not.toBe(start.target);
    expect(state.target).toBe(checkoutTarget(config.seed, config.range, state.draws));
    expect(state.attempts).toEqual(start.attempts);
  });

  it('does not mutate the previous state', () => {
    const start = createCheckouts(repeatConfig);
    const snapshot = structuredClone(start);
    applyCheckoutSkip(start);
    expect(start).toEqual(snapshot);
  });
});

describe('replayCheckouts', () => {
  it('produces the same state and events as applying attempts one by one', () => {
    const results = [false, true, true, false, true];
    expect(replayCheckouts(config, attempts(results))).toEqual(attemptAll(createCheckouts(config), results));
  });

  it.each(RULES)('gives the same state as applying mixed steps one by one under %s', (rule) => {
    const ruled = { ...config, rule };
    const steps = [MISS, MISS, SKIP, HIT, MISS, SKIP, SKIP, MISS, HIT, HIT, MISS];
    const { state, events, states } = stepAll(createCheckouts(ruled), steps);
    expect(replayCheckouts(ruled, steps)).toEqual({ state, events });
    for (const step of states) {
      expect(step.target).toBe(checkoutTarget(config.seed, config.range, step.draws));
    }
    expect(state.skips).toBe(3);
    expect(state.attempts).toHaveLength(8);
  });

  it('counts draws from successes and skips under repeat_on_miss', () => {
    const { state } = replayCheckouts(repeatConfig, [MISS, SKIP, MISS, HIT, MISS, SKIP]);
    expect(state.draws).toBe(3);
    expect(state.target).toBe(checkoutTarget(config.seed, config.range, 3));
    expect(state.attempts.map((attempt) => attempt.target)).toEqual([0, 1, 1, 2].map((n) => checkoutTarget(config.seed, config.range, n)));
  });

  it('gives the starting state for no steps', () => {
    expect(replayCheckouts(config, [])).toEqual({ state: createCheckouts(config), events: [] });
  });
});
