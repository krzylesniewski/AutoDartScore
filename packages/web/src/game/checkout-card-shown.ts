import type { MatchSnapshot } from '@autoscore/schema';

// Karta zamknięcia stoi także bez trasy (jako niewidoczne miejsce), o ile rzucający ma wynik X01.
export function checkoutCardShown(state: MatchSnapshot): boolean {
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);
  return !state.finished && state.startingScore !== null && player !== undefined && player.remaining !== null;
}
