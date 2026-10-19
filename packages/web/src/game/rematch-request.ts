import { CreateMatchRequest, type MatchSnapshot } from '@autoscore/schema';

// Kto zaczyna, nie jest wysyłane: serwer losuje to przy każdym nowym meczu.
export function rematchRequest(state: MatchSnapshot): CreateMatchRequest | null {
  if (state.type !== 'match' || state.legsToWin === null) {
    return null;
  }
  const parsed = CreateMatchRequest.safeParse({
    type: 'match',
    playerIds: state.players.map((player) => player.id),
    startingScore: state.startingScore,
    bestOf: state.legsToWin * 2 - 1,
  });
  return parsed.success ? parsed.data : null;
}
