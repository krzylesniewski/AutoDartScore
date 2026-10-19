import type { DomainEvent, HeadToHead } from '@autoscore/schema';
import { completedPlayerLegs } from './completed-legs.js';
import { threeDartAverage } from './tally.js';

// Czysta logika bilansu dwóch graczy, bez I/O. Gry wybiera wywołujący: tylko ukończone mecze 1v1 obu graczy.

export interface HeadToHeadGame {
  readonly winnerId: string | null;
  readonly events: readonly DomainEvent[];
}

export interface HeadToHeadInput {
  readonly playerId: string;
  readonly opponentId: string;
  readonly games: readonly HeadToHeadGame[];
}

interface Side {
  matches: number;
  legs: number;
  points: number;
  darts: number;
}

export function buildHeadToHead({ playerId, opponentId, games }: HeadToHeadInput): Omit<HeadToHead, 'lastPlayedAt'> {
  const own: Side = { matches: 0, legs: 0, points: 0, darts: 0 };
  const opponent: Side = { matches: 0, legs: 0, points: 0, darts: 0 };
  const side = (id: string | null): Side | null => (id === playerId ? own : id === opponentId ? opponent : null);

  for (const game of games) {
    const winner = side(game.winnerId);
    if (winner) {
      winner.matches += 1;
    }
    for (const event of game.events) {
      const legWinner = event.type === 'leg_won' ? side(event.playerId) : null;
      if (legWinner) {
        legWinner.legs += 1;
      }
    }
    // Punkty i rzutki sumowane przez wszystkie gry, więc średnia nie jest średnią średnich.
    for (const leg of completedPlayerLegs('match', [playerId, opponentId], game.events)) {
      const player = side(leg.playerId);
      if (player) {
        player.points += leg.points;
        player.darts += leg.darts;
      }
    }
  }

  return {
    playerId,
    opponentId,
    matchesPlayed: games.length,
    matchesWon: own.matches,
    opponentMatchesWon: opponent.matches,
    legsWon: own.legs,
    opponentLegsWon: opponent.legs,
    average: threeDartAverage(own.points, own.darts),
    opponentAverage: threeDartAverage(opponent.points, opponent.darts),
  };
}
