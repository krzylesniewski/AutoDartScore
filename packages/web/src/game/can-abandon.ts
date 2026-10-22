import type { MatchSnapshot } from '@autoscore/schema';

// Porzucić można mecz i zabawę w toku od startu, także przed pierwszą rzutką. Trening się nie porzuca, tylko kończy („Zakończ trening”).
// Serwer tego nie sprawdza, więc reguła działa tylko w UI.
export function canAbandon(game: Pick<MatchSnapshot, 'type' | 'status'>): boolean {
  return game.status === 'in_progress' && game.type !== 'practice';
}
