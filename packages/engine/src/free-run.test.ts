import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import {
  applyFreeRunThrow,
  createFreeRun,
  EngineError,
  freeRunAverage,
  replayFreeRun,
  type FreeRunConfig,
  type FreeRunState,
} from './index.js';

const S = (n: number): Hit => ({ segment: n, multiplier: 1 }) as Hit;
const T = (n: number): Hit => ({ segment: n, multiplier: 3 }) as Hit;
const MISS: Hit = { segment: 0, multiplier: 0 };

const config: FreeRunConfig = { playerId: 'anna' };

function throwAll(state: FreeRunState, hits: readonly Hit[]) {
  let current = state;
  const events = [];
  for (const hit of hits) {
    const result = applyFreeRunThrow(current, hit);
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

describe('createFreeRun', () => {
  it('starts an empty session with average 0', () => {
    const state = createFreeRun(config);
    expect(state).toEqual({ config, turnIndex: 0, currentDarts: [], dartsThrown: 0, totalPoints: 0 });
    expect(freeRunAverage(state)).toBe(0);
  });

  it('rejects an empty player id', () => {
    expectEngineError(() => createFreeRun({ playerId: '' }), 'invalid_config');
  });
});

describe('session counter', () => {
  it('counts darts and points across visits without emitting events', () => {
    const { state, events } = throwAll(createFreeRun(config), [T(20), T(20), T(20), S(1)]);
    expect(events).toEqual([]);
    expect(state.dartsThrown).toBe(4);
    expect(state.totalPoints).toBe(181);
    expect(state.turnIndex).toBe(1);
    expect(state.currentDarts).toEqual([S(1)]);
    expect(freeRunAverage(state)).toBe(135.75);
  });

  it('counts a miss as a thrown dart worth zero', () => {
    const { state } = throwAll(createFreeRun(config), [T(20), MISS]);
    expect(state.dartsThrown).toBe(2);
    expect(state.totalPoints).toBe(60);
    expect(freeRunAverage(state)).toBe(90);
  });

  it('has no bust, checkout or end', () => {
    const { state, events } = replayFreeRun(config, Array.from({ length: 36 }, () => T(20)));
    expect(events).toEqual([]);
    expect(state.dartsThrown).toBe(36);
    expect(state.totalPoints).toBe(2160);
    expect(state.turnIndex).toBe(12);
    expect(state.currentDarts).toEqual([]);
    expect(freeRunAverage(state)).toBe(180);
  });

  it('rejects an impossible hit', () => {
    expectEngineError(() => applyFreeRunThrow(createFreeRun(config), { segment: 25, multiplier: 3 } as unknown as Hit), 'invalid_hit');
  });
});

describe('replay', () => {
  it('produces the same state and events as applying throws one by one', () => {
    const hits = [T(20), S(5), MISS, T(19), S(1)];
    expect(replayFreeRun(config, hits)).toEqual(throwAll(createFreeRun(config), hits));
  });

  it('does not mutate the previous state', () => {
    const start = createFreeRun(config);
    const snapshot = structuredClone(start);
    applyFreeRunThrow(start, T(20));
    expect(start).toEqual(snapshot);
  });
});
