import { describe, expect, it } from 'vitest';
import { MatchSummary, PlayerStats, PlayerStatsQuery, type PlayerStatLine } from './index.js';

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
