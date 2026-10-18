import type { MatchSnapshot } from '@autoscore/schema';

// Porzucić można tylko grę z co najmniej jednym ukończonym legiem. Gra bez niego zostaje na liście do dokończenia.
// Serwer tego nie sprawdza, więc reguła działa tylko w UI.
export function canAbandon(game: Pick<MatchSnapshot, 'type' | 'status' | 'legIndex' | 'players'>): boolean {
  if (game.status !== 'in_progress') {
    return false;
  }
  if (game.type === 'match') {
    return game.legIndex >= 1;
  }
  if (game.type === 'casual') {
    return game.players.some((player) => player.place !== null);
  }
  return false;
}
