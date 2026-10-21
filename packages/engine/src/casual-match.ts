import { Hit, type DomainEvent, type Placement } from '@autoscore/schema';
import { EngineError } from './errors.js';
import { hitPoints, isBust } from './points.js';
import { STARTING_SCORES, type ApplyResult, type StartingScore } from './x01-match.js';

// Zabawa: jeden leg X01 (double-out, straight-in) dla 2-4 graczy.
// Kto zamknie leg, zajmuje kolejne wolne miejsce i wypada z kolejki. Ostatni gracz dostaje ostatnie miejsce bez zamknięcia.

export interface CasualMatchConfig {
  readonly playerIds: readonly string[]; // 2-4, w kolejności rzucania
  readonly startingScore: StartingScore;
  readonly firstPlayerIndex: number; // wynik losowania, indeks w playerIds
}

export interface CasualMatchState {
  readonly config: CasualMatchConfig;
  readonly currentPlayerIndex: number;
  readonly turnIndex: number; // numer tury, liczony dla wszystkich graczy razem
  readonly remaining: readonly number[];
  readonly turnStartRemaining: number; // wynik rzucającego sprzed bieżącej tury
  readonly currentDarts: readonly Hit[]; // rzutki bieżącej, niezamkniętej tury
  readonly dartsThrownInLeg: readonly number[];
  readonly turnsInLeg: readonly number[]; // tury każdego gracza do numeru kolejki, bust też jest turą
  readonly placements: readonly Placement[]; // w kolejności miejsc
  readonly finished: boolean;
}

const LEG_INDEX = 0;

export function createCasualMatch(config: CasualMatchConfig): CasualMatchState {
  const { playerIds, startingScore, firstPlayerIndex } = config;
  if (playerIds.length < 2 || playerIds.length > 4) {
    throw new EngineError('invalid_config', 'A casual game needs 2 to 4 players');
  }
  if (playerIds.some((id) => !id) || new Set(playerIds).size !== playerIds.length) {
    throw new EngineError('invalid_config', 'Player ids must be non-empty and distinct');
  }
  if (!STARTING_SCORES.includes(startingScore)) {
    throw new EngineError('invalid_config', `Starting score must be one of ${STARTING_SCORES.join(', ')}`);
  }
  if (!Number.isInteger(firstPlayerIndex) || firstPlayerIndex < 0 || firstPlayerIndex >= playerIds.length) {
    throw new EngineError('invalid_config', 'firstPlayerIndex must be an index into playerIds');
  }
  return {
    config,
    currentPlayerIndex: firstPlayerIndex,
    turnIndex: 0,
    remaining: playerIds.map(() => startingScore),
    turnStartRemaining: startingScore,
    currentDarts: [],
    dartsThrownInLeg: playerIds.map(() => 0),
    turnsInLeg: playerIds.map(() => 0),
    placements: [],
    finished: false,
  };
}

// Brak elementu oznacza niespójny stan (np. currentPlayerIndex spoza playerIds), a nie zły rzut, więc to nie jest EngineError.
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`No element at index ${index}`);
  }
  return item;
}

function withIndex<T>(items: readonly T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

function isPlaced(placements: readonly Placement[], playerId: string): boolean {
  return placements.some((placement) => placement.playerId === playerId);
}

function nextActivePlayer(playerIds: readonly string[], placements: readonly Placement[], from: number): number {
  for (let step = 1; step < playerIds.length; step++) {
    const index = (from + step) % playerIds.length;
    if (!isPlaced(placements, at(playerIds, index))) {
      return index;
    }
  }
  return from;
}

function nextTurn(
  state: CasualMatchState,
  remaining: readonly number[],
  dartsThrown: readonly number[],
  placements: readonly Placement[] = state.placements,
): CasualMatchState {
  const player = state.currentPlayerIndex;
  const next = nextActivePlayer(state.config.playerIds, placements, player);
  return {
    ...state,
    currentPlayerIndex: next,
    turnIndex: state.turnIndex + 1,
    turnsInLeg: withIndex(state.turnsInLeg, player, at(state.turnsInLeg, player) + 1),
    remaining,
    turnStartRemaining: at(remaining, next),
    currentDarts: [],
    dartsThrownInLeg: dartsThrown,
    placements,
  };
}

export function applyCasualThrow(state: CasualMatchState, input: Hit): ApplyResult<CasualMatchState> {
  if (state.finished) {
    throw new EngineError('match_finished', 'The game is already finished');
  }
  const parsed = Hit.safeParse(input);
  if (!parsed.success) {
    throw new EngineError('invalid_hit', `Invalid hit: ${JSON.stringify(input)}`);
  }
  const hit = parsed.data;

  const { config, turnIndex } = state;
  const player = state.currentPlayerIndex;
  const playerId = at(config.playerIds, player);
  const darts = [...state.currentDarts, hit];
  const dartsThrown = withIndex(state.dartsThrownInLeg, player, at(state.dartsThrownInLeg, player) + 1);
  const after = at(state.remaining, player) - hitPoints(hit);

  if (isBust(after, hit)) {
    const remaining = withIndex(state.remaining, player, state.turnStartRemaining);
    return {
      state: nextTurn(state, remaining, dartsThrown),
      events: [{ type: 'bust', playerId, legIndex: LEG_INDEX, turnIndex, darts, remaining: state.turnStartRemaining }],
    };
  }

  if (after === 0) {
    const place = state.placements.length + 1;
    const placements = [...state.placements, { playerId, place }];
    const remaining = withIndex(state.remaining, player, 0);
    const events: DomainEvent[] = [
      { type: 'turn_completed', playerId, legIndex: LEG_INDEX, turnIndex, darts, total: state.turnStartRemaining, remaining: 0 },
      { type: 'player_finished', playerId, legIndex: LEG_INDEX, place, checkout: state.turnStartRemaining, dartsThrown: at(dartsThrown, player) },
    ];
    const [last, ...others] = config.playerIds.filter((id) => !isPlaced(placements, id));
    if (last !== undefined && others.length === 0) {
      const final = [...placements, { playerId: last, place: config.playerIds.length }];
      events.push({ type: 'casual_finished', placements: final });
      return {
        state: { ...state, remaining, currentDarts: [], dartsThrownInLeg: dartsThrown, placements: final, finished: true },
        events,
      };
    }
    return { state: nextTurn(state, remaining, dartsThrown, placements), events };
  }

  const remaining = withIndex(state.remaining, player, after);
  if (darts.length === 3) {
    return {
      state: nextTurn(state, remaining, dartsThrown),
      events: [
        { type: 'turn_completed', playerId, legIndex: LEG_INDEX, turnIndex, darts, total: state.turnStartRemaining - after, remaining: after },
      ],
    };
  }
  return { state: { ...state, remaining, currentDarts: darts, dartsThrownInLeg: dartsThrown }, events: [] };
}

// Stan gry jako wynik odtworzenia wszystkich rzutek (zapis zdarzeniowy).
export function replayCasualMatch(config: CasualMatchConfig, hits: readonly Hit[]): ApplyResult<CasualMatchState> {
  let state = createCasualMatch(config);
  const events: DomainEvent[] = [];
  for (const hit of hits) {
    const result = applyCasualThrow(state, hit);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
