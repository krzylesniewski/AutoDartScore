import type { MatchSnapshot } from '@autoscore/schema';

// Pusty trening nie ma czego zapisać, więc przycisk pojawia się dopiero po pierwszej rzutce.
export function canEndPractice(game: Pick<MatchSnapshot, 'type' | 'status' | 'players'>): boolean {
  return game.type === 'practice' && game.status === 'in_progress' && (game.players[0]?.dartsThrownInLeg ?? 0) > 0;
}
