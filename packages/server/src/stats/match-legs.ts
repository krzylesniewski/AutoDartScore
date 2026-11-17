import type { X01MatchState } from '@autoscore/engine';
import type { DomainEvent, LegWon, MatchLeg } from '@autoscore/schema';
import { legTurnsOf } from '../leg-turns.js';
import { threeDartAverage } from './tally.js';

// Historia legów meczu 1v1 od legu 0 do bieżącego. Po match_won silnik zostaje na ostatnim legu,
// a w trwającym meczu po wygranym legu legIndex wskazuje już nowy leg bez tur.
export function buildMatchLegs(state: X01MatchState, events: readonly DomainEvent[]): MatchLeg[] {
  const { playerIds, firstPlayerIndex } = state.config;
  const wins = new Map<number, LegWon>();
  for (const event of events) {
    if (event.type === 'leg_won') {
      wins.set(event.legIndex, event);
    }
  }

  const legs: MatchLeg[] = [];
  for (let legIndex = 0; legIndex <= state.legIndex; legIndex += 1) {
    const turns = legTurnsOf(events, legIndex);
    const won = wins.get(legIndex);
    legs.push({
      legIndex,
      // Silnik zaczyna leg 0 od wylosowanego gracza, a potem gracze zaczynają na przemian.
      starterId: playerIds[(firstPlayerIndex + legIndex) % 2] as string,
      winnerId: won?.playerId ?? null,
      checkout: won?.checkout ?? null,
      dartsThrown: won?.dartsThrown ?? null,
      players: playerIds.map((playerId) => {
        const own = turns.filter((turn) => turn.playerId === playerId);
        const darts = own.reduce((sum, turn) => sum + turn.darts.length, 0);
        const points = own.reduce((sum, turn) => sum + turn.points, 0);
        return { playerId, darts, average: threeDartAverage(points, darts) };
      }),
      turns,
    });
  }
  return legs;
}
