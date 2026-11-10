import type { DomainEvent, ThrowRecord } from '@autoscore/schema';

// Rzutki z turn_completed i bust, liczone po kolei, odpowiadają jeden do jednego rzutkom, które nadal się liczą.
// Przerwy przycinamy do lega, więc porzucenie przed pierwszą albo po zamykającej rzutce nie skraca lega.
// Przerwy między legami należą do czasu gry, ale do żadnego lega.
export function legDurations(
  events: readonly DomainEvent[],
  throws: readonly Pick<ThrowRecord, 'receivedAt'>[],
  pauses: readonly { start: number; end: number }[],
): ReadonlyMap<number, number> {
  const durations = new Map<number, number>();
  let consumed = 0;
  let legFirst = 0;
  const receivedAt = (index: number, legIndex: number): number => {
    const record = throws[index];
    if (!record) {
      throw new Error(`Corrupt log: throw ${index} of leg ${legIndex} is missing`);
    }
    return Date.parse(record.receivedAt);
  };
  for (const event of events) {
    switch (event.type) {
      case 'turn_completed':
      case 'bust':
        consumed += event.darts.length;
        break;
      case 'leg_won': {
        const start = receivedAt(legFirst, event.legIndex);
        const end = receivedAt(consumed - 1, event.legIndex);
        const overlap = pauses.reduce((sum, pause) => sum + Math.max(0, Math.min(end, pause.end) - Math.max(start, pause.start)), 0);
        durations.set(event.legIndex, Math.max(0, end - start - overlap));
        legFirst = consumed;
        break;
      }
      case 'match_won':
      case 'player_finished':
      case 'casual_finished':
        break;
    }
  }
  return durations;
}
