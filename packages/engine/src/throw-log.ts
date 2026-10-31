import { Hit, type DomainEvent, type ThrowScoring } from '@autoscore/schema';
import { EngineError } from './errors.js';
import { applyGameThrow, createGame, isGameFinished, openTurnDarts, type GameConfig, type GameState } from './game.js';

// Odtworzenie logu rzutek z oznaczeniami do weryfikacji i weryfikacjami.
// Rzutka do weryfikacji wstrzymuje turę: kolejne rzutki tej tury czekają za nią i liczą się dopiero po weryfikacji.
// Gdy tura skończy się przed czekającymi rzutkami, te nie liczą się wcale, bo nie mogą przejść na następnego gracza.

export type ThrowLogStep =
  | { readonly type: 'throw'; readonly throwId: string; readonly hit: Hit }
  | { readonly type: 'flag'; readonly throwId: string }
  | { readonly type: 'verify'; readonly throwId: string; readonly hit: Hit }
  | { readonly type: 'undo'; readonly throwId: string };

export interface ReplayedThrow {
  readonly throwId: string;
  readonly value: Hit; // ostatnia zweryfikowana wartość albo pierwotny odczyt
  readonly scoring: ThrowScoring;
  readonly pending: boolean;
}

export interface ThrowLogReplay {
  readonly state: GameState;
  readonly events: readonly DomainEvent[];
  readonly throws: readonly ReplayedThrow[]; // rzutki niecofnięte, w kolejności z logu
  readonly counted: readonly string[];
  readonly lastTurn: readonly string[];
  readonly turnFull: boolean;
  readonly finishedAtStep: number | null;
}

interface Entry {
  value: Hit;
  scoring: ThrowScoring;
  flagged: boolean;
  turn: number; // kolejny numer tury w całej grze, liczony od 0
}

function parseHit(input: Hit): Hit {
  const parsed = Hit.safeParse(input);
  if (!parsed.success) {
    throw new EngineError('invalid_hit', `Invalid hit: ${JSON.stringify(input)}`);
  }
  return parsed.data;
}

export function replayThrowLog(config: GameConfig, steps: readonly ThrowLogStep[]): ThrowLogReplay {
  const entries = new Map<string, Entry>();
  const order: string[] = [];
  let counted: string[] = [];
  let held: string[] = [];
  let game = createGame(config);
  let events: DomainEvent[] = [];
  let closedTurns = 0;
  let finishedAtStep: number | null = null;

  function entry(throwId: string): Entry {
    const found = entries.get(throwId);
    if (!found) {
      throw new Error(`Corrupt log: throw ${throwId} is missing`);
    }
    return found;
  }

  // Zwraca true, gdy rzutka zamknęła turę albo zakończyła grę.
  function apply(throwId: string): boolean {
    const current = entry(throwId);
    const result = applyGameThrow(game, current.value);
    game = result.state;
    events.push(...result.events);
    current.scoring = 'counted';
    current.turn = closedTurns;
    counted.push(throwId);
    if (isGameFinished(game) || openTurnDarts(game).length === 0) {
      closedTurns += 1;
      return true;
    }
    return false;
  }

  // Silnik jest deterministyczny, więc numery tur rzutek sprzed ostatniej tury się nie zmieniają.
  function rebuild(): void {
    const ids = counted;
    counted = [];
    game = createGame(config);
    events = [];
    closedTurns = 0;
    for (const throwId of ids) {
      apply(throwId);
    }
    for (const throwId of held) {
      entry(throwId).turn = closedTurns;
    }
  }

  function drain(): void {
    while (held.length > 0 && !entry(held[0] as string).flagged) {
      const [next, ...rest] = held;
      held = rest;
      if (apply(next as string) && held.length > 0) {
        for (const throwId of held) {
          const voided = entry(throwId);
          voided.scoring = 'void';
          voided.flagged = false;
          voided.turn = closedTurns - 1;
        }
        held = [];
      }
    }
  }

  function latestTurn(): number | null {
    const last = order.at(-1);
    return last === undefined ? null : entry(last).turn;
  }

  function throwStep(throwId: string, input: Hit): void {
    if (entries.has(throwId)) {
      throw new Error(`Corrupt log: throw ${throwId} appears twice`);
    }
    const value = parseHit(input);
    if (held.length === 0) {
      entries.set(throwId, { value, scoring: 'counted', flagged: false, turn: closedTurns });
      try {
        apply(throwId);
      } catch (error) {
        entries.delete(throwId);
        throw error;
      }
      order.push(throwId);
      return;
    }
    if (held.length + openTurnDarts(game).length >= 3) {
      throw new EngineError('turn_pending', 'The turn already has 3 darts and waits for a review');
    }
    entries.set(throwId, { value, scoring: 'waiting', flagged: false, turn: closedTurns });
    held.push(throwId);
    order.push(throwId);
  }

  function flagStep(throwId: string): void {
    const target = entries.get(throwId);
    if (!target || target.scoring === 'void' || target.turn !== latestTurn()) {
      throw new EngineError('throw_not_flaggable', `Throw ${throwId} is not in the latest turn`);
    }
    if (target.flagged) {
      throw new EngineError('throw_already_pending', `Throw ${throwId} already waits for a review`);
    }
    target.flagged = true;
    if (target.scoring !== 'counted') {
      return;
    }
    const turn = target.turn;
    const moved = order.slice(order.indexOf(throwId)).filter((id) => entry(id).turn === turn && entry(id).scoring !== 'waiting');
    counted = counted.filter((id) => !moved.includes(id));
    for (const id of moved) {
      entry(id).scoring = 'waiting';
    }
    held = [...moved, ...held];
    rebuild();
  }

  function verifyStep(throwId: string, input: Hit): void {
    const target = entries.get(throwId);
    if (!target || target.scoring !== 'waiting' || !target.flagged) {
      throw new EngineError('throw_not_pending', `Throw ${throwId} does not wait for a review`);
    }
    target.value = parseHit(input);
    target.flagged = false;
    drain();
  }

  function undoStep(throwId: string): void {
    if (order.at(-1) !== throwId) {
      throw new Error(`Corrupt log: undo of ${throwId} does not match the last remaining throw`);
    }
    const { scoring } = entry(throwId);
    order.pop();
    entries.delete(throwId);
    held = held.filter((id) => id !== throwId);
    if (scoring === 'counted') {
      counted = counted.filter((id) => id !== throwId);
      rebuild();
    }
  }

  steps.forEach((step, index) => {
    const wasFinished = isGameFinished(game);
    switch (step.type) {
      case 'throw':
        throwStep(step.throwId, step.hit);
        break;
      case 'flag':
        flagStep(step.throwId);
        break;
      case 'verify':
        verifyStep(step.throwId, step.hit);
        break;
      case 'undo':
        undoStep(step.throwId);
        break;
    }
    if (!wasFinished && isGameFinished(game)) {
      finishedAtStep = index;
    }
  });

  const latest = latestTurn();
  return {
    state: game,
    events,
    throws: order.map((throwId) => {
      const { value, scoring, flagged } = entry(throwId);
      return { throwId, value, scoring, pending: scoring === 'waiting' && flagged };
    }),
    counted: [...counted],
    lastTurn: order.filter((throwId) => entry(throwId).turn === latest),
    turnFull: held.length > 0 && held.length + openTurnDarts(game).length === 3,
    finishedAtStep: isGameFinished(game) ? finishedAtStep : null,
  };
}
