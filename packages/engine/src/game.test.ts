import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import {
  applyGameThrow,
  countsToStats,
  createCasualMatch,
  createFreeRun,
  createGame,
  createSolo501,
  createX01Match,
  isGameFinished,
  replayCasualMatch,
  replayFreeRun,
  replayGame,
  replaySolo501,
  replayX01Match,
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

// anna kończy leg 301 w drugiej turze (180, potem 121), bartek pudłuje.
const leg301 = [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)];
const nineDarter = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];

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
});
