import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import {
  applyGameCheckoutAttempt,
  applyGameCheckoutSkip,
  applyGameThrow,
  checkoutTarget,
  countsToStats,
  createCasualMatch,
  createCheckouts,
  createFreeRun,
  createGame,
  createSolo501,
  createX01Match,
  currentRound,
  dartsInCurrentLeg,
  EngineError,
  isGameFinished,
  replayCasualMatch,
  replayCheckouts,
  replayFreeRun,
  replayGame,
  replaySolo501,
  replayX01Match,
  type CheckoutStep,
  type GameConfig,
  type GameState,
} from './index.js';

const S = (n: number): Hit => ({ segment: n, multiplier: 1 }) as Hit;
const D = (n: number): Hit => ({ segment: n, multiplier: 2 }) as Hit;
const T = (n: number): Hit => ({ segment: n, multiplier: 3 }) as Hit;
const MISS: Hit = { segment: 0, multiplier: 0 };

const matchConfig = { type: 'match', playerIds: ['anna', 'bartek'], startingScore: 301, legsToWin: 1, firstPlayerIndex: 0 } satisfies GameConfig;
const casualConfig = { type: 'casual', playerIds: ['anna', 'bartek'], startingScore: 301, firstPlayerIndex: 0 } satisfies GameConfig;
const solo501Config = { type: 'practice', practiceMode: 'solo_501', playerId: 'anna' } satisfies GameConfig;
const freeRunConfig = { type: 'practice', practiceMode: 'free_run', playerId: 'anna' } satisfies GameConfig;
const checkoutsConfig = {
  type: 'practice',
  practiceMode: 'checkouts',
  playerId: 'anna',
  range: '2-50',
  seed: 7,
  rule: 'repeat_on_miss',
} satisfies GameConfig;
const attempt = (success: boolean): CheckoutStep => ({ type: 'attempt', success });
const skip: CheckoutStep = { type: 'skip' };

// anna kończy leg 301 w drugiej turze (180, potem 121), bartek pudłuje.
const leg301 = [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)];
const nineDarter = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];

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

function throwAll(game: GameState, hits: readonly Hit[]) {
  let current = game;
  const events = [];
  for (const hit of hits) {
    const result = applyGameThrow(current, hit);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

describe('countsToStats', () => {
  it.each([
    ['match', matchConfig, true],
    ['casual', casualConfig, true],
    ['solo_501', solo501Config, true],
    ['free_run', freeRunConfig, false],
    ['checkouts', checkoutsConfig, false],
  ])('%s counts to stats: %s', (_name, config: GameConfig, expected) => {
    expect(countsToStats(config)).toBe(expected);
  });
});

describe('createGame', () => {
  it('wraps the state from the mode created with the same config object', () => {
    expect(createGame(matchConfig)).toEqual({ type: 'match', state: createX01Match(matchConfig) });
    expect(createGame(casualConfig)).toEqual({ type: 'casual', state: createCasualMatch(casualConfig) });
    expect(createGame(solo501Config)).toEqual({ type: 'practice', practiceMode: 'solo_501', state: createSolo501(solo501Config) });
    expect(createGame(freeRunConfig)).toEqual({ type: 'practice', practiceMode: 'free_run', state: createFreeRun(freeRunConfig) });
    expect(createGame(checkoutsConfig)).toEqual({ type: 'practice', practiceMode: 'checkouts', state: createCheckouts(checkoutsConfig) });
  });

  it('keeps the full config in the mode state', () => {
    expect(createGame(casualConfig).state.config).toBe(casualConfig);
    expect(createGame(freeRunConfig).state.config).toBe(freeRunConfig);
  });
});

describe('replayGame', () => {
  it('gives the same state and events as the mode replay', () => {
    const match = replayX01Match(matchConfig, leg301);
    expect(replayGame(matchConfig, leg301)).toEqual({ state: { type: 'match', state: match.state }, events: match.events });

    const casual = replayCasualMatch(casualConfig, leg301);
    expect(replayGame(casualConfig, leg301)).toEqual({ state: { type: 'casual', state: casual.state }, events: casual.events });

    const solo = replaySolo501(solo501Config, nineDarter);
    expect(replayGame(solo501Config, nineDarter)).toEqual({
      state: { type: 'practice', practiceMode: 'solo_501', state: solo.state },
      events: solo.events,
    });

    const freeRun = replayFreeRun(freeRunConfig, nineDarter);
    expect(replayGame(freeRunConfig, nineDarter)).toEqual({
      state: { type: 'practice', practiceMode: 'free_run', state: freeRun.state },
      events: freeRun.events,
    });

    const steps = [attempt(true), skip, attempt(false), attempt(true)];
    const checkouts = replayCheckouts(checkoutsConfig, steps);
    expect(replayGame(checkoutsConfig, [], steps)).toEqual({
      state: { type: 'practice', practiceMode: 'checkouts', state: checkouts.state },
      events: checkouts.events,
    });
  });

  it('rejects throws in checkout practice', () => {
    expectEngineError(() => replayGame(checkoutsConfig, [T(20)]), 'wrong_mode');
  });

  it.each([
    ['match', matchConfig],
    ['casual', casualConfig],
    ['solo_501', solo501Config],
    ['free_run', freeRunConfig],
  ])('rejects checkout attempts and skips in %s', (_name, config: GameConfig) => {
    expectEngineError(() => replayGame(config, [], [attempt(true)]), 'wrong_mode');
    expectEngineError(() => replayGame(config, [], [skip]), 'wrong_mode');
    expect(replayGame(config, [], [])).toEqual(replayGame(config, []));
  });
});

describe('applyGameCheckoutAttempt', () => {
  it('keeps the checkouts wrapper and matches the replay', () => {
    let game = createGame(checkoutsConfig);
    for (const success of [false, true]) {
      const result = applyGameCheckoutAttempt(game, success);
      expect(result.events).toEqual([]);
      game = result.state;
    }
    expect(game).toMatchObject({ type: 'practice', practiceMode: 'checkouts' });
    expect(game).toEqual(replayGame(checkoutsConfig, [], [attempt(false), attempt(true)]).state);
    expect(game.state).toMatchObject({ target: checkoutTarget(7, '2-50', 1), draws: 1 });
  });

  it.each([
    ['match', matchConfig],
    ['casual', casualConfig],
    ['solo_501', solo501Config],
    ['free_run', freeRunConfig],
  ])('rejects an attempt in %s', (_name, config: GameConfig) => {
    expectEngineError(() => applyGameCheckoutAttempt(createGame(config), true), 'wrong_mode');
  });
});

describe('applyGameCheckoutSkip', () => {
  it('keeps the checkouts wrapper, draws a new target and matches the replay', () => {
    const start = createGame(checkoutsConfig);
    const { state: game, events } = applyGameCheckoutSkip(start);
    expect(events).toEqual([]);
    expect(game).toMatchObject({ type: 'practice', practiceMode: 'checkouts' });
    expect(game).toEqual(replayGame(checkoutsConfig, [], [skip]).state);
    expect(game.state).toMatchObject({ target: checkoutTarget(7, '2-50', 1), draws: 1, skips: 1, attempts: [] });
  });

  it.each([
    ['match', matchConfig],
    ['casual', casualConfig],
    ['solo_501', solo501Config],
    ['free_run', freeRunConfig],
  ])('rejects a skip in %s', (_name, config: GameConfig) => {
    expectEngineError(() => applyGameCheckoutSkip(createGame(config)), 'wrong_mode');
  });
});

describe('applyGameThrow', () => {
  it.each([
    ['match', matchConfig, { type: 'match' }],
    ['casual', casualConfig, { type: 'casual' }],
    ['solo_501', solo501Config, { type: 'practice', practiceMode: 'solo_501' }],
    ['free_run', freeRunConfig, { type: 'practice', practiceMode: 'free_run' }],
  ])('keeps the %s wrapper and matches the replay', (_name, config: GameConfig, wrapper) => {
    const hits = [T(20), S(5), MISS, T(19)];
    const stepwise = throwAll(createGame(config), hits);
    expect(stepwise.state).toMatchObject(wrapper);
    expect(stepwise).toEqual(replayGame(config, hits));
  });

  it('rejects a throw in checkout practice', () => {
    expectEngineError(() => applyGameThrow(createGame(checkoutsConfig), T(20)), 'wrong_mode');
  });
});

describe('isGameFinished', () => {
  it('ends a match at match_won', () => {
    expect(isGameFinished(replayGame(matchConfig, leg301.slice(0, -1)).state)).toBe(false);
    expect(isGameFinished(replayGame(matchConfig, leg301).state)).toBe(true);
  });

  it('ends a casual game when the placements are complete', () => {
    expect(isGameFinished(replayGame(casualConfig, leg301.slice(0, -1)).state)).toBe(false);
    expect(isGameFinished(replayGame(casualConfig, leg301).state)).toBe(true);
  });

  it('ends Solo 501 at the checkout', () => {
    expect(isGameFinished(replayGame(solo501Config, nineDarter.slice(0, -1)).state)).toBe(false);
    expect(isGameFinished(replayGame(solo501Config, nineDarter).state)).toBe(true);
  });

  it('never ends Free run', () => {
    expect(isGameFinished(createGame(freeRunConfig))).toBe(false);
    expect(isGameFinished(replayGame(freeRunConfig, nineDarter).state)).toBe(false);
  });

  it('never ends checkout practice', () => {
    expect(isGameFinished(createGame(checkoutsConfig))).toBe(false);
    expect(isGameFinished(replayGame(checkoutsConfig, [], Array.from({ length: 50 }, () => attempt(true))).state)).toBe(false);
  });
});

describe('currentRound', () => {
  it('is null in Free run', () => {
    expect(currentRound(createGame(freeRunConfig))).toBeNull();
    expect(currentRound(replayGame(freeRunConfig, nineDarter).state)).toBeNull();
  });

  it('is null in checkout practice', () => {
    expect(currentRound(createGame(checkoutsConfig))).toBeNull();
    expect(currentRound(replayGame(checkoutsConfig, [], [attempt(true), skip, attempt(false)]).state)).toBeNull();
  });

  it.each([
    ['match', matchConfig, leg301, 2],
    ['casual', casualConfig, leg301, 2],
    ['solo_501', solo501Config, nineDarter, 3],
  ])('is null once a %s game is finished', (_name, config: GameConfig, hits, lastRound) => {
    expect(currentRound(replayGame(config, hits.slice(0, -1)).state)).toBe(lastRound);
    expect(currentRound(replayGame(config, hits).state)).toBeNull();
  });
});

describe('dartsInCurrentLeg', () => {
  it('sums both players in a 1v1 and starts at 0 after a leg is won', () => {
    const bestOf3 = { ...matchConfig, legsToWin: 2 } satisfies GameConfig;
    expect(dartsInCurrentLeg(createGame(bestOf3))).toBe(0);
    expect(dartsInCurrentLeg(replayGame(bestOf3, leg301.slice(0, -1)).state)).toBe(8);
    expect(dartsInCurrentLeg(replayGame(bestOf3, leg301).state)).toBe(0);
    expect(dartsInCurrentLeg(replayGame(bestOf3, [...leg301, MISS]).state)).toBe(1);
  });

  it('keeps the darts of the last leg in a finished 1v1', () => {
    const finished = replayGame(matchConfig, leg301).state;
    expect(isGameFinished(finished)).toBe(true);
    expect(dartsInCurrentLeg(finished)).toBe(9);
  });

  it('sums every player in a casual game, also after it is finished', () => {
    expect(dartsInCurrentLeg(createGame(casualConfig))).toBe(0);
    expect(dartsInCurrentLeg(replayGame(casualConfig, leg301.slice(0, 4)).state)).toBe(4);
    expect(dartsInCurrentLeg(replayGame(casualConfig, leg301).state)).toBe(9);
  });

  it('counts the darts of a practice session', () => {
    expect(dartsInCurrentLeg(createGame(solo501Config))).toBe(0);
    expect(dartsInCurrentLeg(replayGame(solo501Config, nineDarter).state)).toBe(9);
    expect(dartsInCurrentLeg(replayGame(freeRunConfig, nineDarter.slice(0, 4)).state)).toBe(4);
  });

  it('is 0 in checkout practice', () => {
    expect(dartsInCurrentLeg(createGame(checkoutsConfig))).toBe(0);
    expect(dartsInCurrentLeg(replayGame(checkoutsConfig, [], [attempt(true), attempt(false), skip, attempt(true)]).state)).toBe(0);
  });
});
