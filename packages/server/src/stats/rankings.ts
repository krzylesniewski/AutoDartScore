import { MIN_LEGS_FOR_AVERAGE, type Player, type RankedPlayer, type RankingEntry, type StatsRankings } from '@autoscore/schema';
import type { PlayerLeg } from './completed-legs.js';
import { EMPTY_TOTALS, mergeTotals, threeDartAverage, type GameTally, type PlayerTotals } from './tally.js';

// Czysta logika rankingu graczy, bez I/O. Średnie liczą tylko ukończone legi, rekordy biorą wynik z tallyGame.

export interface RankedGame {
  readonly legs: readonly PlayerLeg[];
  readonly tally: GameTally;
}

export interface RankingsInput {
  readonly players: readonly Player[]; // tylko zapisani gracze, bez gości
  readonly games: readonly RankedGame[];
}

const TOP = 3;

type Profile = Pick<Player, 'id' | 'name' | 'avatar'>;

interface Candidate {
  readonly player: Profile;
  readonly value: number;
}

function byName(a: Profile, b: Profile): number {
  return a.name.localeCompare(b.name, 'pl') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// Remis daje tę samą pozycję, a następna jest pomijana: 50, 50, 40 to 1, 1, 3.
function positioned<T extends Candidate>(candidates: readonly T[], order: 'asc' | 'desc'): (T & { position: number })[] {
  const sign = order === 'desc' ? -1 : 1;
  const sorted = [...candidates].sort((a, b) => sign * (a.value - b.value) || byName(a.player, b.player));
  const result: (T & { position: number })[] = [];
  sorted.forEach((candidate, index) => {
    const previous = result[index - 1];
    result.push({ ...candidate, position: previous?.value === candidate.value ? previous.position : index + 1 });
  });
  return result;
}

function top(candidates: readonly Candidate[], order: 'asc' | 'desc'): RankingEntry[] {
  return positioned(candidates, order)
    .filter((entry) => entry.position <= TOP)
    .map(({ player, value, position }) => ({ playerId: player.id, name: player.name, avatar: player.avatar, position, value }));
}

export function buildRankings({ players, games }: RankingsInput): Omit<StatsRankings, 'filter'> {
  const legs = new Map<string, { points: number; darts: number; legs: number; bestLeg: number }>();
  const totals = new Map<string, PlayerTotals>();
  let gameCount = 0;
  let legCount = 0;

  for (const game of games) {
    if (game.legs.length > 0) {
      gameCount += 1;
    }
    legCount += new Set(game.legs.map((leg) => leg.legIndex)).size;
    for (const leg of game.legs) {
      const current = legs.get(leg.playerId) ?? { points: 0, darts: 0, legs: 0, bestLeg: 0 };
      legs.set(leg.playerId, {
        points: current.points + leg.points,
        darts: current.darts + leg.darts,
        legs: current.legs + 1,
        bestLeg: Math.max(current.bestLeg, threeDartAverage(leg.points, leg.darts) ?? 0),
      });
    }
    for (const [playerId, playerTotals] of game.tally.players) {
      totals.set(playerId, mergeTotals(totals.get(playerId) ?? EMPTY_TOTALS, playerTotals));
    }
  }

  const withLegs = players.flatMap((player) => {
    const own = legs.get(player.id);
    return own ? [{ player, value: threeDartAverage(own.points, own.darts) ?? 0, legs: own.legs, bestLeg: own.bestLeg }] : [];
  });
  const qualified = withLegs.filter((entry) => entry.legs >= MIN_LEGS_FOR_AVERAGE);
  const toRanked = ({ player, value, legs: count, position }: (typeof withLegs)[number] & { position: number | null }): RankedPlayer => ({
    playerId: player.id,
    name: player.name,
    avatar: player.avatar,
    position,
    average: value,
    legs: count,
  });
  const ranked = positioned(qualified, 'desc').map(toRanked);
  const unranked = withLegs
    .filter((entry) => entry.legs < MIN_LEGS_FOR_AVERAGE)
    .sort((a, b) => b.legs - a.legs || byName(a.player, b.player))
    .map((entry) => toRanked({ ...entry, position: null }));

  const fromTotals = (pick: (own: PlayerTotals) => number | null): Candidate[] =>
    players.flatMap((player) => {
      const own = totals.get(player.id);
      const value = own ? pick(own) : null;
      return value === null ? [] : [{ player, value }];
    });

  return {
    games: gameCount,
    legs: legCount,
    players: [...ranked, ...unranked],
    bestLegAverage: top(
      qualified.map((entry) => ({ player: entry.player, value: entry.bestLeg })),
      'desc',
    ),
    highestCheckout: top(fromTotals((own) => own.highestCheckout), 'desc'),
    shortestLeg: top(fromTotals((own) => own.bestLegDarts), 'asc'),
    scores180: top(fromTotals((own) => (own.scores180 >= 1 ? own.scores180 : null)), 'desc'),
  };
}
