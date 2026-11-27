import { hitPoints } from '@autoscore/engine';
import type { LegProgress, LegProgressPoint, MatchLeg, StartingScore } from '@autoscore/schema';

// Pozostały wynik po każdej rzutce lega z jego zamkniętych tur, tak samo jak lastLegProgress z serwera,
// żeby wykres wybranego lega zgadzał się z tabelą tur. Leg bez zamkniętej tury nie ma wykresu.
export function legProgressFromTurns(leg: MatchLeg, startingScore: StartingScore, playerIds: readonly string[]): LegProgress | null {
  if (leg.turns.length === 0) {
    return null;
  }
  const lines = new Map<string, LegProgressPoint[]>(playerIds.map((playerId) => [playerId, []]));
  for (const turn of leg.turns) {
    const line = lines.get(turn.playerId);
    if (!line || turn.remainingAfter === null) {
      continue;
    }
    const before = turn.bust ? turn.remainingAfter : turn.remainingAfter + turn.points;
    let remaining = before;
    turn.darts.forEach((dart, index) => {
      // Rzutka z bustem jest zawsze ostatnia w turze i cofa wynik do stanu sprzed tury.
      const bust = turn.bust && index === turn.darts.length - 1;
      remaining = bust ? before : remaining - hitPoints(dart);
      line.push({ dart: line.length + 1, remaining, bust });
    });
  }
  return { legIndex: leg.legIndex, startingScore, players: playerIds.map((playerId) => ({ playerId, points: lines.get(playerId) ?? [] })) };
}
