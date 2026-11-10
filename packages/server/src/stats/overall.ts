import type { OverallPlayer, StatsOverall } from '@autoscore/schema';
import { byName, type RankingsInput } from './rankings.js';
import { round, threeDartAverage } from './tally.js';

// Czysta logika widoku Overall, bez I/O. Lotki liczą każdą zamkniętą turę, a średnie tylko ukończone legi, jak w rankingu.

export function buildOverall({ players, games }: RankingsInput): StatsOverall {
  const legs = new Map<string, { points: number; darts: number; legs: number }>();
  const darts = new Map<string, number>();
  let gameCount = 0;
  let legCount = 0;

  for (const game of games) {
    if (game.legs.length > 0) {
      gameCount += 1;
    }
    legCount += new Set(game.legs.map((leg) => leg.legIndex)).size;
    for (const leg of game.legs) {
      const current = legs.get(leg.playerId) ?? { points: 0, darts: 0, legs: 0 };
      legs.set(leg.playerId, { points: current.points + leg.points, darts: current.darts + leg.darts, legs: current.legs + 1 });
    }
    for (const [playerId, totals] of game.tally.players) {
      darts.set(playerId, (darts.get(playerId) ?? 0) + totals.darts);
    }
  }

  const listed = players.flatMap((player) => {
    const own = darts.get(player.id) ?? 0;
    if (own === 0) {
      return [];
    }
    const completed = legs.get(player.id);
    return [{ player, darts: own, legs: completed?.legs ?? 0, average: completed ? threeDartAverage(completed.points, completed.darts) : null }];
  });

  // Każdy gracz z ukończonym legiem waży tyle samo, także poniżej MIN_LEGS_FOR_AVERAGE.
  const averages = listed.flatMap((entry) => (entry.average === null ? [] : [entry.average]));
  const average = averages.length === 0 ? null : round(averages.reduce((sum, value) => sum + value, 0) / averages.length, 2);

  const rows = listed.map(({ player, darts: own, legs: count, average: value }) => {
    const difference = value === null || average === null ? null : round(value - average, 2);
    const row: OverallPlayer = {
      playerId: player.id,
      name: player.name,
      avatar: player.avatar,
      color: player.color,
      darts: own,
      legs: count,
      average: value,
      difference: difference === 0 ? 0 : difference, // bez -0
    };
    return { player, row };
  });

  const withAverage = rows
    .filter(({ row }) => row.difference !== null)
    .sort((a, b) => (b.row.difference ?? 0) - (a.row.difference ?? 0) || byName(a.player, b.player));
  const withoutAverage = rows
    .filter(({ row }) => row.difference === null)
    .sort((a, b) => b.row.darts - a.row.darts || byName(a.player, b.player));

  return {
    games: gameCount,
    legs: legCount,
    darts: listed.reduce((sum, entry) => sum + entry.darts, 0),
    average,
    players: [...withAverage, ...withoutAverage].map(({ row }) => row),
  };
}
