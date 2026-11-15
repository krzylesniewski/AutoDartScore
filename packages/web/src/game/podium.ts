export interface PodiumSlot<T> {
  player: T;
  step: 1 | 2 | 3;
  visualOrder: 1 | 2 | 3;
}

// Pierwszy w rankingu stoi na środku, drugi po lewej, trzeci po prawej.
const VISUAL_ORDER = [2, 1, 3] as const;

function isStep(position: number): position is 1 | 2 | 3 {
  return position === 1 || position === 2 || position === 3;
}

// Stopień to miejsce gracza, więc remis dzieli stopień. Reszta zostaje w kolejności z serwera,
// także gracz z tym samym miejscem co trzeci na podium.
export function podiumSlots<T extends { position: number | null }>(players: readonly T[]): { podium: PodiumSlot<T>[]; rest: T[] } {
  const podium: PodiumSlot<T>[] = [];
  const rest: T[] = [];
  for (const player of players) {
    const visualOrder = VISUAL_ORDER[podium.length];
    if (visualOrder !== undefined && player.position !== null && isStep(player.position)) {
      podium.push({ player, step: player.position, visualOrder });
    } else {
      rest.push(player);
    }
  }
  return { podium, rest };
}
