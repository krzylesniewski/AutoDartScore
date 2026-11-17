import { describe, expect, it } from 'vitest';
import {
  ApiError,
  CorrectResultRequest,
  Fixture,
  FixtureSlot,
  SharingRequest,
  StandingRow,
  StartFixtureResult,
  TournamentApiErrorCode,
  TournamentConfig,
  TournamentListItem,
  TournamentListQuery,
  TournamentLiveMessage,
  TournamentPlacement,
  TournamentPlayer,
  TournamentStaleStateError,
  TournamentUpdated,
  TournamentView,
  WithdrawPlayerRequest,
} from './index.js';

function paths(result: { error?: { issues: { path: PropertyKey[] }[] } }): PropertyKey[][] {
  return result.error?.issues.map((issue) => issue.path) ?? [];
}

const anna = { kind: 'player', playerId: 'p1', seed: null };
const bartek = { kind: 'player', playerId: 'p2', seed: null };

const waiting = {
  id: 'p-f',
  number: 7,
  phase: 'playoff',
  round: 2,
  bracketRound: 'final',
  board: 1,
  legsToWin: 4,
  slots: [
    { kind: 'winner_of', fixtureId: 'p-sf-1' },
    { kind: 'winner_of', fixtureId: 'p-sf-2' },
  ],
  status: 'waiting',
  matchId: null,
  result: null,
  averages: null,
};

const finished = {
  id: 'g-1',
  number: 1,
  phase: 'group',
  round: 1,
  bracketRound: null,
  board: 1,
  legsToWin: 3,
  slots: [anna, bartek],
  status: 'finished',
  matchId: 'm1',
  result: { legs: [3, 1], winnerId: 'p1', corrected: false },
  averages: null,
};

describe('TournamentPlayer and TournamentPlacement', () => {
  it('keeps only the profile fields of a player', () => {
    const player = { id: 'p1', name: 'Anna', avatar: '🎯', color: 1, guest: false };
    expect(TournamentPlayer.parse({ ...player, remaining: 301 })).toStrictEqual(player);
  });

  it('accepts places 1 to 16', () => {
    expect(TournamentPlacement.safeParse({ playerId: 'p1', place: 16 }).success).toBe(true);
    expect(TournamentPlacement.safeParse({ playerId: 'p1', place: 0 }).success).toBe(false);
    expect(TournamentPlacement.safeParse({ playerId: 'p1', place: 17 }).success).toBe(false);
  });
});

describe('FixtureSlot', () => {
  it.each([
    { kind: 'player', playerId: 'p1', seed: 1 },
    { kind: 'player', playerId: 'p1', seed: null },
    { kind: 'winner_of', fixtureId: 'p-sf-1' },
    { kind: 'loser_of', fixtureId: 'p-sf-1' },
    { kind: 'standing', place: 2 },
    { kind: 'bye' },
  ])('parses a $kind slot', (slot) => {
    expect(FixtureSlot.parse(slot)).toStrictEqual(slot);
  });

  it('rejects an unknown kind and a place below 1', () => {
    expect(FixtureSlot.safeParse({ kind: 'random' }).success).toBe(false);
    expect(FixtureSlot.safeParse({ kind: 'standing', place: 0 }).success).toBe(false);
  });
});

describe('Fixture', () => {
  it('parses a waiting fixture with source slots', () => {
    expect(Fixture.parse(waiting)).toStrictEqual(waiting);
  });

  it('parses a finished fixture', () => {
    expect(Fixture.parse(finished)).toStrictEqual(finished);
  });

  it('parses a fixture won from the second slot', () => {
    const fixture = { ...finished, result: { legs: [2, 3], winnerId: 'p2', corrected: true } };
    expect(Fixture.parse(fixture)).toStrictEqual(fixture);
  });

  it('parses a walkover as legsToWin to 0', () => {
    const fixture = { ...finished, status: 'walkover', matchId: null, result: { legs: [0, 3], winnerId: 'p2', corrected: false } };
    expect(Fixture.parse(fixture)).toStrictEqual(fixture);
  });

  it('parses a bye', () => {
    const fixture = {
      ...waiting,
      id: 'p-qf-1',
      round: 1,
      bracketRound: 'qf',
      slots: [{ kind: 'player', playerId: 'p1', seed: 1 }, { kind: 'bye' }],
      status: 'bye',
    };
    expect(Fixture.parse(fixture)).toStrictEqual(fixture);
  });

  it('parses a third place fixture with averages', () => {
    const fixture = {
      ...finished,
      id: 'p-3rd',
      phase: 'third_place',
      legsToWin: 2,
      result: { legs: [2, 0], winnerId: 'p1', corrected: false },
      averages: [61.5, 48],
    };
    expect(Fixture.parse(fixture)).toStrictEqual(fixture);
  });

  it('rejects a result on a fixture that is not finished', () => {
    expect(paths(Fixture.safeParse({ ...finished, status: 'ready' }))).toEqual([['result']]);
  });

  it('rejects a finished fixture without a result', () => {
    expect(paths(Fixture.safeParse({ ...finished, result: null }))).toEqual([['result']]);
  });

  it('rejects a winner who is not a slot player', () => {
    expect(paths(Fixture.safeParse({ ...finished, result: { legs: [3, 1], winnerId: 'p9', corrected: false } }))).toEqual([
      ['result', 'winnerId'],
    ]);
  });

  it('rejects winner legs other than legsToWin', () => {
    expect(paths(Fixture.safeParse({ ...finished, result: { legs: [2, 1], winnerId: 'p1', corrected: false } }))).toEqual([
      ['result', 'legs'],
    ]);
  });

  it('rejects loser legs above legsToWin', () => {
    expect(paths(Fixture.safeParse({ ...finished, result: { legs: [3, 4], winnerId: 'p1', corrected: false } }))).toEqual([
      ['result', 'legs'],
    ]);
  });

  it('rejects a draw, a negative average and a board below 1', () => {
    expect(Fixture.safeParse({ ...finished, result: { legs: [3, 3], winnerId: 'p1', corrected: false } }).success).toBe(false);
    expect(Fixture.safeParse({ ...finished, averages: [-1, 40] }).success).toBe(false);
    expect(Fixture.safeParse({ ...finished, board: 0 }).success).toBe(false);
  });
});

const row = {
  playerId: 'p2',
  place: 3,
  played: 4,
  won: 1,
  lost: 3,
  legsFor: 5,
  legsAgainst: 10,
  legDifference: -5,
  points: 2,
  average: null,
  withdrawn: false,
  advances: false,
};

describe('StandingRow', () => {
  it('parses a row with a negative leg difference', () => {
    expect(StandingRow.parse(row)).toStrictEqual(row);
  });

  it('rejects played other than won plus lost', () => {
    expect(paths(StandingRow.safeParse({ ...row, played: 5 }))).toEqual([['played']]);
  });

  it('rejects a leg difference that does not follow from the legs', () => {
    expect(paths(StandingRow.safeParse({ ...row, legDifference: 5 }))).toEqual([['legDifference']]);
  });

  it('rejects points that do not follow from the wins', () => {
    expect(paths(StandingRow.safeParse({ ...row, points: 3 }))).toEqual([['points']]);
  });
});

const config = TournamentConfig.parse({ name: 'Liga listopad', format: 'league', playerIds: ['p1', 'p2', 'p3'] });

const view = {
  id: 't1',
  name: 'Liga listopad',
  format: 'league',
  config,
  status: 'in_progress',
  createdAt: '2026-11-16T18:00:00.000Z',
  finishedAt: null,
  players: [
    { id: 'p1', name: 'Anna', avatar: '🎯', color: 1, guest: false },
    { id: 'p2', name: 'Bartek', avatar: null, color: 7, guest: false },
    { id: 'p3', name: 'Celina', avatar: null, color: 3, guest: true },
  ],
  fixtures: [
    finished,
    { ...finished, id: 'g-2', number: 2, slots: [bartek, { ...anna, playerId: 'p3' }], status: 'ready', matchId: null, result: null },
  ],
  standings: [
    { ...row, playerId: 'p1', place: 1, played: 1, won: 1, lost: 0, legsFor: 3, legsAgainst: 1, legDifference: 2, points: 2 },
    { ...row, playerId: 'p3', place: 2, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, legDifference: 0, points: 0 },
    { ...row, playerId: 'p2', place: 3, played: 1, won: 0, lost: 1, legsFor: 1, legsAgainst: 3, legDifference: -2, points: 0 },
  ],
  nextFixtureId: 'g-2',
  liveFixtureId: null,
  placements: [],
  sharing: false,
  canRedraw: false,
  eventSeq: 2,
  archivedAt: null,
};

describe('TournamentView', () => {
  it('parses a league in progress', () => {
    expect(TournamentView.parse(view)).toStrictEqual(view);
  });

  it('parses a finished league', () => {
    const done = {
      ...view,
      status: 'finished',
      finishedAt: '2026-11-16T21:00:00.000Z',
      nextFixtureId: null,
      placements: [
        { playerId: 'p1', place: 1 },
        { playerId: 'p3', place: 2 },
        { playerId: 'p2', place: 3 },
      ],
      sharing: true,
    };
    expect(TournamentView.parse(done)).toStrictEqual(done);
  });

  it('rejects finishedAt in a tournament in progress', () => {
    expect(paths(TournamentView.safeParse({ ...view, finishedAt: '2026-11-16T21:00:00.000Z' }))).toEqual([['finishedAt']]);
  });

  it('rejects a finished tournament without finishedAt', () => {
    expect(paths(TournamentView.safeParse({ ...view, status: 'finished' }))).toEqual([['finishedAt']]);
  });

  it('rejects a negative eventSeq', () => {
    expect(TournamentView.safeParse({ ...view, eventSeq: -1 }).success).toBe(false);
  });

  it('parses archivedAt set or null and rejects a missing or invalid one', () => {
    const archived = { ...view, archivedAt: '2026-11-17T09:00:00.000Z' };
    expect(TournamentView.parse(archived)).toStrictEqual(archived);
    expect(TournamentView.parse(view).archivedAt).toBeNull();
    expect(paths(TournamentView.safeParse({ ...view, archivedAt: undefined }))).toEqual([['archivedAt']]);
    expect(paths(TournamentView.safeParse({ ...view, archivedAt: 'yesterday' }))).toEqual([['archivedAt']]);
  });
});

describe('TournamentListQuery', () => {
  it('parses an empty query, a status and the archived switch', () => {
    expect(TournamentListQuery.parse({})).toStrictEqual({});
    expect(TournamentListQuery.parse({ status: 'finished', archived: 'include' })).toStrictEqual({
      status: 'finished',
      archived: 'include',
    });
  });

  it('rejects an unknown status and an archived value other than include', () => {
    expect(paths(TournamentListQuery.safeParse({ status: 'archived' }))).toEqual([['status']]);
    expect(paths(TournamentListQuery.safeParse({ archived: 'true' }))).toEqual([['archived']]);
  });
});

describe('TournamentListItem', () => {
  it('keeps only the list fields of a full view', () => {
    expect(TournamentListItem.parse(view)).toStrictEqual({
      id: 't1',
      name: 'Liga listopad',
      format: 'league',
      status: 'in_progress',
      createdAt: '2026-11-16T18:00:00.000Z',
      finishedAt: null,
      archivedAt: null,
      players: view.players,
      placements: [],
    });
  });

  it('rejects finishedAt in a tournament in progress', () => {
    const item = TournamentListItem.parse(view);
    expect(paths(TournamentListItem.safeParse({ ...item, finishedAt: '2026-11-16T21:00:00.000Z' }))).toEqual([['finishedAt']]);
  });
});

describe('tournament responses', () => {
  it('parses a started fixture with the view', () => {
    const result = { matchId: 'm2', tournament: view };
    expect(StartFixtureResult.parse(result)).toStrictEqual(result);
    expect(StartFixtureResult.safeParse({ ...result, matchId: '' }).success).toBe(false);
  });

  it('lists the tournament error codes', () => {
    expect(TournamentApiErrorCode.options).toEqual([
      'tournament_active',
      'tournament_started',
      'fixture_not_ready',
      'tournament_not_finished',
      'tournament_archived',
      'archived_player',
      'fixture_not_finished',
      'invalid_result',
      'dependent_started',
      'already_withdrawn',
      'tournament_finished',
      'player_withdrawn',
    ]);
    expect(TournamentApiErrorCode.safeParse('stale_state').success).toBe(false);
  });

  it('parses a stale tournament error, which is also an ApiError', () => {
    const body = { error: 'stale_state', message: 'Tournament t1 changed since seq 1', tournament: view };
    expect(TournamentStaleStateError.parse(body)).toStrictEqual(body);
    expect(ApiError.safeParse(body).success).toBe(true);
    expect(TournamentStaleStateError.safeParse({ ...body, error: 'not_found' }).success).toBe(false);
  });

  it('parses tournament_updated as a live message', () => {
    const message = { type: 'tournament_updated', tournamentId: 't1', eventSeq: 2, tournament: view };
    expect(TournamentUpdated.parse(message)).toStrictEqual(message);
    expect(TournamentLiveMessage.parse(message)).toStrictEqual(message);
    expect(TournamentLiveMessage.safeParse({ ...message, type: 'state_updated' }).success).toBe(false);
    expect(TournamentLiveMessage.safeParse({ ...message, eventSeq: -1 }).success).toBe(false);
  });
});

describe('tournament commands', () => {
  it.each([
    ['CorrectResultRequest', CorrectResultRequest, { legs: [1, 3] }],
    ['WithdrawPlayerRequest', WithdrawPlayerRequest, { playerId: 'p2' }],
    ['SharingRequest', SharingRequest, { sharing: true }],
  ] as const)('%s parses with and without expectedSeq', (_name, schema, body) => {
    expect(schema.parse(body)).toStrictEqual(body);
    expect(schema.parse({ ...body, expectedSeq: 0 })).toStrictEqual({ ...body, expectedSeq: 0 });
    expect(schema.parse({ ...body, expectedSeq: 12 })).toStrictEqual({ ...body, expectedSeq: 12 });
    expect(schema.safeParse({ ...body, expectedSeq: -1 }).success).toBe(false);
  });

  it('rejects a corrected draw, an empty player and a missing switch', () => {
    expect(CorrectResultRequest.safeParse({ legs: [2, 2] }).success).toBe(false);
    expect(WithdrawPlayerRequest.safeParse({ playerId: '' }).success).toBe(false);
    expect(SharingRequest.safeParse({}).success).toBe(false);
  });
});
