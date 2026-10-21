import type { MatchType, Player } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import type { PlayerLeg } from './completed-legs.js';
import { buildRankings, type RankedGame } from './rankings.js';
import { EMPTY_TOTALS, type PlayerTotals } from './tally.js';

const createdAt = '2026-10-15T18:30:00.000Z';

function profile(id: string, name: string, color: number): Player {
  return { id, name, avatar: null, color, guest: false, archivedAt: null, createdAt };
}

const anna = profile('anna', 'Anna', 1);
const bartek = profile('bartek', 'Bartek', 7);
const celina = profile('celina', 'Celina', 12);
const darek = profile('darek', 'Darek', 16);

// Leg z 3 rzutkami, więc średnia na 3 rzutki równa się punktom.
function leg(playerId: string, legIndex: number, average: number): PlayerLeg {
  return { playerId, legIndex, points: average, darts: 3 };
}

function game(legs: PlayerLeg[], totals: Record<string, Partial<PlayerTotals>> = {}, type: MatchType = 'match'): RankedGame {
  return {
    type,
    legs,
    tally: {
      players: new Map(Object.entries(totals).map(([id, own]) => [id, { ...EMPTY_TOTALS, ...own }])),
      legs: [],
      winnerId: null,
    },
  };
}

// Trzy legi tej samej gry, każdy z tą samą średnią, żeby gracz miał pozycję.
function threeLegs(playerId: string, average: number): PlayerLeg[] {
  return [0, 1, 2].map((legIndex) => leg(playerId, legIndex, average));
}

describe('buildRankings', () => {
  it('gives empty lists and zeros without games', () => {
    expect(buildRankings({ players: [anna, bartek], games: [] })).toEqual({
      games: 0,
      legs: 0,
      players: [],
      bestLegAverage: [],
      highestCheckout: [],
      shortestLeg: [],
      highestTurn: [],
    });
  });

  it('shares a position on a tie and skips the next one', () => {
    const rankings = buildRankings({
      players: [anna, bartek, celina],
      games: [game([...threeLegs('celina', 40), ...threeLegs('bartek', 50), ...threeLegs('anna', 50)])],
    });
    expect(rankings.players.map((entry) => [entry.name, entry.position, entry.average])).toEqual([
      ['Anna', 1, 50],
      ['Bartek', 1, 50],
      ['Celina', 3, 40],
    ]);
  });

  it('keeps every entry tied for 3rd place in a tile', () => {
    const rankings = buildRankings({
      players: [anna, bartek, celina, darek],
      games: [game([], { anna: { highestCheckout: 100 }, bartek: { highestCheckout: 80 }, celina: { highestCheckout: 40 }, darek: { highestCheckout: 40 } })],
    });
    expect(rankings.highestCheckout.map((entry) => [entry.name, entry.position, entry.value])).toEqual([
      ['Anna', 1, 100],
      ['Bartek', 2, 80],
      ['Celina', 3, 40],
      ['Darek', 3, 40],
    ]);
  });

  it('cuts a tile after 3rd place', () => {
    const rankings = buildRankings({
      players: [anna, bartek, celina, darek],
      games: [game([], { anna: { highestCheckout: 100 }, bartek: { highestCheckout: 80 }, celina: { highestCheckout: 60 }, darek: { highestCheckout: 40 } })],
    });
    expect(rankings.highestCheckout.map((entry) => entry.name)).toEqual(['Anna', 'Bartek', 'Celina']);
  });

  it('needs 3 completed legs for a position and the record leg', () => {
    const rankings = buildRankings({
      players: [anna, bartek, celina],
      games: [game([...threeLegs('anna', 30), leg('bartek', 0, 90), leg('bartek', 1, 60), leg('celina', 0, 45)])],
    });
    expect(rankings.players).toEqual([
      { playerId: 'anna', name: 'Anna', avatar: null, color: 1, position: 1, average: 30, legs: 3 },
      { playerId: 'bartek', name: 'Bartek', avatar: null, color: 7, position: null, average: 75, legs: 2 },
      { playerId: 'celina', name: 'Celina', avatar: null, color: 12, position: null, average: 45, legs: 1 },
    ]);
    expect(rankings.bestLegAverage.map((entry) => entry.name)).toEqual(['Anna']);
  });

  it('averages over all completed legs and takes the best single leg', () => {
    const rankings = buildRankings({
      players: [anna],
      games: [game([leg('anna', 0, 60), leg('anna', 1, 30)]), game([{ playerId: 'anna', legIndex: 0, points: 100, darts: 6 }])],
    });
    expect(rankings.players[0]).toMatchObject({ position: 1, average: 47.5, legs: 3 });
    expect(rankings.bestLegAverage).toEqual([{ playerId: 'anna', name: 'Anna', avatar: null, color: 1, position: 1, value: 60 }]);
    expect(rankings).toMatchObject({ games: 2, legs: 3 });
  });

  it('sorts the shortest leg ascending', () => {
    const rankings = buildRankings({
      players: [anna, bartek, celina],
      games: [game([], { anna: { bestLegDarts: 21 }, bartek: { bestLegDarts: 15 }, celina: { bestLegDarts: null } })],
    });
    expect(rankings.shortestLeg.map((entry) => [entry.name, entry.value])).toEqual([
      ['Bartek', 15],
      ['Anna', 21],
    ]);
  });

  it('takes the highest 1v1 turn across games, descending with shared positions', () => {
    const rankings = buildRankings({
      players: [anna, bartek, celina, darek],
      games: [
        game([], { anna: { highestTurn: 100 }, bartek: { highestTurn: 140 }, celina: { highestTurn: 60 }, darek: { highestTurn: 45 } }),
        game([], { anna: { highestTurn: 140 }, bartek: { highestTurn: 81 } }),
      ],
    });
    expect(rankings.highestTurn.map((entry) => [entry.name, entry.position, entry.value])).toEqual([
      ['Anna', 1, 140],
      ['Bartek', 1, 140],
      ['Celina', 3, 60],
    ]);
  });

  it('ignores the highest turn of casual and practice games', () => {
    const rankings = buildRankings({
      players: [anna, bartek],
      games: [game([], { anna: { highestTurn: 60 } }), game([], { anna: { highestTurn: 180 } }, 'casual'), game([], { bartek: { highestTurn: 180 } }, 'practice')],
    });
    expect(rankings.highestTurn).toEqual([{ playerId: 'anna', name: 'Anna', avatar: null, color: 1, position: 1, value: 60 }]);
  });

  it('ranks a highest turn of 0 and leaves out a player without a closed turn', () => {
    const rankings = buildRankings({
      players: [anna, bartek],
      games: [game([], { anna: { highestTurn: 0 }, bartek: { highestTurn: null } })],
    });
    expect(rankings.highestTurn).toEqual([{ playerId: 'anna', name: 'Anna', avatar: null, color: 1, position: 1, value: 0 }]);
  });

  it('counts a guest game and its legs without listing the guest', () => {
    const rankings = buildRankings({
      players: [anna],
      games: [game([...threeLegs('anna', 40), ...threeLegs('guest', 99)], { anna: { highestCheckout: 40 }, guest: { highestCheckout: 170, highestTurn: 180, bestLegDarts: 9 } })],
    });
    expect(rankings.games).toBe(1);
    expect(rankings.legs).toBe(3);
    expect(rankings.players.map((entry) => entry.playerId)).toEqual(['anna']);
    expect(rankings.bestLegAverage.map((entry) => entry.playerId)).toEqual(['anna']);
    expect(rankings.highestCheckout.map((entry) => entry.playerId)).toEqual(['anna']);
    expect(rankings.highestTurn).toEqual([]);
    expect(rankings.shortestLeg).toEqual([]);
  });

  it('does not count a game without a completed leg', () => {
    expect(buildRankings({ players: [anna], games: [game([], { anna: { highestTurn: 180 } })] })).toMatchObject({ games: 0, legs: 0, players: [] });
  });
});
