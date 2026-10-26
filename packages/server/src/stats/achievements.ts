import type { Achievement, AchievementKind, DomainEvent } from '@autoscore/schema';
import { completedPlayerLegs } from './completed-legs.js';
import { maxOrNull, minOrNull, tallyGame } from './tally.js';

// Osiągnięcia w meczu 1v1: rekordy gracza i pierwsze tury powyżej progu. Czysta logika na zdarzeniach domenowych, bez I/O.

export interface PlayerRecords {
  readonly highestTurn: number | null;
  readonly highestCheckout: number | null;
  readonly fewestDartsInWonLeg: number | null;
  readonly mostDartsInLeg: number | null; // ukończone legi, wygrane i przegrane, z bustami
}

export type DetectedAchievement = Omit<Achievement, 'matchId' | 'eventSeq'>;

export const EMPTY_RECORDS: PlayerRecords = {
  highestTurn: null,
  highestCheckout: null,
  fewestDartsInWonLeg: null,
  mostDartsInLeg: null,
};

const FIRST_THRESHOLDS = [
  { kind: 'first_180', threshold: 180 },
  { kind: 'first_140', threshold: 140 },
  { kind: 'first_120', threshold: 120 },
  { kind: 'first_100', threshold: 100 },
] as const;

export function mergeRecords(a: PlayerRecords, b: PlayerRecords): PlayerRecords {
  return {
    highestTurn: maxOrNull(a.highestTurn, b.highestTurn),
    highestCheckout: maxOrNull(a.highestCheckout, b.highestCheckout),
    fewestDartsInWonLeg: minOrNull(a.fewestDartsInWonLeg, b.fewestDartsInWonLeg),
    mostDartsInLeg: maxOrNull(a.mostDartsInLeg, b.mostDartsInLeg),
  };
}

export function buildRecords(playerIds: readonly string[], events: readonly DomainEvent[]): ReadonlyMap<string, PlayerRecords> {
  const tally = tallyGame('match', playerIds, events);
  const legs = completedPlayerLegs('match', playerIds, events);
  return new Map(
    playerIds.map((playerId) => {
      const totals = tally.players.get(playerId);
      const darts = legs.filter((leg) => leg.playerId === playerId).map((leg) => leg.darts);
      return [
        playerId,
        {
          highestTurn: totals?.highestTurn ?? null,
          highestCheckout: totals?.highestCheckout ?? null,
          fewestDartsInWonLeg: totals?.bestLegDarts ?? null,
          mostDartsInLeg: darts.length === 0 ? null : Math.max(...darts),
        },
      ];
    }),
  );
}

// Rekord to wynik ściśle lepszy. Bez wartości odniesienia rekord milczy i tylko ją ustala.
function beats(value: number, previous: number | null, better: (a: number, b: number) => boolean): previous is number {
  return previous !== null && better(value, previous);
}

function firstThreshold(total: number, highestTurn: number | null): AchievementKind | null {
  const reached = FIRST_THRESHOLDS.find(({ threshold }) => total >= threshold && (highestTurn === null || highestTurn < threshold));
  return reached?.kind ?? null;
}

export interface DetectInput {
  readonly reference: ReadonlyMap<string, PlayerRecords>; // z ukończonych wcześniejszych meczów 1v1
  readonly earlierEvents: readonly DomainEvent[]; // bieżący mecz przed tą rzutką
  readonly newEvents: readonly DomainEvent[]; // zdarzenia tej rzutki
  readonly playerIds: readonly string[];
  readonly eligible: ReadonlySet<string>;
}

export function detectAchievements({ reference, earlierEvents, newEvents, playerIds, eligible }: DetectInput): DetectedAchievement[] {
  const groups: Record<'first' | 'turn' | 'checkout' | 'shortest' | 'longest', DetectedAchievement[]> = {
    first: [],
    turn: [],
    checkout: [],
    shortest: [],
    longest: [],
  };
  const achievement = (playerId: string, kind: AchievementKind, value: number, previous: number | null): DetectedAchievement => ({
    type: 'achievement',
    playerId,
    kind,
    value,
    previous,
  });

  const seen = [...earlierEvents];
  for (const event of newEvents) {
    // Odniesienie liczone przed każdym zdarzeniem, więc wcześniejsze tury tego meczu, także z bieżącego lega, też się liczą.
    const current = buildRecords(playerIds, seen);
    const records = (playerId: string) => mergeRecords(reference.get(playerId) ?? EMPTY_RECORDS, current.get(playerId) ?? EMPTY_RECORDS);
    seen.push(event);

    if (event.type === 'turn_completed' && eligible.has(event.playerId)) {
      const { highestTurn } = records(event.playerId);
      const first = firstThreshold(event.total, highestTurn);
      if (first) {
        groups.first.push(achievement(event.playerId, first, event.total, null));
      }
      if (beats(event.total, highestTurn, (a, b) => a > b)) {
        groups.turn.push(achievement(event.playerId, 'turn_record', event.total, highestTurn));
      }
    }

    if (event.type === 'leg_won') {
      const winner = event.playerId;
      if (eligible.has(winner)) {
        const { highestCheckout, fewestDartsInWonLeg } = records(winner);
        if (beats(event.checkout, highestCheckout, (a, b) => a > b)) {
          groups.checkout.push(achievement(winner, 'checkout_record', event.checkout, highestCheckout));
        }
        if (beats(event.dartsThrown, fewestDartsInWonLeg, (a, b) => a < b)) {
          groups.shortest.push(achievement(winner, 'shortest_leg', event.dartsThrown, fewestDartsInWonLeg));
        }
      }
      const legs = completedPlayerLegs('match', playerIds, seen).filter((leg) => leg.legIndex === event.legIndex);
      for (const playerId of [winner, ...playerIds.filter((id) => id !== winner)]) {
        const darts = legs.find((leg) => leg.playerId === playerId)?.darts;
        const { mostDartsInLeg } = records(playerId);
        if (darts !== undefined && eligible.has(playerId) && beats(darts, mostDartsInLeg, (a, b) => a > b)) {
          groups.longest.push(achievement(playerId, 'longest_leg', darts, mostDartsInLeg));
        }
      }
    }
  }

  return [...groups.first, ...groups.turn, ...groups.checkout, ...groups.shortest, ...groups.longest];
}
