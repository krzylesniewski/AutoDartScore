import { describe, expect, it } from 'vitest';
import {
  BracketRound,
  CreateTournamentRequest,
  DEFAULT_TOURNAMENT_STARTING_SCORE,
  FixtureLegs,
  MatchTournament,
  POINTS_PER_WIN,
  TOURNAMENT_PLAYER_LIMITS,
  TournamentConfig,
  TournamentEvent,
  TournamentFormat,
  TournamentLegsToWin,
} from './index.js';

const defaultLegs = { group: 3, r16: 3, qf: 3, sf: 3, final: 4, thirdPlace: 2, consolation: 2 };

function players(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

function issuePaths(input: unknown): PropertyKey[][] {
  const result = TournamentConfig.safeParse(input);
  expect(result.success).toBe(false);
  return result.error?.issues.map((issue) => issue.path) ?? [];
}

describe('tournament constants', () => {
  it('has a player limit for every format', () => {
    expect(TOURNAMENT_PLAYER_LIMITS).toStrictEqual({
      league: { min: 3, max: 10 },
      cup: { min: 3, max: 16 },
      group_playoff: { min: 3, max: 10 },
    });
    expect(Object.keys(TOURNAMENT_PLAYER_LIMITS).sort()).toEqual([...TournamentFormat.options].sort());
  });

  it('starts at 501 and gives 2 points per win', () => {
    expect(DEFAULT_TOURNAMENT_STARTING_SCORE).toBe(501);
    expect(POINTS_PER_WIN).toBe(2);
  });

  it('knows the bracket rounds', () => {
    expect(BracketRound.options).toEqual(['r16', 'qf', 'sf', 'final']);
    expect(BracketRound.safeParse('r32').success).toBe(false);
  });
});

describe('TournamentConfig', () => {
  it('applies every default to a minimal league', () => {
    expect(TournamentConfig.parse({ name: ' X ', format: 'league', playerIds: ['a', 'b', 'c'] })).toStrictEqual({
      name: 'X',
      format: 'league',
      playerIds: ['a', 'b', 'c'],
      startingScore: 501,
      thirdPlaceMatch: false,
      consolation: false,
      legsToWin: { group: 3, r16: 3, qf: 3, sf: 3, final: 4, thirdPlace: 2, consolation: 2 },
      sharing: true,
    });
  });

  it('applies every default to a minimal cup', () => {
    expect(TournamentConfig.parse({ name: 'Puchar', format: 'cup', playerIds: ['a', 'b', 'c'] })).toStrictEqual({
      name: 'Puchar',
      format: 'cup',
      playerIds: ['a', 'b', 'c'],
      startingScore: 501,
      thirdPlaceMatch: false,
      consolation: false,
      legsToWin: defaultLegs,
      sharing: true,
    });
  });

  it('applies every default to a minimal group and play-off', () => {
    expect(TournamentConfig.parse({ name: 'Grupa', format: 'group_playoff', playerIds: ['a', 'b', 'c'], advance: 2 })).toStrictEqual({
      name: 'Grupa',
      format: 'group_playoff',
      playerIds: ['a', 'b', 'c'],
      startingScore: 501,
      advance: 2,
      thirdPlaceMatch: false,
      consolation: false,
      legsToWin: defaultLegs,
      sharing: true,
    });
  });

  it('keeps the given values', () => {
    const config = {
      name: 'Finały',
      format: 'group_playoff',
      playerIds: players(8),
      startingScore: 701,
      advance: 4,
      thirdPlaceMatch: true,
      consolation: true,
      legsToWin: { group: 2, r16: 2, qf: 3, sf: 4, final: 5, thirdPlace: 3, consolation: 1 },
      sharing: false,
    };
    expect(TournamentConfig.parse(config)).toStrictEqual(config);
  });

  it('fills the missing match lengths', () => {
    expect(TournamentLegsToWin.parse({ final: 5 })).toStrictEqual({ ...defaultLegs, final: 5 });
    expect(TournamentConfig.parse({ name: 'X', format: 'cup', playerIds: players(3), legsToWin: { final: 5 } }).legsToWin).toStrictEqual({
      ...defaultLegs,
      final: 5,
    });
  });

  it.each([0, 10])('rejects a match length of %i', (value) => {
    expect(issuePaths({ name: 'X', format: 'league', playerIds: players(3), legsToWin: { group: value } })).toEqual([
      ['legsToWin', 'group'],
    ]);
  });

  it('rejects a starting score outside 301, 501 and 701', () => {
    expect(TournamentConfig.safeParse({ name: 'X', format: 'league', playerIds: players(3), startingScore: 401 }).success).toBe(false);
  });

  it('accepts a name of 60 characters and rejects 61', () => {
    expect(TournamentConfig.safeParse({ name: 'x'.repeat(60), format: 'league', playerIds: players(3) }).success).toBe(true);
    expect(issuePaths({ name: 'x'.repeat(61), format: 'league', playerIds: players(3) })).toEqual([['name']]);
  });

  it('rejects a name that is empty after trimming', () => {
    expect(issuePaths({ name: '   ', format: 'league', playerIds: players(3) })).toEqual([['name']]);
  });

  it('requires a name', () => {
    expect(issuePaths({ format: 'league', playerIds: players(3) })).toEqual([['name']]);
  });

  it.each(TournamentFormat.options)('rejects 2 players and accepts 3 in %s', (format) => {
    const advance = format === 'group_playoff' ? { advance: 2 } : {};
    expect(issuePaths({ name: 'X', format, playerIds: players(2), ...advance })).toEqual([['playerIds']]);
    expect(TournamentConfig.safeParse({ name: 'X', format, playerIds: players(3), ...advance }).success).toBe(true);
  });

  it.each([
    ['league', {}],
    ['group_playoff', { advance: 8 }],
  ])('accepts 10 players and rejects 11 in %s', (format, extra) => {
    expect(TournamentConfig.safeParse({ name: 'X', format, playerIds: players(10), ...extra }).success).toBe(true);
    expect(issuePaths({ name: 'X', format, playerIds: players(11), ...extra })).toEqual([['playerIds']]);
  });

  it('accepts 16 players and rejects 17 in a cup', () => {
    expect(TournamentConfig.safeParse({ name: 'X', format: 'cup', playerIds: players(16) }).success).toBe(true);
    expect(issuePaths({ name: 'X', format: 'cup', playerIds: players(17) })).toEqual([['playerIds']]);
  });

  it('rejects duplicate player ids', () => {
    const result = TournamentConfig.safeParse({ name: 'X', format: 'cup', playerIds: ['a', 'b', 'a'] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['Player ids must be distinct']);
  });

  it('requires advance in a group and play-off', () => {
    expect(issuePaths({ name: 'X', format: 'group_playoff', playerIds: players(4) })).toEqual([['advance']]);
  });

  it('rejects advance above the number of players', () => {
    expect(issuePaths({ name: 'X', format: 'group_playoff', playerIds: players(3), advance: 4 })).toEqual([['advance']]);
    expect(TournamentConfig.safeParse({ name: 'X', format: 'group_playoff', playerIds: players(4), advance: 4 }).success).toBe(true);
  });

  it('rejects an advance other than 2, 4 or 8', () => {
    expect(TournamentConfig.safeParse({ name: 'X', format: 'group_playoff', playerIds: players(6), advance: 3 }).success).toBe(false);
  });

  it.each(['league', 'cup'])('rejects advance in %s', (format) => {
    expect(issuePaths({ name: 'X', format, playerIds: players(4), advance: 2 })).toEqual([['advance']]);
  });

  it.each(['league', 'cup'])('rejects a consolation bracket in %s', (format) => {
    expect(issuePaths({ name: 'X', format, playerIds: players(4), consolation: true })).toEqual([['consolation']]);
  });

  it('rejects a third place match in a league', () => {
    expect(issuePaths({ name: 'X', format: 'league', playerIds: players(4), thirdPlaceMatch: true })).toEqual([['thirdPlaceMatch']]);
  });

  it('reports every broken format rule', () => {
    expect(
      issuePaths({ name: 'X', format: 'league', playerIds: players(11), advance: 2, consolation: true, thirdPlaceMatch: true }),
    ).toEqual([['playerIds'], ['advance'], ['consolation'], ['thirdPlaceMatch']]);
  });

  it('accepts an explicit false for switches that do not apply', () => {
    expect(
      TournamentConfig.safeParse({ name: 'X', format: 'league', playerIds: players(3), thirdPlaceMatch: false, consolation: false })
        .success,
    ).toBe(true);
    expect(TournamentConfig.safeParse({ name: 'X', format: 'cup', playerIds: players(3), consolation: false }).success).toBe(true);
  });

  it('accepts a third place match in a cup and both switches with a final only bracket', () => {
    expect(TournamentConfig.safeParse({ name: 'X', format: 'cup', playerIds: players(3), thirdPlaceMatch: true }).success).toBe(true);
    expect(
      TournamentConfig.safeParse({
        name: 'X',
        format: 'group_playoff',
        playerIds: players(3),
        advance: 2,
        thirdPlaceMatch: true,
        consolation: true,
      }).success,
    ).toBe(true);
  });
});

describe('CreateTournamentRequest', () => {
  it('parses like TournamentConfig', () => {
    const input = { name: ' Liga ', format: 'league', playerIds: players(5), legsToWin: { group: 2 } };
    expect(CreateTournamentRequest.parse(input)).toStrictEqual(TournamentConfig.parse(input));
  });
});

describe('FixtureLegs', () => {
  it.each([
    [3, 1],
    [0, 4],
    [9, 8],
  ])('accepts %i:%i', (first, second) => {
    expect(FixtureLegs.parse([first, second])).toEqual([first, second]);
  });

  it.each([
    [2, 2],
    [10, 3],
    [-1, 3],
    [2.5, 3],
  ])('rejects %d:%d', (first, second) => {
    expect(FixtureLegs.safeParse([first, second]).success).toBe(false);
  });

  it('rejects a draw without a path', () => {
    const result = FixtureLegs.safeParse([3, 3]);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([[]]);
  });
});

describe('TournamentEvent', () => {
  it.each([
    { type: 'draw', order: ['p3', 'p1', 'p2'] },
    { type: 'fixture_started', fixtureId: 'g-7', matchId: 'm1' },
    { type: 'player_withdrawn', playerId: 'p2' },
    { type: 'result_corrected', fixtureId: 'p-sf-1', legs: [1, 3] },
    { type: 'sharing_changed', sharing: false },
    { type: 'archived' },
  ])('parses $type', (event) => {
    expect(TournamentEvent.parse(event)).toStrictEqual(event);
  });

  it('rejects an unknown type', () => {
    expect(TournamentEvent.safeParse({ type: 'paused' }).success).toBe(false);
  });

  it('rejects a draw with duplicate ids or a wrong size', () => {
    expect(TournamentEvent.safeParse({ type: 'draw', order: ['p1', 'p2', 'p1'] }).success).toBe(false);
    expect(TournamentEvent.safeParse({ type: 'draw', order: ['p1', 'p2'] }).success).toBe(false);
    expect(TournamentEvent.safeParse({ type: 'draw', order: players(17) }).success).toBe(false);
  });

  it('rejects a started fixture without a match and a corrected draw', () => {
    expect(TournamentEvent.safeParse({ type: 'fixture_started', fixtureId: 'g-1', matchId: '' }).success).toBe(false);
    expect(TournamentEvent.safeParse({ type: 'result_corrected', fixtureId: 'g-1', legs: [2, 2] }).success).toBe(false);
  });
});

describe('MatchTournament', () => {
  const link = { id: 't1', name: 'Liga', fixtureId: 'p-sf-2', label: 'Półfinał 2' };

  it('parses a tournament link', () => {
    expect(MatchTournament.parse(link)).toStrictEqual(link);
  });

  it('rejects an empty label', () => {
    expect(MatchTournament.safeParse({ ...link, label: '' }).success).toBe(false);
  });
});
