import { Hit, type DomainEvent } from '@autoscore/schema';
import { EngineError } from './errors.js';
import { hitPoints, isDouble } from './points.js';

// X01, mecz 1v1: double-out, straight-in, best of N legów.
// Czysta logika: bez I/O i bez losowości. Kto zaczyna pierwszy leg (losowanie) decyduje wywołujący.

export const STARTING_SCORES = [301, 501, 701] as const;
export type StartingScore = (typeof STARTING_SCORES)[number];

export interface X01MatchConfig {
  readonly playerIds: readonly [string, string];
  readonly startingScore: StartingScore;
  readonly legsToWin: number; // best of 3 = 2
  readonly firstPlayerIndex: 0 | 1; // wynik losowania przed pierwszym legiem
}

export interface X01MatchState {
  readonly config: X01MatchConfig;
  readonly legIndex: number;
  readonly legStarterIndex: 0 | 1;
  readonly currentPlayerIndex: 0 | 1;
  readonly turnIndex: number; // numer tury w legu, liczony dla obu graczy razem
  readonly remaining: readonly [number, number];
  readonly turnStartRemaining: number; // wynik rzucającego sprzed bieżącej tury
  readonly currentDarts: readonly Hit[]; // rzutki bieżącej, niezamkniętej tury
  readonly dartsThrownInLeg: readonly [number, number];
  readonly legsWon: readonly [number, number];
  readonly winnerIndex: 0 | 1 | null;
}

export interface ApplyResult {
  readonly state: X01MatchState;
  readonly events: readonly DomainEvent[];
}

export function createX01Match(config: X01MatchConfig): X01MatchState {
  const [a, b] = config.playerIds;
  if (!a || !b || a === b) {
    throw new EngineError('invalid_config', 'A 1v1 match needs exactly two distinct players');
  }
  if (!STARTING_SCORES.includes(config.startingScore)) {
    throw new EngineError('invalid_config', `Starting score must be one of ${STARTING_SCORES.join(', ')}`);
  }
  if (!Number.isInteger(config.legsToWin) || config.legsToWin < 1) {
    throw new EngineError('invalid_config', 'legsToWin must be a positive integer');
  }
  return startLeg(config, 0, config.firstPlayerIndex, [0, 0]);
}

function startLeg(
  config: X01MatchConfig,
  legIndex: number,
  starter: 0 | 1,
  legsWon: readonly [number, number],
): X01MatchState {
  return {
    config,
    legIndex,
    legStarterIndex: starter,
    currentPlayerIndex: starter,
    turnIndex: 0,
    remaining: [config.startingScore, config.startingScore],
    turnStartRemaining: config.startingScore,
    currentDarts: [],
    dartsThrownInLeg: [0, 0],
    legsWon,
    winnerIndex: null,
  };
}

function other(index: 0 | 1): 0 | 1 {
  return index === 0 ? 1 : 0;
}

function withIndex<T>(pair: readonly [T, T], index: 0 | 1, value: T): [T, T] {
  return index === 0 ? [value, pair[1]] : [pair[0], value];
}

// Kolejna tura: zmiana gracza w tym samym legu.
function nextTurn(state: X01MatchState, remaining: readonly [number, number], dartsThrown: readonly [number, number]): X01MatchState {
  const next = other(state.currentPlayerIndex);
  return {
    ...state,
    currentPlayerIndex: next,
    turnIndex: state.turnIndex + 1,
    remaining,
    turnStartRemaining: remaining[next],
    currentDarts: [],
    dartsThrownInLeg: dartsThrown,
  };
}

export function applyThrow(state: X01MatchState, input: Hit): ApplyResult {
  if (state.winnerIndex !== null) {
    throw new EngineError('match_finished', 'The match is already finished');
  }
  const parsed = Hit.safeParse(input);
  if (!parsed.success) {
    throw new EngineError('invalid_hit', `Invalid hit: ${JSON.stringify(input)}`);
  }
  const hit = parsed.data;

  const { config, legIndex, turnIndex } = state;
  const player = state.currentPlayerIndex;
  const playerId = config.playerIds[player];
  const darts = [...state.currentDarts, hit];
  const dartsThrown = withIndex(state.dartsThrownInLeg, player, state.dartsThrownInLeg[player] + 1);
  const after = state.remaining[player] - hitPoints(hit);

  // Bust: poniżej zera, dokładnie 1 albo zero bez doubla. Wynik wraca do stanu sprzed tury, tura się kończy.
  if (after < 0 || after === 1 || (after === 0 && !isDouble(hit))) {
    const remaining = withIndex(state.remaining, player, state.turnStartRemaining);
    return {
      state: nextTurn(state, remaining, dartsThrown),
      events: [{ type: 'bust', playerId, legIndex, turnIndex, darts, remaining: state.turnStartRemaining }],
    };
  }

  if (after === 0) {
    const events: DomainEvent[] = [
      { type: 'turn_completed', playerId, legIndex, turnIndex, darts, total: state.turnStartRemaining, remaining: 0 },
      { type: 'leg_won', playerId, legIndex, checkout: state.turnStartRemaining, dartsThrown: dartsThrown[player] },
    ];
    const legsWon = withIndex(state.legsWon, player, state.legsWon[player] + 1);
    if (legsWon[player] >= config.legsToWin) {
      events.push({
        type: 'match_won',
        playerId,
        legsWon: { [config.playerIds[0]]: legsWon[0], [config.playerIds[1]]: legsWon[1] },
      });
      return {
        state: {
          ...state,
          remaining: withIndex(state.remaining, player, 0),
          currentDarts: [],
          dartsThrownInLeg: dartsThrown,
          legsWon,
          winnerIndex: player,
        },
        events,
      };
    }
    // Kolejne legi rozpoczynają gracze na przemian.
    return { state: startLeg(config, legIndex + 1, other(state.legStarterIndex), legsWon), events };
  }

  const remaining = withIndex(state.remaining, player, after);
  if (darts.length === 3) {
    return {
      state: nextTurn(state, remaining, dartsThrown),
      events: [{ type: 'turn_completed', playerId, legIndex, turnIndex, darts, total: state.turnStartRemaining - after, remaining: after }],
    };
  }
  return { state: { ...state, remaining, currentDarts: darts, dartsThrownInLeg: dartsThrown }, events: [] };
}

// Stan meczu jako wynik odtworzenia wszystkich rzutek (zapis zdarzeniowy).
export function replayX01Match(config: X01MatchConfig, hits: readonly Hit[]): ApplyResult {
  let state = createX01Match(config);
  const events: DomainEvent[] = [];
  for (const hit of hits) {
    const result = applyThrow(state, hit);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

export function currentPlayerId(state: X01MatchState): string {
  return state.config.playerIds[state.currentPlayerIndex];
}
