import { describe, expect, it } from 'vitest';
import { FORM_GAMES, HeadToHead, MIN_LEGS_FOR_AVERAGE, MatchSummary, PlayerForm, PlayerFormQuery, PlayerStats, PlayerStatsQuery, RankedPlayer, RankingEntry, RankingsQuery, StatsRankings, type PlayerStatLine } from './index.js';

const line: PlayerStatLine = {
  dartsThrown: 6,
  points: 301,
  average: 150.5,
  first9Average: 150.5,
  scores180: 1,
  scores140: 0,
  scores100: 1,
  scores60: 0,
  highestCheckout: 121,
  doubleAttempts: 1,
  doublesHit: 1,
  doublesPercent: 100,
  bestLegDarts: 6,
  legsWon: 1,
};

const empty: PlayerStatLine = {
  dartsThrown: 0,
  points: 0,
  average: null,
  first9Average: null,
  scores180: 0,
  scores140: 0,
  scores100: 0,
  scores60: 0,
  highestCheckout: null,
  doubleAttempts: 0,
  doublesHit: 0,
  doublesPercent: null,
  bestLegDarts: null,
  legsWon: 0,
};

describe('PlayerStats', () => {
  it('parses a stat line with the profile totals', () => {
    const stats = { ...line, playerId: 'p1', filter: 'all', matchesPlayed: 1, matchesWon: 1 };
    expect(PlayerStats.parse(stats)).toEqual(stats);
  });

  it('parses a player without throws', () => {
    expect(PlayerStats.safeParse({ ...empty, playerId: 'p1', filter: 'match', matchesPlayed: 0, matchesWon: 0 }).success).toBe(true);
  });

  it('rejects doublesPercent above 100', () => {
    expect(PlayerStats.safeParse({ ...line, doublesPercent: 100.1, playerId: 'p1', filter: 'all', matchesPlayed: 1, matchesWon: 1 }).success).toBe(false);
  });

  it('rejects a checkout above 170', () => {
    expect(PlayerStats.safeParse({ ...line, highestCheckout: 171, playerId: 'p1', filter: 'all', matchesPlayed: 1, matchesWon: 1 }).success).toBe(false);
  });
});

describe('PlayerStatsQuery', () => {
  it('defaults the filter to all', () => {
    expect(PlayerStatsQuery.parse({})).toEqual({ type: 'all' });
  });

  it.each(['match', 'casual', 'practice'])('accepts %s', (type) => {
    expect(PlayerStatsQuery.parse({ type })).toEqual({ type });
  });

  it('rejects an unknown filter', () => {
    expect(PlayerStatsQuery.safeParse({ type: 'bogus' }).success).toBe(false);
  });
});

describe('MatchSummary', () => {
  it('parses a finished 1v1 with one leg', () => {
    const summary = {
      matchId: 'm1',
      type: 'match',
      finished: true,
      eventSeq: 9,
      players: [
        { ...line, playerId: 'p1' },
        { ...empty, dartsThrown: 3, average: 0, first9Average: 0, playerId: 'p2' },
      ],
      legs: [
        {
          legIndex: 0,
          winnerId: 'p1',
          checkout: 121,
          dartsThrown: 6,
          averages: [
            { playerId: 'p1', average: 150.5 },
            { playerId: 'p2', average: 0 },
          ],
        },
      ],
    };
    expect(MatchSummary.parse(summary)).toEqual(summary);
  });

  it('rejects an unknown game type', () => {
    expect(MatchSummary.safeParse({ matchId: 'm1', type: 'cricket', finished: false, eventSeq: 0, players: [], legs: [] }).success).toBe(false);
  });
});

describe('StatsRankings', () => {
  const anna = { playerId: 'p1', name: 'Anna', avatar: '🎯' };
  const bartek = { playerId: 'p2', name: 'Bartek', avatar: null };

  it('parses a ranking with a ranked and an unranked player', () => {
    const rankings = {
      filter: 'all',
      games: 2,
      legs: 4,
      players: [
        { ...anna, position: 1, average: 60.5, legs: 4 },
        { ...bartek, position: null, average: 45, legs: 2 },
      ],
      bestLegAverage: [{ ...anna, position: 1, value: 75.25 }],
      highestCheckout: [
        { ...anna, position: 1, value: 40 },
        { ...bartek, position: 1, value: 40 },
      ],
      shortestLeg: [{ ...anna, position: 1, value: 15 }],
      scores180: [],
    };
    expect(StatsRankings.parse(rankings)).toEqual(rankings);
  });

  it('accepts position null only for a ranked player', () => {
    expect(RankedPlayer.safeParse({ ...anna, position: null, average: 50, legs: 1 }).success).toBe(true);
    expect(RankingEntry.safeParse({ ...anna, position: null, value: 50 }).success).toBe(false);
  });

  it('rejects position 0', () => {
    expect(RankingEntry.safeParse({ ...anna, position: 0, value: 50 }).success).toBe(false);
  });

  it('needs 3 legs for an average', () => {
    expect(MIN_LEGS_FOR_AVERAGE).toBe(3);
  });
});

describe('RankingsQuery', () => {
  it('defaults the filter to all', () => {
    expect(RankingsQuery.parse({})).toEqual({ type: 'all' });
  });

  it('rejects an unknown filter', () => {
    expect(RankingsQuery.safeParse({ type: 'bogus' }).success).toBe(false);
  });
});

describe('HeadToHead', () => {
  const headToHead = {
    playerId: 'p1',
    opponentId: 'p2',
    matchesPlayed: 4,
    matchesWon: 3,
    opponentMatchesWon: 1,
    legsWon: 7,
    opponentLegsWon: 4,
    average: 61.5,
    opponentAverage: 55.25,
    lastPlayedAt: '2026-10-15T18:30:00.000Z',
  };

  it('parses a head-to-head record', () => {
    expect(HeadToHead.parse(headToHead)).toEqual(headToHead);
  });

  it('accepts a record without games', () => {
    const empty = { ...headToHead, matchesPlayed: 0, matchesWon: 0, opponentMatchesWon: 0, legsWon: 0, opponentLegsWon: 0, average: null, opponentAverage: null, lastPlayedAt: null };
    expect(HeadToHead.parse(empty)).toEqual(empty);
  });

  it('rejects a negative count', () => {
    expect(HeadToHead.safeParse({ ...headToHead, legsWon: -1 }).success).toBe(false);
  });
});

describe('PlayerForm', () => {
  const point = (index: number) => ({ matchId: `m${index}`, type: 'match', createdAt: '2026-10-15T18:30:00.000Z', average: 50 + index, legs: 1 });

  it('parses the form points', () => {
    const form = { playerId: 'p1', filter: 'all', points: [point(1), { ...point(2), type: 'practice', legs: 1 }] };
    expect(PlayerForm.parse(form)).toEqual(form);
  });

  it(`rejects more than ${FORM_GAMES} points`, () => {
    const points = Array.from({ length: FORM_GAMES + 1 }, (_, index) => point(index));
    expect(PlayerForm.safeParse({ playerId: 'p1', filter: 'all', points }).success).toBe(false);
    expect(PlayerForm.safeParse({ playerId: 'p1', filter: 'all', points: points.slice(1) }).success).toBe(true);
  });

  it('rejects a point without a completed leg', () => {
    expect(PlayerForm.safeParse({ playerId: 'p1', filter: 'all', points: [{ ...point(1), legs: 0 }] }).success).toBe(false);
  });

  it('keeps the last 20 games and defaults the filter to all', () => {
    expect(FORM_GAMES).toBe(20);
    expect(PlayerFormQuery.parse({})).toEqual({ type: 'all' });
    expect(PlayerFormQuery.safeParse({ type: 'bogus' }).success).toBe(false);
  });
});
