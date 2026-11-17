import { describe, expect, it } from 'vitest';
import {
  PublicApiErrorCode,
  PublicMatch,
  PublicMatchPlayer,
  PublicTournamentMatch,
  PublicTournamentPlayer,
  PublicTournamentStats,
  PublicTournamentView,
  TournamentConfig,
} from './index.js';

function paths(result: { error?: { issues: { path: PropertyKey[] }[] } }): PropertyKey[][] {
  return result.error?.issues.map((issue) => issue.path) ?? [];
}

const config = TournamentConfig.parse({ name: 'Liga testowa', format: 'league', playerIds: ['p1', 'p2', 'p3'] });

const view = {
  id: 't_abc',
  name: 'Liga testowa',
  format: 'league',
  config,
  status: 'in_progress',
  createdAt: '2026-11-16T18:00:00.000Z',
  finishedAt: null,
  players: [
    { id: 'p1', name: 'Anna', avatar: '🎯', color: 1 },
    { id: 'p2', name: 'Bartek', avatar: null, color: 7 },
    { id: 'p3', name: 'Celina', avatar: null, color: 3 },
  ],
  fixtures: [
    {
      id: 'g-1',
      number: 1,
      phase: 'group',
      round: 1,
      bracketRound: null,
      board: 1,
      legsToWin: 1,
      slots: [
        { kind: 'player', playerId: 'p1', seed: null },
        { kind: 'player', playerId: 'p2', seed: null },
      ],
      status: 'in_progress',
      matchId: 'm1',
      result: null,
      averages: null,
    },
  ],
  standings: [],
  nextFixtureId: null,
  liveFixtureId: 'g-1',
  placements: [],
};

const match = {
  id: 'm1',
  status: 'in_progress',
  startingScore: 301,
  legsToWin: 1,
  createdAt: '2026-11-16T18:05:00.000Z',
  startedAt: '2026-11-16T18:06:00.000Z',
  finishedAt: null,
  pausedMs: 0,
  currentPlayerId: 'p2',
  winnerId: null,
  players: [
    { id: 'p1', name: 'Anna', avatar: '🎯', color: 1, legsWon: 0, remaining: 121 },
    { id: 'p2', name: 'Bartek', avatar: null, color: 7, legsWon: 0, remaining: 301 },
  ],
};

const tournamentMatch = {
  tournamentId: 't_abc',
  fixtureId: 'g-1',
  label: 'Kolejka 1',
  match,
  summary: {
    matchId: 'm1',
    type: 'match',
    finished: false,
    eventSeq: 3,
    players: [],
    legs: [],
    lastLegProgress: null,
    checkouts: null,
  },
  legs: { matchId: 'm1', finished: false, eventSeq: 3, startingScore: 301, legsToWin: 1, players: ['p1', 'p2'], legs: [] },
};

describe('PublicTournamentView', () => {
  it('parses a league in progress', () => {
    expect(PublicTournamentView.parse(view)).toStrictEqual(view);
  });

  it('parses a finished tournament', () => {
    const done = { ...view, status: 'finished', finishedAt: '2026-11-16T21:00:00.000Z', liveFixtureId: null };
    expect(PublicTournamentView.parse(done)).toStrictEqual(done);
  });

  it('rejects finishedAt that does not match the status', () => {
    expect(paths(PublicTournamentView.safeParse({ ...view, finishedAt: '2026-11-16T21:00:00.000Z' }))).toEqual([['finishedAt']]);
    expect(paths(PublicTournamentView.safeParse({ ...view, status: 'finished' }))).toEqual([['finishedAt']]);
  });

  it('drops the private fields of the view and of its players', () => {
    const parsed = PublicTournamentView.parse({
      ...view,
      players: view.players.map((player) => ({ ...player, guest: false })),
      sharing: true,
      canRedraw: false,
      eventSeq: 4,
      archivedAt: null,
    });
    for (const key of ['sharing', 'canRedraw', 'eventSeq', 'archivedAt']) {
      expect(parsed).not.toHaveProperty(key);
    }
    expect(parsed.config.sharing).toBe(true);
    for (const player of parsed.players) {
      expect(player).not.toHaveProperty('guest');
    }
  });
});

describe('PublicTournamentPlayer and PublicMatchPlayer', () => {
  it('accepts an emoji avatar or null', () => {
    expect(PublicTournamentPlayer.parse({ id: 'p1', name: 'Anna', avatar: null, color: 1 }).avatar).toBeNull();
    expect(PublicMatchPlayer.parse({ ...match.players[0], avatar: '🐙' }).avatar).toBe('🐙');
  });

  it.each(['https://example.com/photo.jpg', 'data:image/png;base64,AAAA', 'AB', ''])('rejects the avatar %j', (avatar) => {
    expect(paths(PublicTournamentPlayer.safeParse({ id: 'p1', name: 'Anna', avatar, color: 1 }))).toEqual([['avatar']]);
    expect(paths(PublicMatchPlayer.safeParse({ ...match.players[0], avatar }))).toEqual([['avatar']]);
  });

  it('drops guest from a parsed player', () => {
    expect(PublicTournamentPlayer.parse({ id: 'p1', name: 'Anna', avatar: null, color: 1, guest: true })).not.toHaveProperty('guest');
    expect(PublicMatchPlayer.parse({ ...match.players[0], guest: true, place: null })).not.toHaveProperty('guest');
  });
});

describe('PublicMatch and PublicTournamentMatch', () => {
  it('parses a tournament match with its summary and legs', () => {
    expect(PublicTournamentMatch.parse(tournamentMatch)).toStrictEqual(tournamentMatch);
  });

  it('drops the private fields of a match snapshot', () => {
    const parsed = PublicMatch.parse({ ...match, eventSeq: 3, abandonment: null, tournament: null, type: 'match' });
    for (const key of ['eventSeq', 'abandonment', 'tournament', 'type']) {
      expect(parsed).not.toHaveProperty(key);
    }
  });

  it('rejects a match without its summary', () => {
    expect(paths(PublicTournamentMatch.safeParse({ ...tournamentMatch, summary: undefined }))).toEqual([['summary']]);
  });
});

describe('PublicTournamentStats and PublicApiErrorCode', () => {
  it('parses stats without records', () => {
    const stats = {
      tournamentId: 't_abc',
      players: [],
      records: { highestMatchAverage: null, highestCheckout: null, shortestLeg: null, highestTurn: null },
    };
    expect(PublicTournamentStats.parse(stats)).toStrictEqual(stats);
  });

  it('knows the two public error codes', () => {
    expect(PublicApiErrorCode.options).toEqual(['not_found', 'too_many_requests']);
  });
});
