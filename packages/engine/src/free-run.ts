import { DARTS_PER_TURN, type Hit } from '@autoscore/schema';
import type { ApplyResult } from './apply-result.js';
import { EngineError } from './errors.js';
import { parseHit } from './hit-input.js';
import { hitPoints } from './points.js';
import { replaySteps } from './replay-steps.js';

// Trening Free run: swobodne rzucanie bez zasad i bez końca. Silnik tylko notuje rzutki: ich liczbę, sumę punktów i podejścia.
// Nie emituje zdarzeń domenowych, więc nie wyzwala odczytu wyniku.

export interface FreeRunConfig {
  readonly playerId: string;
}

export interface FreeRunState {
  readonly config: FreeRunConfig;
  readonly turnIndex: number; // zakończone podejścia po 3 rzutki
  readonly currentDarts: readonly Hit[]; // rzutki otwartego podejścia
  readonly dartsThrown: number;
  readonly totalPoints: number;
}

export function createFreeRun(config: FreeRunConfig): FreeRunState {
  if (!config.playerId) {
    throw new EngineError('invalid_config', 'Free run needs a player');
  }
  return { config, turnIndex: 0, currentDarts: [], dartsThrown: 0, totalPoints: 0 };
}

export function applyFreeRunThrow(state: FreeRunState, input: Hit): ApplyResult<FreeRunState> {
  const hit = parseHit(input);
  const darts = [...state.currentDarts, hit];
  const visitEnded = darts.length === DARTS_PER_TURN;
  return {
    state: {
      ...state,
      turnIndex: visitEnded ? state.turnIndex + 1 : state.turnIndex,
      currentDarts: visitEnded ? [] : darts,
      dartsThrown: state.dartsThrown + 1,
      totalPoints: state.totalPoints + hitPoints(hit),
    },
    events: [],
  };
}

export function replayFreeRun(config: FreeRunConfig, hits: readonly Hit[]): ApplyResult<FreeRunState> {
  return replaySteps(createFreeRun(config), hits, applyFreeRunThrow);
}

// Średnia na 3 rzutki, bez zaokrąglania.
export function freeRunAverage(state: FreeRunState): number {
  return state.dartsThrown === 0 ? 0 : (state.totalPoints / state.dartsThrown) * 3;
}
