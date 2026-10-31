import { hitPoints, isBust } from '@autoscore/engine';
import type { MatchSnapshot, ReviewedThrow } from '@autoscore/schema';

const DARTS_PER_TURN = 3;

export interface ReviewTurn {
  readonly pending: readonly ReviewedThrow[];
  readonly flaggable: readonly ReviewedThrow[];
  readonly full: boolean;
  // Tura z odczytu jest już skończona: ma 3 rzutki albo czekająca rzutka daje bust lub zamknięcie.
  // Kolejna rzutka czekałaby w tej turze i przepadła po potwierdzeniu odczytu, więc wpis rzutek jest zablokowany.
  readonly closed: boolean;
}

// Pozostały wynik serwera obejmuje tylko liczone rzutki, więc czekające dolicza się po kolei do niego.
function endsAsRead(state: MatchSnapshot): boolean {
  const start = state.players.find((player) => player.id === state.currentPlayerId)?.remaining ?? null;
  if (start === null) {
    return false;
  }
  let remaining = start;
  for (const entry of state.lastTurnThrows) {
    if (entry.scoring !== 'waiting') {
      continue;
    }
    const after = remaining - hitPoints(entry.value);
    if (after === 0 || isBust(after, entry.value)) {
      return true;
    }
    remaining = after;
  }
  return false;
}

export function reviewTurn(state: MatchSnapshot): ReviewTurn {
  const pending = state.lastTurnThrows.filter((entry) => entry.status === 'pending');
  const editable = !state.finished && state.status === 'in_progress' && state.practiceMode !== 'checkouts';
  const flaggable = editable ? state.lastTurnThrows.filter((entry) => entry.status === 'confirmed' && entry.scoring !== 'void') : [];
  const full = state.awaitingReview && state.lastTurnThrows.length === DARTS_PER_TURN;
  return { pending, flaggable, full, closed: full || (state.awaitingReview && endsAsRead(state)) };
}
