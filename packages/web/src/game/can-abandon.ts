import type { MatchSnapshot } from '@autoscore/schema';

// Porzucić można każdą grę w toku od startu, także przed pierwszą rzutką. Free run się nie porzuca, tylko kończy („Zakończ trening”).
// Serwer tego nie sprawdza, więc reguła działa tylko w UI.
export function canAbandon(game: Pick<MatchSnapshot, 'practiceMode' | 'status'>): boolean {
  return game.status === 'in_progress' && game.practiceMode !== 'free_run';
}
