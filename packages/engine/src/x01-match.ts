import { BestOf, STARTING_SCORES, type DomainEvent, type Hit, type StartingScore } from '@autoscore/schema';
import type { ApplyResult } from './apply-result.js';
import { EngineError } from './errors.js';
import { replaySteps } from './replay-steps.js';
import { applyX01Dart } from './x01-turn.js';

// X01, mecz 1v1: double-out, straight-in, best of N legów.
// Czysta logika: bez I/O i bez losowości. Kto zaczyna pierwszy leg (losowanie) decyduje wywołujący.

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
  readonly turnsInLeg: readonly [number, number]; // tury każdego gracza w legu do numeru kolejki, bust też jest turą
  readonly legsWon: readonly [number, number];
  readonly winnerIndex: 0 | 1 | null;
}

// Serwer zapisuje legsToWin jako (bestOf + 1) / 2, więc inne wartości nie pochodzą z żadnego meczu.
const LEGS_TO_WIN: readonly number[] = BestOf.options.map((option) => (option.value + 1) / 2);

export function createX01Match(config: X01MatchConfig): X01MatchState {
  const [a, b] = config.playerIds;
  if (!a || !b || a === b) {
    throw new EngineError('invalid_config', 'A 1v1 match needs exactly two distinct players');
  }
  if (!STARTING_SCORES.includes(config.startingScore)) {
    throw new EngineError('invalid_config', `Starting score must be one of ${STARTING_SCORES.join(', ')}`);
  }
  if (!LEGS_TO_WIN.includes(config.legsToWin)) {
    throw new EngineError('invalid_config', `legsToWin must be one of ${LEGS_TO_WIN.join(', ')}`);
  }
  // Typ tego nie gwarantuje przy danych spoza TypeScriptu, a zły indeks dawałby wynik NaN bez błędu.
  if (config.firstPlayerIndex !== 0 && config.firstPlayerIndex !== 1) {
    throw new EngineError('invalid_config', 'firstPlayerIndex must be 0 or 1');
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
    turnsInLeg: [0, 0],
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
  const player = state.currentPlayerIndex;
  const next = other(player);
  return {
    ...state,
    currentPlayerIndex: next,
    turnIndex: state.turnIndex + 1,
    turnsInLeg: withIndex(state.turnsInLeg, player, state.turnsInLeg[player] + 1),
    remaining,
    turnStartRemaining: remaining[next],
    currentDarts: [],
    dartsThrownInLeg: dartsThrown,
  };
}

export function applyThrow(state: X01MatchState, input: Hit): ApplyResult<X01MatchState> {
  if (state.winnerIndex !== null) {
    throw new EngineError('match_finished', 'The match is already finished');
  }
  const { config, legIndex, turnIndex } = state;
  const player = state.currentPlayerIndex;
  const playerId = config.playerIds[player];
  const result = applyX01Dart(
    {
      playerId,
      legIndex,
      turnIndex,
      remaining: state.remaining[player],
      turnStartRemaining: state.turnStartRemaining,
      currentDarts: state.currentDarts,
    },
    input,
  );
  const dartsThrown = withIndex(state.dartsThrownInLeg, player, state.dartsThrownInLeg[player] + 1);

  switch (result.outcome) {
    case 'open':
      return {
        state: { ...state, remaining: withIndex(state.remaining, player, result.remaining), currentDarts: result.darts, dartsThrownInLeg: dartsThrown },
        events: [],
      };
    case 'turn_completed':
    case 'bust':
      return { state: nextTurn(state, withIndex(state.remaining, player, result.remaining), dartsThrown), events: [result.event] };
    case 'checkout': {
      const events: DomainEvent[] = [
        result.event,
        { type: 'leg_won', playerId, legIndex, checkout: result.checkout, dartsThrown: dartsThrown[player] },
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
  }
}

export function replayX01Match(config: X01MatchConfig, hits: readonly Hit[]): ApplyResult<X01MatchState> {
  return replaySteps(createX01Match(config), hits, applyThrow);
}

export function currentPlayerId(state: X01MatchState): string {
  return state.config.playerIds[state.currentPlayerIndex];
}
