import type { LegTurn, MatchSnapshot } from '@autoscore/schema';

export interface KnockedOff {
  points: number;
  turns: number;
}

export interface LegStats {
  highest: { points: number; playerId: string } | null;
  darts: number;
  busts: number;
}

// Tylko zamknięte tury. Bust dodaje 0 punktów, ale liczy się jako tura.
export function knockedOff(turns: readonly LegTurn[], playerId: string): KnockedOff {
  let points = 0;
  let count = 0;
  for (const turn of turns) {
    if (turn.playerId === playerId) {
      points += turn.points;
      count += 1;
    }
  }
  return { points, turns: count };
}

export function lastTurnOf(turns: readonly LegTurn[], playerId: string): LegTurn | null {
  return turns.findLast((turn) => turn.playerId === playerId) ?? null;
}

// Rzutki otwartej tury liczą się od razu, więc kafelek rośnie z każdą rzutką. Przy remisie najwyższej tury wygrywa wcześniejsza.
export function legStats(state: MatchSnapshot): LegStats {
  let highest: LegStats['highest'] = null;
  let darts = state.currentDarts.length;
  let busts = 0;
  for (const turn of state.legTurns) {
    darts += turn.darts.length;
    if (turn.bust) {
      busts += 1;
    } else if (highest === null || turn.points > highest.points) {
      highest = { points: turn.points, playerId: turn.playerId };
    }
  }
  return { highest, darts, busts };
}
