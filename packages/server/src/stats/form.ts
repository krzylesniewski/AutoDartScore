import { FORM_GAMES, type MatchType, type PlayerFormPoint } from '@autoscore/schema';
import type { PlayerLeg } from './completed-legs.js';
import { threeDartAverage } from './tally.js';

// Czysta logika wykresu formy, bez I/O. Średnia każdej gry liczy tylko ukończone legi gracza.

export interface FormGame {
  readonly matchId: string;
  readonly type: MatchType;
  readonly createdAt: string;
  readonly legs: readonly PlayerLeg[]; // ukończone legi tego gracza
}

// games w kolejności utworzenia. Wynik też od najstarszej gry, najwyżej FORM_GAMES najnowszych.
export function buildForm(games: readonly FormGame[]): PlayerFormPoint[] {
  const points: PlayerFormPoint[] = [];
  for (const game of games) {
    const sum = game.legs.reduce((acc, leg) => ({ points: acc.points + leg.points, darts: acc.darts + leg.darts }), { points: 0, darts: 0 });
    const average = threeDartAverage(sum.points, sum.darts);
    // Gra bez ukończonego lega nie ma średniej.
    if (average === null) {
      continue;
    }
    points.push({ matchId: game.matchId, type: game.type, createdAt: game.createdAt, average, legs: game.legs.length });
  }
  return points.slice(-FORM_GAMES);
}
