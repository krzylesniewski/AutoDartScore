import type { DomainEvent, MatchType } from '@autoscore/schema';

// Punkty i rzutki gracza w ukończonych legach. Leg, który się nie skończył (gra w trakcie albo porzucona), nie wchodzi do średniej.

export interface PlayerLeg {
  readonly playerId: string;
  readonly legIndex: number;
  readonly points: number;
  readonly darts: number;
}

const CASUAL_LEG = 0;

function key(playerId: string, legIndex: number): string {
  return `${legIndex}:${playerId}`;
}

export function completedPlayerLegs(type: MatchType, playerIds: readonly string[], events: readonly DomainEvent[]): PlayerLeg[] {
  const legs = new Map<string, PlayerLeg>();
  const completed = new Set<string>();

  const add = (playerId: string, legIndex: number, points: number, darts: number) => {
    const leg = legs.get(key(playerId, legIndex)) ?? { playerId, legIndex, points: 0, darts: 0 };
    legs.set(key(playerId, legIndex), { ...leg, points: leg.points + points, darts: leg.darts + darts });
  };

  const complete = (ids: readonly string[], legIndex: number) => {
    for (const playerId of ids) {
      completed.add(key(playerId, legIndex));
    }
  };

  // Zbieramy ukończone legi osobno i filtrujemy na końcu, więc kolejność zdarzeń nie ma znaczenia.
  for (const event of events) {
    switch (event.type) {
      case 'turn_completed':
        add(event.playerId, event.legIndex, event.total, event.darts.length);
        break;
      case 'bust':
        add(event.playerId, event.legIndex, 0, event.darts.length);
        break;
      case 'leg_won':
        if (type !== 'casual') {
          complete(playerIds, event.legIndex);
        }
        break;
      // W zabawie leg kończy się dla gracza z jego miejscem, a dla ostatniego z końcem gry.
      case 'player_finished':
        if (type === 'casual') {
          complete([event.playerId], CASUAL_LEG);
        }
        break;
      case 'casual_finished':
        complete(playerIds, CASUAL_LEG);
        break;
      case 'match_won':
        break;
    }
  }

  return [...legs.entries()].filter(([legKey, leg]) => completed.has(legKey) && leg.darts > 0).map(([, leg]) => leg);
}
