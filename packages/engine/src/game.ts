import type { Hit, MatchType, PracticeMode } from '@autoscore/schema';
import { applyCasualThrow, createCasualMatch, replayCasualMatch, type CasualMatchConfig, type CasualMatchState } from './casual-match.js';
import { applyFreeRunThrow, createFreeRun, replayFreeRun, type FreeRunConfig, type FreeRunState } from './free-run.js';
import { applySolo501Throw, createSolo501, replaySolo501, type Solo501Config, type Solo501State } from './solo-501.js';
import {
  applyThrow,
  createX01Match,
  replayX01Match,
  type ApplyResult,
  type X01MatchConfig,
  type X01MatchState,
} from './x01-match.js';

// Jedno wejście do silnika dla każdego typu gry. Tylko przekazuje wywołania do modułów trybów, zasady są tam.

type Match = Extract<MatchType, 'match'>;
type Casual = Extract<MatchType, 'casual'>;
type Practice = Extract<MatchType, 'practice'>;
type Solo501 = Extract<PracticeMode, 'solo_501'>;
type FreeRun = Extract<PracticeMode, 'free_run'>;

export type GameConfig =
  | (X01MatchConfig & { readonly type: Match })
  | (CasualMatchConfig & { readonly type: Casual })
  | (Solo501Config & { readonly type: Practice; readonly practiceMode: Solo501 })
  | (FreeRunConfig & { readonly type: Practice; readonly practiceMode: FreeRun });

export type GameState =
  | { readonly type: Match; readonly state: X01MatchState }
  | { readonly type: Casual; readonly state: CasualMatchState }
  | { readonly type: Practice; readonly practiceMode: Solo501; readonly state: Solo501State }
  | { readonly type: Practice; readonly practiceMode: FreeRun; readonly state: FreeRunState };

export function createGame(config: GameConfig): GameState {
  switch (config.type) {
    case 'match':
      return { type: config.type, state: createX01Match(config) };
    case 'casual':
      return { type: config.type, state: createCasualMatch(config) };
    case 'practice':
      return config.practiceMode === 'solo_501'
        ? { type: config.type, practiceMode: config.practiceMode, state: createSolo501(config) }
        : { type: config.type, practiceMode: config.practiceMode, state: createFreeRun(config) };
  }
}

export function applyGameThrow(game: GameState, hit: Hit): ApplyResult<GameState> {
  switch (game.type) {
    case 'match': {
      const { state, events } = applyThrow(game.state, hit);
      return { state: { ...game, state }, events };
    }
    case 'casual': {
      const { state, events } = applyCasualThrow(game.state, hit);
      return { state: { ...game, state }, events };
    }
    case 'practice': {
      if (game.practiceMode === 'solo_501') {
        const { state, events } = applySolo501Throw(game.state, hit);
        return { state: { ...game, state }, events };
      }
      const { state, events } = applyFreeRunThrow(game.state, hit);
      return { state: { ...game, state }, events };
    }
  }
}

export function replayGame(config: GameConfig, hits: readonly Hit[]): ApplyResult<GameState> {
  switch (config.type) {
    case 'match': {
      const { state, events } = replayX01Match(config, hits);
      return { state: { type: config.type, state }, events };
    }
    case 'casual': {
      const { state, events } = replayCasualMatch(config, hits);
      return { state: { type: config.type, state }, events };
    }
    case 'practice': {
      if (config.practiceMode === 'solo_501') {
        const { state, events } = replaySolo501(config, hits);
        return { state: { type: config.type, practiceMode: config.practiceMode, state }, events };
      }
      const { state, events } = replayFreeRun(config, hits);
      return { state: { type: config.type, practiceMode: config.practiceMode, state }, events };
    }
  }
}

export function isGameFinished(game: GameState): boolean {
  switch (game.type) {
    case 'match':
      return game.state.winnerIndex !== null;
    case 'casual':
      return game.state.finished;
    case 'practice':
      return game.practiceMode === 'solo_501' && game.state.finished;
  }
}

// Free run zostaje w logu zdarzeń, ale nie wchodzi do agregatów statystyk.
export function countsToStats(config: GameConfig): boolean {
  return !(config.type === 'practice' && config.practiceMode === 'free_run');
}
