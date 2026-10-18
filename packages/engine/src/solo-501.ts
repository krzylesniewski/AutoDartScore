import { Hit, type DomainEvent } from '@autoscore/schema';
import { EngineError } from './errors.js';
import { hitPoints, isBust } from './points.js';
import type { ApplyResult } from './x01-match.js';

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
  const parsed = Hit.safeParse(input);
  if (!parsed.success) {
    throw new EngineError('invalid_hit', `Invalid hit: ${JSON.stringify(input)}`);
  }
  const hit = parsed.data;

  const { playerId } = state.config;
  const { turnIndex } = state;
  const darts = [...state.currentDarts, hit];
  const dartsThrown = state.dartsThrown + 1;
  const after = state.remaining - hitPoints(hit);

  if (isBust(after, hit)) {
    return {
      state: nextTurn(state, state.turnStartRemaining, dartsThrown),
      events: [{ type: 'bust', playerId, legIndex: LEG_INDEX, turnIndex, darts, remaining: state.turnStartRemaining }],
    };
  }

  if (after === 0) {
    return {
      state: { ...state, remaining: 0, currentDarts: [], dartsThrown, finished: true },
      events: [
        { type: 'turn_completed', playerId, legIndex: LEG_INDEX, turnIndex, darts, total: state.turnStartRemaining, remaining: 0 },
        { type: 'leg_won', playerId, legIndex: LEG_INDEX, checkout: state.turnStartRemaining, dartsThrown },
      ],
    };
  }

  if (darts.length === 3) {
    return {
      state: nextTurn(state, after, dartsThrown),
      events: [
        { type: 'turn_completed', playerId, legIndex: LEG_INDEX, turnIndex, darts, total: state.turnStartRemaining - after, remaining: after },
      ],
    };
  }
  return { state: { ...state, remaining: after, currentDarts: darts, dartsThrown }, events: [] };
}

// Stan treningu jako wynik odtworzenia wszystkich rzutek (zapis zdarzeniowy).
export function replaySolo501(config: Solo501Config, hits: readonly Hit[]): ApplyResult<Solo501State> {
  let state = createSolo501(config);
  const events: DomainEvent[] = [];
  for (const hit of hits) {
    const result = applySolo501Throw(state, hit);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
