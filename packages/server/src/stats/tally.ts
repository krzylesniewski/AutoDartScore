import { hitPoints } from '@autoscore/engine';
import type { DomainEvent, Hit, MatchSummaryLeg, MatchType, PlayerStatLine } from '@autoscore/schema';

// Czysta logika statystyk: ze zdarzeń domenowych odtworzonej gry, bez I/O. Liczą się tylko zamknięte tury.

export interface PlayerTotals {
  readonly points: number;
  readonly darts: number;
  readonly first9Points: number;
  readonly first9Darts: number;
  readonly scores180: number;
  readonly scores140: number;
  readonly scores100: number;
  readonly scores60: number;
  readonly highestCheckout: number | null;
  readonly highestTurn: number | null;
  readonly doubleAttempts: number;
  readonly doublesHit: number;
  readonly bestLegDarts: number | null;
  readonly legsWon: number;
}

export interface GameTally {
  readonly players: ReadonlyMap<string, PlayerTotals>;
  readonly legs: readonly MatchSummaryLeg[];
  readonly winnerId: string | null; // match_won w 1v1 albo 1. miejsce w zabawie
}

const FIRST_9_TURNS = 3;

export const EMPTY_TOTALS: PlayerTotals = {
  points: 0,
  darts: 0,
  first9Points: 0,
  first9Darts: 0,
  scores180: 0,
  scores140: 0,
  scores100: 0,
  scores60: 0,
  highestCheckout: null,
  highestTurn: null,
  doubleAttempts: 0,
  doublesHit: 0,
  bestLegDarts: null,
  legsWon: 0,
};

// Wynik, który da się zamknąć jedną rzutką: double 1-20 albo Bull.
function isOneDartFinish(score: number): boolean {
  return score === 50 || (score >= 2 && score <= 40 && score % 2 === 0);
}

function doubleAttempts(startScore: number, darts: readonly Hit[]): number {
  let score = startScore;
  let attempts = 0;
  for (const dart of darts) {
    if (isOneDartFinish(score)) {
      attempts += 1;
    }
    score -= hitPoints(dart);
  }
  return attempts;
}

function bucket(total: number): Partial<Record<'scores180' | 'scores140' | 'scores100' | 'scores60', 1>> {
  if (total === 180) {
    return { scores180: 1 };
  }
  if (total >= 140) {
    return { scores140: 1 };
  }
  if (total >= 100) {
    return { scores100: 1 };
  }
  return total >= 60 ? { scores60: 1 } : {};
}

function minOrNull(a: number | null, b: number | null): number | null {
  if (a === null) {
    return b;
  }
  return b === null ? a : Math.min(a, b);
}

function maxOrNull(a: number | null, b: number | null): number | null {
  if (a === null) {
    return b;
  }
  return b === null ? a : Math.max(a, b);
}

export function mergeTotals(a: PlayerTotals, b: Partial<PlayerTotals>): PlayerTotals {
  const add = (key: Exclude<keyof PlayerTotals, 'highestCheckout' | 'highestTurn' | 'bestLegDarts'>) => a[key] + (b[key] ?? 0);
  return {
    points: add('points'),
    darts: add('darts'),
    first9Points: add('first9Points'),
    first9Darts: add('first9Darts'),
    scores180: add('scores180'),
    scores140: add('scores140'),
    scores100: add('scores100'),
    scores60: add('scores60'),
    highestCheckout: maxOrNull(a.highestCheckout, b.highestCheckout ?? null),
    highestTurn: maxOrNull(a.highestTurn, b.highestTurn ?? null),
    doubleAttempts: add('doubleAttempts'),
    doublesHit: add('doublesHit'),
    bestLegDarts: minOrNull(a.bestLegDarts, b.bestLegDarts ?? null),
    legsWon: add('legsWon'),
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function threeDartAverage(points: number, darts: number): number | null {
  return darts === 0 ? null : round((3 * points) / darts, 2);
}

export function toStatLine(totals: PlayerTotals): PlayerStatLine {
  return {
    dartsThrown: totals.darts,
    points: totals.points,
    average: threeDartAverage(totals.points, totals.darts),
    first9Average: threeDartAverage(totals.first9Points, totals.first9Darts),
    scores180: totals.scores180,
    scores140: totals.scores140,
    scores100: totals.scores100,
    scores60: totals.scores60,
    highestCheckout: totals.highestCheckout,
    doubleAttempts: totals.doubleAttempts,
    doublesHit: totals.doublesHit,
    doublesPercent: totals.doubleAttempts === 0 ? null : round((100 * totals.doublesHit) / totals.doubleAttempts, 1),
    bestLegDarts: totals.bestLegDarts,
    legsWon: totals.legsWon,
  };
}

export function tallyGame(type: MatchType, playerIds: readonly string[], events: readonly DomainEvent[]): GameTally {
  const totals = new Map(playerIds.map((id) => [id, EMPTY_TOTALS]));
  const turnsInLeg = new Map<string, number>();
  const legPoints = new Map<string, { points: number; darts: number }>();
  const legs: MatchSummaryLeg[] = [];
  let winnerId: string | null = null;

  const add = (playerId: string, delta: Partial<PlayerTotals>) => {
    totals.set(playerId, mergeTotals(totals.get(playerId) ?? EMPTY_TOTALS, delta));
  };

  const addTurn = (playerId: string, legIndex: number, points: number, darts: readonly Hit[], startScore: number) => {
    const key = `${legIndex}:${playerId}`;
    const turn = turnsInLeg.get(key) ?? 0;
    turnsInLeg.set(key, turn + 1);
    const first9 = turn < FIRST_9_TURNS ? { first9Points: points, first9Darts: darts.length } : {};
    add(playerId, { points, darts: darts.length, doubleAttempts: doubleAttempts(startScore, darts), ...first9 });
    const leg = legPoints.get(key) ?? { points: 0, darts: 0 };
    legPoints.set(key, { points: leg.points + points, darts: leg.darts + darts.length });
  };

  const addFinish = (playerId: string, checkout: number, dartsThrown: number, legWon: boolean) => {
    add(playerId, { highestCheckout: checkout, doublesHit: 1, bestLegDarts: dartsThrown, legsWon: legWon ? 1 : 0 });
  };

  for (const event of events) {
    switch (event.type) {
      case 'turn_completed':
        addTurn(event.playerId, event.legIndex, event.total, event.darts, event.remaining + event.total);
        add(event.playerId, { ...bucket(event.total), highestTurn: event.total });
        break;
      case 'bust':
        addTurn(event.playerId, event.legIndex, 0, event.darts, event.remaining);
        break;
      case 'leg_won': {
        // Solo 501 liczy się do zamknięć i najlepszego lega, ale nie do wygranych legów.
        addFinish(event.playerId, event.checkout, event.dartsThrown, type === 'match');
        const legIndex = event.legIndex;
        legs.push({
          legIndex,
          winnerId: event.playerId,
          checkout: event.checkout,
          dartsThrown: event.dartsThrown,
          averages: playerIds.map((playerId) => {
            const leg = legPoints.get(`${legIndex}:${playerId}`) ?? { points: 0, darts: 0 };
            return { playerId, average: threeDartAverage(leg.points, leg.darts) };
          }),
        });
        break;
      }
      case 'player_finished':
        addFinish(event.playerId, event.checkout, event.dartsThrown, event.place === 1);
        if (event.place === 1) {
          winnerId = event.playerId;
        }
        break;
      case 'match_won':
        winnerId = event.playerId;
        break;
      case 'casual_finished':
        break;
    }
  }

  return { players: totals, legs, winnerId };
}
