import type { Hit, MatchSnapshot } from '@autoscore/schema';
import { suggestCheckout } from './checkout';

const DARTS_PER_TURN = 3;

// Jedna trasa dla panelu zamknięcia i dla Enter, żeby obie drogi wpisywały tę samą rzutkę.
export function checkoutRoute(state: MatchSnapshot): Hit[] | null {
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);
  if (state.finished || state.startingScore === null || !player || player.remaining === null) {
    return null;
  }
  const dartsLeft = DARTS_PER_TURN - state.currentDarts.length;
  if (dartsLeft !== 1 && dartsLeft !== 2 && dartsLeft !== 3) {
    return null;
  }
  return suggestCheckout(player.remaining, dartsLeft);
}
