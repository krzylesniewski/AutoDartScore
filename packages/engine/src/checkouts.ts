import type { CheckoutAttempt, CheckoutRange, DomainEvent } from '@autoscore/schema';
import { EngineError } from './errors.js';
import type { ApplyResult } from './x01-match.js';

// Trening checkoutów: gracz dostaje losowy wynik do zamknięcia i zgłasza, czy mu się udało. Sesja nie ma końca.
// Zasada repeat_on_miss: po pudle cel zostaje, nowy po trafieniu albo pominięciu. Zasada new_each_attempt (sesje zapisane
// przed jej wprowadzeniem): nowy cel po każdej próbie. Pominięcie zawsze losuje nowy cel i nie jest próbą.
// Silnik nie losuje. Ziarno podaje wywołujący, a cel numer n wynika z ziarna, zakresu i n, więc odtworzenie daje te same cele.
// Bez zdarzeń domenowych, więc bez odczytu wyniku.

export const CHECKOUT_RANGES: Record<CheckoutRange, { readonly min: number; readonly max: number }> = {
  '2-50': { min: 2, max: 50 },
  '51-100': { min: 51, max: 100 },
};

// Ziarno mieści się w kolumnie integer ze znakiem (32 bity), także na PostgreSQL.
export const MAX_CHECKOUT_SEED = 2 ** 31 - 1;

export type CheckoutRule = 'new_each_attempt' | 'repeat_on_miss';

const CHECKOUT_RULES: readonly CheckoutRule[] = ['new_each_attempt', 'repeat_on_miss'];

export interface CheckoutsConfig {
  readonly playerId: string;
  readonly range: CheckoutRange;
  readonly seed: number;
  readonly rule: CheckoutRule;
}

// Niezmiennik: target === checkoutTarget(seed, range, draws).
export interface CheckoutsState {
  readonly config: CheckoutsConfig;
  readonly target: number; // bieżący cel, jeszcze bez próby
  readonly draws: number; // ile razy zmienił się cel
  readonly skips: number;
  readonly attempts: readonly CheckoutAttempt[];
}

export type CheckoutStep = { readonly type: 'attempt'; readonly success: boolean } | { readonly type: 'skip' };

function bounds(range: CheckoutRange): { readonly min: number; readonly max: number } {
  if (!Object.hasOwn(CHECKOUT_RANGES, range)) {
    throw new EngineError('invalid_config', `Unknown checkout range: ${String(range)}`);
  }
  return CHECKOUT_RANGES[range];
}

function checkSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_CHECKOUT_SEED) {
    throw new EngineError('invalid_config', `Checkout seed must be an integer from 0 to ${MAX_CHECKOUT_SEED}: ${seed}`);
  }
}

function checkIndex(n: number, min: number): void {
  if (!Number.isInteger(n) || n < min) {
    throw new EngineError('invalid_config', `Checkout target index must be an integer from ${min}: ${n}`);
  }
}

// Wykończenie murmur3: każdy bit wejścia zmienia mniej więcej połowę bitów wyniku.
function fmix32(value: number): number {
  let h = value;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// Ziarno i n są mieszane osobno, żeby sąsiednie ziarna nie dawały przesuniętych o jeden ciągów celów.
function mix(seed: number, n: number): number {
  return fmix32(fmix32(seed) ^ Math.imul(n + 1, 0x9e3779b9));
}

// Cel numer n > 0 z poprzedniego. Przesunięcie o 1..size-1 nigdy nie trafia w poprzedni cel, a każdy inny ma tę samą szansę.
export function nextCheckoutTarget(seed: number, range: CheckoutRange, previous: number, n: number): number {
  const { min, max } = bounds(range);
  checkSeed(seed);
  checkIndex(n, 1);
  if (!Number.isInteger(previous) || previous < min || previous > max) {
    throw new EngineError('invalid_config', `Previous checkout target ${previous} is outside ${range}`);
  }
  const size = max - min + 1;
  return min + ((previous - min + 1 + (mix(seed, n) % (size - 1))) % size);
}

// Cel numer n, liczony od 0.
export function checkoutTarget(seed: number, range: CheckoutRange, n: number): number {
  const { min, max } = bounds(range);
  checkSeed(seed);
  checkIndex(n, 0);
  let target = min + (mix(seed, 0) % (max - min + 1));
  for (let index = 1; index <= n; index += 1) {
    target = nextCheckoutTarget(seed, range, target, index);
  }
  return target;
}

export function createCheckouts(config: CheckoutsConfig): CheckoutsState {
  if (!config.playerId) {
    throw new EngineError('invalid_config', 'Checkout practice needs a player');
  }
  if (!CHECKOUT_RULES.includes(config.rule)) {
    throw new EngineError('invalid_config', `Unknown checkout rule: ${String(config.rule)}`);
  }
  return { config, target: checkoutTarget(config.seed, config.range, 0), draws: 0, skips: 0, attempts: [] };
}

function draw(state: CheckoutsState): CheckoutsState {
  const { seed, range } = state.config;
  const draws = state.draws + 1;
  return { ...state, target: nextCheckoutTarget(seed, range, state.target, draws), draws };
}

export function applyCheckoutAttempt(state: CheckoutsState, success: boolean): ApplyResult<CheckoutsState> {
  const recorded = { ...state, attempts: [...state.attempts, { target: state.target, success }] };
  const redraw = success || state.config.rule === 'new_each_attempt';
  return { state: redraw ? draw(recorded) : recorded, events: [] };
}

export function applyCheckoutSkip(state: CheckoutsState): ApplyResult<CheckoutsState> {
  return { state: draw({ ...state, skips: state.skips + 1 }), events: [] };
}

// Stan sesji jako wynik odtworzenia wszystkich prób i pominięć w kolejności z logu (zapis zdarzeniowy).
export function replayCheckouts(config: CheckoutsConfig, steps: readonly CheckoutStep[]): ApplyResult<CheckoutsState> {
  let state = createCheckouts(config);
  const events: DomainEvent[] = [];
  for (const step of steps) {
    const result = step.type === 'attempt' ? applyCheckoutAttempt(state, step.success) : applyCheckoutSkip(state);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
