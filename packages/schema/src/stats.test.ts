import { describe, expect, it } from 'vitest';
import { FORM_GAMES, FREQUENT_HITS_LIMIT, FrequentHitsResponse, HeadToHead, LegProgress, LegProgressPoint, MIN_LEGS_FOR_AVERAGE, MatchSummary, OverallPlayer, PlayerForm, PlayerFormQuery, PlayerStats, PlayerStatsQuery, RankedPlayer, RankingEntry, RankingsQuery, StatsOverall, StatsRankings, type PlayerStatLine } from './index.js';

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
      lastLegProgress: null,
      checkouts: null,
    };
    expect(MatchSummary.parse(summary)).toEqual(summary);
  });

  const progress = {
    legIndex: 0,
    startingScore: 301,
    players: [
      {
        playerId: 'p1',
        points: [
          { dart: 1, remaining: 241, bust: false },
          { dart: 2, remaining: 181, bust: false },
          { dart: 3, remaining: 301, bust: true },
        ],
      },
      { playerId: 'p2', points: [] },
    ],
  };
  const unfinished = { matchId: 'm1', type: 'casual', finished: false, eventSeq: 6, players: [{ ...empty, playerId: 'p1' }], legs: [], checkouts: null };

  it('parses a summary with the progress of the last leg', () => {
    const summary = { ...unfinished, lastLegProgress: progress };
    expect(MatchSummary.parse(summary)).toEqual(summary);
  });

  it('parses a summary without the progress of the last leg', () => {
    expect(MatchSummary.safeParse({ ...unfinished, lastLegProgress: null }).success).toBe(true);
  });

  it('requires lastLegProgress', () => {
    expect(MatchSummary.safeParse(unfinished).success).toBe(false);
  });

  it('parses a checkout practice summary', () => {
    const checkouts = { range: '2-50', target: 17, attempts: 2, successes: 1, skips: 0, history: [{ target: 40, success: true }, { target: 3, success: false }] };
    const summary = { ...unfinished, type: 'practice', lastLegProgress: null, checkouts };
    expect(MatchSummary.parse(summary)).toEqual(summary);
  });

  it('requires checkouts', () => {
    expect(MatchSummary.safeParse({ ...unfinished, lastLegProgress: null, checkouts: undefined }).success).toBe(false);
  });

  it('rejects a checkout session with inconsistent counts', () => {
    const checkouts = { range: '2-50', target: 17, attempts: 1, successes: 1, skips: 0, history: [{ target: 40, success: false }] };
    expect(MatchSummary.safeParse({ ...unfinished, lastLegProgress: null, checkouts }).success).toBe(false);
  });

  it('rejects dart 0 and a negative remaining score', () => {
    expect(LegProgressPoint.safeParse({ dart: 0, remaining: 301, bust: false }).success).toBe(false);
    expect(LegProgressPoint.safeParse({ dart: 1, remaining: -1, bust: false }).success).toBe(false);
    expect(LegProgress.safeParse({ ...progress, players: [{ playerId: 'p1', points: [{ dart: 0, remaining: 301, bust: false }] }] }).success).toBe(false);
  });

  it('rejects a starting score outside 301, 501 and 701', () => {
    expect(LegProgress.safeParse({ ...progress, startingScore: 401 }).success).toBe(false);
  });

  it('rejects an unknown game type', () => {
    expect(MatchSummary.safeParse({ matchId: 'm1', type: 'cricket', finished: false, eventSeq: 0, players: [], legs: [], lastLegProgress: null, checkouts: null }).success).toBe(false);
  });
});

describe('StatsRankings', () => {
  const anna = { playerId: 'p1', name: 'Anna', avatar: '🎯', color: 1 };
  const bartek = { playerId: 'p2', name: 'Bartek', avatar: null, color: 7 };

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
      highestTurn: [],
    };
    expect(StatsRankings.parse(rankings)).toEqual(rankings);
  });

  it('accepts position null only for a ranked player', () => {
    expect(RankedPlayer.safeParse({ ...anna, position: null, average: 50, legs: 1 }).success).toBe(true);
    expect(RankingEntry.safeParse({ ...anna, position: null, value: 50 }).success).toBe(false);
  });

  it.each([
    ['a missing color', undefined],
    ['color 0', 0],
    ['color 17', 17],
    ['a fractional color', 1.5],
  ])('rejects %s', (_name, color) => {
    expect(RankedPlayer.safeParse({ ...anna, color, position: 1, average: 50, legs: 3 }).success).toBe(false);
    expect(RankingEntry.safeParse({ ...anna, color, position: 1, value: 50 }).success).toBe(false);
  });

  it('rejects position 0', () => {
    expect(RankingEntry.safeParse({ ...anna, position: 0, value: 50 }).success).toBe(false);
  });

  it('needs 3 legs for an average', () => {
    expect(MIN_LEGS_FOR_AVERAGE).toBe(3);
  });
});

describe('StatsOverall', () => {
  const anna = { playerId: 'p1', name: 'Anna', avatar: '🎯', color: 1, darts: 6, legs: 1, average: 150.5, difference: 75.25 };
  const bartek = { playerId: 'p2', name: 'Bartek', avatar: null, color: 7, darts: 3, legs: 1, average: 0, difference: -75.25 };
  const celina = { playerId: 'p3', name: 'Celina', avatar: null, color: 12, darts: 12, legs: 0, average: null, difference: null };

  it('parses players above, below and without an average', () => {
    const overall = { games: 1, legs: 1, darts: 21, average: 75.25, players: [anna, bartek, celina] };
    expect(StatsOverall.parse(overall)).toEqual(overall);
  });

  it('parses an empty overview', () => {
    const overall = { games: 0, legs: 0, darts: 0, average: null, players: [] };
    expect(StatsOverall.parse(overall)).toEqual(overall);
  });

  it('rejects a negative average', () => {
    expect(OverallPlayer.safeParse({ ...anna, average: -1 }).success).toBe(false);
    expect(StatsOverall.safeParse({ games: 1, legs: 1, darts: 9, average: -1, players: [] }).success).toBe(false);
  });

  it('rejects a fractional dart count', () => {
    expect(OverallPlayer.safeParse({ ...anna, darts: 6.5 }).success).toBe(false);
    expect(StatsOverall.safeParse({ games: 1, legs: 1, darts: 9.5, average: 75.25, players: [] }).success).toBe(false);
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

describe('FrequentHitsResponse', () => {
  const hits = [
    { segment: 20, multiplier: 1, count: 12 },
    { segment: 20, multiplier: 3, count: 4 },
    { segment: 25, multiplier: 2, count: 2 },
  ];
  const parses = (list: readonly object[]) => FrequentHitsResponse.safeParse({ playerId: 'p1', hits: list }).success;

  it('parses the hits of a player', () => {
    const response = { playerId: 'p1', hits };
    expect(FrequentHitsResponse.parse(response)).toEqual(response);
    expect(parses([])).toBe(true);
  });

  it('rejects a Miss', () => {
    expect(parses([{ segment: 0, multiplier: 0, count: 3 }])).toBe(false);
  });

  it('rejects an invalid segment and multiplier combination', () => {
    expect(parses([{ segment: 25, multiplier: 3, count: 1 }])).toBe(false);
  });

  it('rejects a hit with count 0', () => {
    expect(parses([{ segment: 20, multiplier: 1, count: 0 }])).toBe(false);
  });

  it(`rejects more than ${FREQUENT_HITS_LIMIT} hits`, () => {
    expect(FREQUENT_HITS_LIMIT).toBe(6);
    const many = Array.from({ length: FREQUENT_HITS_LIMIT + 1 }, (_, index) => ({ segment: index + 1, multiplier: 1, count: 1 }));
    expect(parses(many)).toBe(false);
    expect(parses(many.slice(1))).toBe(true);
  });
});
