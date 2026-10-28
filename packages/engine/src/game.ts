import type { Hit, MatchType, PracticeMode } from '@autoscore/schema';
import { applyCasualThrow, createCasualMatch, replayCasualMatch, type CasualMatchConfig, type CasualMatchState } from './casual-match.js';
import {
  applyCheckoutAttempt,
  applyCheckoutSkip,
  createCheckouts,
  replayCheckouts,
  type CheckoutStep,
  type CheckoutsConfig,
  type CheckoutsState,
} from './checkouts.js';
import { EngineError } from './errors.js';
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
type Checkouts = Extract<PracticeMode, 'checkouts'>;

export type GameConfig =
  | (X01MatchConfig & { readonly type: Match })
  | (CasualMatchConfig & { readonly type: Casual })
  | (Solo501Config & { readonly type: Practice; readonly practiceMode: Solo501 })
  | (FreeRunConfig & { readonly type: Practice; readonly practiceMode: FreeRun })
  | (CheckoutsConfig & { readonly type: Practice; readonly practiceMode: Checkouts });

export type GameState =
  | { readonly type: Match; readonly state: X01MatchState }
  | { readonly type: Casual; readonly state: CasualMatchState }
  | { readonly type: Practice; readonly practiceMode: Solo501; readonly state: Solo501State }
  | { readonly type: Practice; readonly practiceMode: FreeRun; readonly state: FreeRunState }
  | { readonly type: Practice; readonly practiceMode: Checkouts; readonly state: CheckoutsState };

function wrongMode(message: string): EngineError {
  return new EngineError('wrong_mode', message);
}

export function createGame(config: GameConfig): GameState {
  switch (config.type) {
    case 'match':
      return { type: config.type, state: createX01Match(config) };
    case 'casual':
      return { type: config.type, state: createCasualMatch(config) };
    case 'practice':
      switch (config.practiceMode) {
        case 'solo_501':
          return { type: config.type, practiceMode: config.practiceMode, state: createSolo501(config) };
        case 'free_run':
          return { type: config.type, practiceMode: config.practiceMode, state: createFreeRun(config) };
        case 'checkouts':
          return { type: config.type, practiceMode: config.practiceMode, state: createCheckouts(config) };
      }
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
    case 'practice':
      switch (game.practiceMode) {
        case 'solo_501': {
          const { state, events } = applySolo501Throw(game.state, hit);
          return { state: { ...game, state }, events };
        }
        case 'free_run': {
          const { state, events } = applyFreeRunThrow(game.state, hit);
          return { state: { ...game, state }, events };
        }
        case 'checkouts':
          throw wrongMode('Checkout practice takes attempts, not throws');
      }
  }
}

export function applyGameCheckoutAttempt(game: GameState, success: boolean): ApplyResult<GameState> {
  if (game.type !== 'practice' || game.practiceMode !== 'checkouts') {
    throw wrongMode('Only checkout practice takes attempts');
  }
  const { state, events } = applyCheckoutAttempt(game.state, success);
  return { state: { ...game, state }, events };
}

export function applyGameCheckoutSkip(game: GameState): ApplyResult<GameState> {
  if (game.type !== 'practice' || game.practiceMode !== 'checkouts') {
    throw wrongMode('Only checkout practice takes skips');
  }
  const { state, events } = applyCheckoutSkip(game.state);
  return { state: { ...game, state }, events };
}

// Trening checkoutów odtwarza się z prób i pominięć, każdy inny tryb z trafień.
export function replayGame(config: GameConfig, hits: readonly Hit[], checkoutSteps: readonly CheckoutStep[] = []): ApplyResult<GameState> {
  const checkouts = config.type === 'practice' && config.practiceMode === 'checkouts';
  if (checkouts && hits.length > 0) {
    throw wrongMode('Checkout practice takes attempts, not throws');
  }
  if (!checkouts && checkoutSteps.length > 0) {
    throw wrongMode('Only checkout practice takes attempts and skips');
  }
  switch (config.type) {
    case 'match': {
      const { state, events } = replayX01Match(config, hits);
      return { state: { type: config.type, state }, events };
    }
    case 'casual': {
      const { state, events } = replayCasualMatch(config, hits);
      return { state: { type: config.type, state }, events };
    }
    case 'practice':
      switch (config.practiceMode) {
        case 'solo_501': {
          const { state, events } = replaySolo501(config, hits);
          return { state: { type: config.type, practiceMode: config.practiceMode, state }, events };
        }
        case 'free_run': {
          const { state, events } = replayFreeRun(config, hits);
          return { state: { type: config.type, practiceMode: config.practiceMode, state }, events };
        }
        case 'checkouts': {
          const { state, events } = replayCheckouts(config, checkoutSteps);
          return { state: { type: config.type, practiceMode: config.practiceMode, state }, events };
        }
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
      switch (game.practiceMode) {
        case 'solo_501':
          return game.state.finished;
        case 'free_run':
        case 'checkouts':
          return false;
      }
  }
}

export function countsToStats(config: GameConfig): boolean {
  switch (config.type) {
    case 'match':
    case 'casual':
      return true;
    case 'practice':
      switch (config.practiceMode) {
        case 'solo_501':
          return true;
        case 'free_run':
        case 'checkouts':
          return false;
      }
  }
}

// Kolejka rzucającego w bieżącym legu, liczona od 1. W Solo 501 jest jeden gracz i jeden leg, więc turnIndex to już licznik jego tur.
export function currentRound(game: GameState): number | null {
  if (isGameFinished(game)) {
    return null;
  }
  switch (game.type) {
    case 'match':
      return game.state.turnsInLeg[game.state.currentPlayerIndex] + 1;
    case 'casual':
      return (game.state.turnsInLeg[game.state.currentPlayerIndex] ?? 0) + 1;
    case 'practice':
      switch (game.practiceMode) {
        case 'solo_501':
          return game.state.turnIndex + 1;
        case 'free_run':
        case 'checkouts':
          return null;
      }
  }
}

// Po wygranym legu licznik 1v1 zaczyna od zera, a po wygranym meczu zostają rzutki ostatniego lega.
export function dartsInCurrentLeg(game: GameState): number {
  switch (game.type) {
    case 'match':
    case 'casual':
      return game.state.dartsThrownInLeg.reduce((sum, darts) => sum + darts, 0);
    case 'practice':
      switch (game.practiceMode) {
        case 'solo_501':
        case 'free_run':
          return game.state.dartsThrown;
        case 'checkouts':
          return 0;
      }
  }
}

// Rzutki otwartej tury. Trening checkoutów nie ma rzutek.
export function openTurnDarts(game: GameState): readonly Hit[] {
  switch (game.type) {
    case 'match':
    case 'casual':
      return game.state.currentDarts;
    case 'practice':
      switch (game.practiceMode) {
        case 'solo_501':
        case 'free_run':
          return game.state.currentDarts;
        case 'checkouts':
          return [];
      }
  }
}
