import { DARTS_PER_TURN, type Bust, type Hit, type TurnCompleted } from '@autoscore/schema';
import { parseHit } from './hit-input.js';
import { hitPoints, isBust } from './points.js';

// Jedna rzutka w turze X01 (double-out, straight-in), wspólna dla meczu 1v1, zabawy i Solo 501.
// Kolejka graczy, legi i miejsca zostają w modułach trybów.

export interface X01Turn {
  readonly playerId: string;
  readonly legIndex: number;
  readonly turnIndex: number;
  readonly remaining: number; // wynik rzucającego przed tą rzutką
  readonly turnStartRemaining: number;
  readonly currentDarts: readonly Hit[];
}

export type X01DartResult =
  | { readonly outcome: 'open'; readonly remaining: number; readonly darts: readonly Hit[] }
  | { readonly outcome: 'turn_completed'; readonly remaining: number; readonly event: TurnCompleted }
  | { readonly outcome: 'bust'; readonly remaining: number; readonly event: Bust }
  | { readonly outcome: 'checkout'; readonly checkout: number; readonly event: TurnCompleted };

export function applyX01Dart(turn: X01Turn, input: Hit): X01DartResult {
  // Pełna tura powinna była się już zamknąć, więc to niespójny stan, a nie zły rzut.
  if (turn.currentDarts.length >= DARTS_PER_TURN) {
    throw new RangeError(`A turn already has ${turn.currentDarts.length} darts`);
  }
  const hit = parseHit(input);
  const { playerId, legIndex, turnIndex, turnStartRemaining } = turn;
  const darts = [...turn.currentDarts, hit];
  const after = turn.remaining - hitPoints(hit);

  if (isBust(after, hit)) {
    return {
      outcome: 'bust',
      remaining: turnStartRemaining,
      event: { type: 'bust', playerId, legIndex, turnIndex, darts, remaining: turnStartRemaining },
    };
  }
  if (after === 0) {
    return {
      outcome: 'checkout',
      checkout: turnStartRemaining,
      event: { type: 'turn_completed', playerId, legIndex, turnIndex, darts, total: turnStartRemaining, remaining: 0 },
    };
  }
  if (darts.length === DARTS_PER_TURN) {
    return {
      outcome: 'turn_completed',
      remaining: after,
      event: { type: 'turn_completed', playerId, legIndex, turnIndex, darts, total: turnStartRemaining - after, remaining: after },
    };
  }
  return { outcome: 'open', remaining: after, darts };
}
