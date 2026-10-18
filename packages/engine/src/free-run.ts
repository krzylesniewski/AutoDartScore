import { Hit, type DomainEvent } from '@autoscore/schema';
import { EngineError } from './errors.js';
import { hitPoints } from './points.js';
import type { ApplyResult } from './x01-match.js';

// Trening Free run: swobodne rzucanie bez zasad i bez końca. Silnik tylko liczy rzutki i punkty sesji.
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
  const parsed = Hit.safeParse(input);
  if (!parsed.success) {
    throw new EngineError('invalid_hit', `Invalid hit: ${JSON.stringify(input)}`);
  }
  const hit = parsed.data;

  const darts = [...state.currentDarts, hit];
  const visitEnded = darts.length === 3;
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

// Stan sesji jako wynik odtworzenia wszystkich rzutek (zapis zdarzeniowy).
export function replayFreeRun(config: FreeRunConfig, hits: readonly Hit[]): ApplyResult<FreeRunState> {
  let state = createFreeRun(config);
  const events: DomainEvent[] = [];
  for (const hit of hits) {
    const result = applyFreeRunThrow(state, hit);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

// Średnia na 3 rzutki, bez zaokrąglania.
export function freeRunAverage(state: FreeRunState): number {
  return state.dartsThrown === 0 ? 0 : (state.totalPoints / state.dartsThrown) * 3;
}
