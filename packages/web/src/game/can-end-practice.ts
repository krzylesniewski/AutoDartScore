import type { MatchSnapshot } from '@autoscore/schema';

// Pusty trening nie ma czego zapisać, więc przycisk pojawia się dopiero po pierwszej rzutce.
// W końcówkach nie wpisuje się rzutek, więc liczą się próby.
export function canEndPractice(game: Pick<MatchSnapshot, 'type' | 'status' | 'players' | 'practiceMode' | 'checkouts'>): boolean {
  if (game.type !== 'practice' || game.status !== 'in_progress') {
    return false;
  }
  if (game.practiceMode === 'checkouts') {
    return (game.checkouts?.attempts ?? 0) > 0;
  }
  return (game.players[0]?.dartsThrownInLeg ?? 0) > 0;
}
