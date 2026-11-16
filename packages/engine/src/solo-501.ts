import type { Hit } from '@autoscore/schema';
import type { ApplyResult } from './apply-result.js';
import { EngineError } from './errors.js';
import { replaySteps } from './replay-steps.js';
import { applyX01Dart } from './x01-turn.js';

// Trening Solo 501: jeden gracz schodzi z 501 do zera na zasadach X01 (double-out, straight-in, bust).
// Bez przeciwnika, więc koniec to leg_won bez match_won.

export const SOLO_501_STARTING_SCORE = 501;

export interface Solo501Config {
  readonly playerId: string;
}

export interface Solo501State {
  readonly config: Solo501Config;
  readonly turnIndex: number;
  readonly remaining: number;
  readonly turnStartRemaining: number;
  readonly currentDarts: readonly Hit[];
  readonly dartsThrown: number; // razem z rzutkami z bustów
  readonly finished: boolean;
}

const LEG_INDEX = 0;

export function createSolo501(config: Solo501Config): Solo501State {
  if (!config.playerId) {
    throw new EngineError('invalid_config', 'Solo 501 needs a player');
  }
  return {
    config,
    turnIndex: 0,
    remaining: SOLO_501_STARTING_SCORE,
    turnStartRemaining: SOLO_501_STARTING_SCORE,
    currentDarts: [],
    dartsThrown: 0,
    finished: false,
  };
}

function nextTurn(state: Solo501State, remaining: number, dartsThrown: number): Solo501State {
  return {
    ...state,
    turnIndex: state.turnIndex + 1,
    remaining,
    turnStartRemaining: remaining,
    currentDarts: [],
    dartsThrown,
  };
}

export function applySolo501Throw(state: Solo501State, input: Hit): ApplyResult<Solo501State> {
  if (state.finished) {
    throw new EngineError('match_finished', 'The practice session is already finished');
  }
  const { playerId } = state.config;
  const result = applyX01Dart(
    {
      playerId,
      legIndex: LEG_INDEX,
      turnIndex: state.turnIndex,
      remaining: state.remaining,
      turnStartRemaining: state.turnStartRemaining,
      currentDarts: state.currentDarts,
    },
    input,
  );
  const dartsThrown = state.dartsThrown + 1;

  switch (result.outcome) {
    case 'open':
      return { state: { ...state, remaining: result.remaining, currentDarts: result.darts, dartsThrown }, events: [] };
    case 'turn_completed':
    case 'bust':
      return { state: nextTurn(state, result.remaining, dartsThrown), events: [result.event] };
    case 'checkout':
      return {
        state: { ...state, remaining: 0, currentDarts: [], dartsThrown, finished: true },
        events: [result.event, { type: 'leg_won', playerId, legIndex: LEG_INDEX, checkout: result.checkout, dartsThrown }],
      };
  }
}

export function replaySolo501(config: Solo501Config, hits: readonly Hit[]): ApplyResult<Solo501State> {
  return replaySteps(createSolo501(config), hits, applySolo501Throw);
}
