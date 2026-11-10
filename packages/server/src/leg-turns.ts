import { hitPoints, type GameState } from '@autoscore/engine';
import type { DomainEvent, Hit, LegTurn } from '@autoscore/schema';

const DARTS_PER_TURN = 3;

// Nowe obiekty rzutek, bo wywołujący podaje rekordy rzutek, a ich identyfikatory i czasy nie należą do stanu gry.
function plain(darts: readonly Hit[]): Hit[] {
  return darts.map(({ segment, multiplier }) => ({ segment, multiplier }));
}

// Zdarzenia tur są w kolejności rzutów. Zwycięska tura to turn_completed z remaining 0.
function fromEvents(events: readonly DomainEvent[], legIndex: number): LegTurn[] {
  const turns: LegTurn[] = [];
  for (const event of events) {
    if ((event.type !== 'turn_completed' && event.type !== 'bust') || event.legIndex !== legIndex) {
      continue;
    }
    const { playerId, turnIndex } = event;
    const darts = plain(event.darts);
    if (event.type === 'turn_completed') {
      turns.push({ playerId, turnIndex, darts, points: event.total, remainingAfter: event.remaining, bust: false });
    } else {
      turns.push({ playerId, turnIndex, darts, points: 0, remainingAfter: event.remaining, bust: true });
    }
  }
  return turns;
}

// Free run nie emituje zdarzeń, więc tury to pełne podejścia po 3 rzutki. Niepełne podejście jest otwartą turą.
function freeRunTurns(playerId: string, hits: readonly Hit[]): LegTurn[] {
  const turns: LegTurn[] = [];
  for (let start = 0; start + DARTS_PER_TURN <= hits.length; start += DARTS_PER_TURN) {
    const darts = plain(hits.slice(start, start + DARTS_PER_TURN));
    const points = darts.reduce((sum, dart) => sum + hitPoints(dart), 0);
    turns.push({ playerId, turnIndex: start / DARTS_PER_TURN, darts, points, remainingAfter: null, bust: false });
  }
  return turns;
}

// Zamknięte tury bieżącego lega. Po końcu meczu bieżącym legiem zostaje ostatni.
export function buildLegTurns(game: GameState, events: readonly DomainEvent[], hits: readonly Hit[]): LegTurn[] {
  switch (game.type) {
    case 'match':
      return fromEvents(events, game.state.legIndex);
    case 'casual':
      return fromEvents(events, 0);
    case 'practice':
      switch (game.practiceMode) {
        case 'solo_501':
          return fromEvents(events, 0);
        case 'free_run':
          return freeRunTurns(game.state.config.playerId, hits);
        case 'checkouts':
          return [];
      }
  }
}
