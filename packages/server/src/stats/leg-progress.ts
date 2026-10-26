import { hitPoints } from '@autoscore/engine';
import type { DomainEvent, LegProgress, LegProgressPoint, StartingScore } from '@autoscore/schema';

// Pozostały wynik po każdej rzutce lega, tylko z zamkniętych tur, więc otwarta tura nie wchodzi na wykres.
// W zabawie linia gracza kończy się na rzutce zamykającej, bo potem nie ma już jego tur.
export function buildLegProgress(
  playerIds: readonly string[],
  startingScore: StartingScore,
  legIndex: number,
  events: readonly DomainEvent[],
): LegProgress | null {
  const points = new Map<string, LegProgressPoint[]>(playerIds.map((playerId) => [playerId, []]));
  let turns = 0;

  for (const event of events) {
    if ((event.type !== 'turn_completed' && event.type !== 'bust') || event.legIndex !== legIndex) {
      continue;
    }
    const line = points.get(event.playerId);
    if (!line) {
      continue;
    }
    turns += 1;
    let remaining = event.type === 'turn_completed' ? event.remaining + event.total : event.remaining;
    event.darts.forEach((dart, index) => {
      // Rzutka z bustem jest zawsze ostatnia w turze i cofa wynik do stanu sprzed tury.
      const bust = event.type === 'bust' && index === event.darts.length - 1;
      remaining = bust ? event.remaining : remaining - hitPoints(dart);
      line.push({ dart: line.length + 1, remaining, bust });
    });
  }

  if (turns === 0) {
    return null;
  }
  return { legIndex, startingScore, players: playerIds.map((playerId) => ({ playerId, points: points.get(playerId) ?? [] })) };
}
