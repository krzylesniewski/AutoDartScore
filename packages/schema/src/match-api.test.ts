import { describe, expect, it } from 'vitest';
import { ApiError, BestOf, CreateMatchRequest, MatchSnapshot, StartingScore, ThrowRecord, ThrowResult, UndoResult } from './index.js';

describe('StartingScore', () => {
  it.each([301, 501, 701])('accepts %i', (value) => {
    expect(StartingScore.parse(value)).toBe(value);
  });

  it.each([401, 0, 501.5])('rejects %d', (value) => {
    expect(StartingScore.safeParse(value).success).toBe(false);
  });
});

describe('BestOf', () => {
  it.each([1, 3, 5])('accepts %i', (value) => {
    expect(BestOf.parse(value)).toBe(value);
  });

  it.each([2, 0, 7])('rejects %i', (value) => {
    expect(BestOf.safeParse(value).success).toBe(false);
  });
});

describe('CreateMatchRequest', () => {
  it('defaults a 1v1 match to 501 and best of 3', () => {
    expect(CreateMatchRequest.parse({ type: 'match', playerIds: ['p1', 'p2'] })).toEqual({
      type: 'match',
      playerIds: ['p1', 'p2'],
      startingScore: 501,
      bestOf: 3,
    });
  });

  it('defaults a casual game to 501', () => {
    expect(CreateMatchRequest.parse({ type: 'casual', playerIds: ['p1', 'p2', 'p3'] })).toEqual({
      type: 'casual',
      playerIds: ['p1', 'p2', 'p3'],
      startingScore: 501,
    });
  });

  it.each(['free_run', 'solo_501'])('accepts practice %s', (practiceMode) => {
    const request = { type: 'practice', practiceMode, playerIds: ['p1'] };
    expect(CreateMatchRequest.parse(request)).toEqual(request);
  });

  it.each([
    ['a match with one player', { type: 'match', playerIds: ['p1'] }],
    ['a match with three players', { type: 'match', playerIds: ['p1', 'p2', 'p3'] }],
    ['a casual game with one player', { type: 'casual', playerIds: ['p1'] }],
    ['a casual game with five players', { type: 'casual', playerIds: ['p1', 'p2', 'p3', 'p4', 'p5'] }],
    ['a practice with no player', { type: 'practice', practiceMode: 'solo_501', playerIds: [] }],
    ['a practice with two players', { type: 'practice', practiceMode: 'free_run', playerIds: ['p1', 'p2'] }],
  ])('rejects %s', (_name, value) => {
    expect(CreateMatchRequest.safeParse(value).success).toBe(false);
  });

  it.each([
    ['match', { type: 'match', playerIds: ['p1', 'p1'] }],
    ['casual', { type: 'casual', playerIds: ['p1', 'p2', 'p1'] }],
  ])('rejects duplicate players in a %s', (_name, value) => {
    expect(CreateMatchRequest.safeParse(value).success).toBe(false);
  });

  it.each([
    ['startingScore 401', { type: 'match', playerIds: ['p1', 'p2'], startingScore: 401 }],
    ['bestOf 2', { type: 'match', playerIds: ['p1', 'p2'], bestOf: 2 }],
    ['startingScore 401 in casual', { type: 'casual', playerIds: ['p1', 'p2'], startingScore: 401 }],
    ['an unknown practice mode', { type: 'practice', practiceMode: 'around_the_clock', playerIds: ['p1'] }],
    ['an unknown type', { type: 'tournament', playerIds: ['p1', 'p2'] }],
  ])('rejects %s', (_name, value) => {
    expect(CreateMatchRequest.safeParse(value).success).toBe(false);
  });
});

const throwRecord = {
  id: 't1',
  matchId: 'm1',
  eventId: '4b8e7a61-2c0f-4f5e-9d1a-6c3b2a1f0e9d',
  source: 'keypad',
  sequence: 0,
  segment: 20,
  multiplier: 3,
  confidence: 1,
  detectedAt: '2026-10-15T18:30:12.345Z',
  receivedAt: '2026-10-15T18:30:12.400Z',
};

const snapshot = {
  id: 'm1',
  type: 'match',
  practiceMode: null,
  startingScore: 301,
  legsToWin: 2,
  countsToStats: true,
  createdAt: '2026-10-15T18:30:00.000Z',
  finished: false,
  eventSeq: 1,
  currentPlayerId: 'p1',
  legIndex: 0,
  turnIndex: 0,
  currentDarts: [{ segment: 20, multiplier: 3 }],
  players: [
    { id: 'p1', name: 'Anna', avatar: '🎯', guest: false, remaining: 241, legsWon: 0, place: null, dartsThrownInLeg: 1 },
    { id: 'p2', name: 'Bartek', avatar: null, guest: true, remaining: 301, legsWon: 0, place: null, dartsThrownInLeg: 0 },
  ],
  winnerId: null,
  placements: [],
  freeRun: null,
};

describe('ThrowRecord', () => {
  it('accepts a stored throw', () => {
    expect(ThrowRecord.parse(throwRecord)).toEqual(throwRecord);
  });

  it('rejects a treble Bull', () => {
    expect(ThrowRecord.safeParse({ ...throwRecord, segment: 25, multiplier: 3 }).success).toBe(false);
  });
});

describe('MatchSnapshot', () => {
  it('accepts a 1v1 snapshot', () => {
    expect(MatchSnapshot.parse(snapshot)).toEqual(snapshot);
  });

  it('accepts a free run snapshot', () => {
    const freeRun = {
      ...snapshot,
      type: 'practice',
      practiceMode: 'free_run',
      startingScore: null,
      legsToWin: null,
      countsToStats: false,
      currentDarts: [],
      players: [{ id: 'p1', name: 'Anna', avatar: null, guest: false, remaining: null, legsWon: null, place: null, dartsThrownInLeg: 3 }],
      freeRun: { dartsThrown: 3, totalPoints: 100, average: 100 },
    };
    expect(MatchSnapshot.parse(freeRun)).toEqual(freeRun);
  });

  it('rejects a negative eventSeq', () => {
    expect(MatchSnapshot.safeParse({ ...snapshot, eventSeq: -1 }).success).toBe(false);
  });
});

describe('ThrowResult and UndoResult', () => {
  it('accept a throw with its events and an undo', () => {
    const events = [{ type: 'turn_completed', playerId: 'p1', legIndex: 0, turnIndex: 0, darts: [{ segment: 20, multiplier: 3 }], total: 60, remaining: 241 }];
    expect(ThrowResult.parse({ throw: throwRecord, events, state: snapshot })).toEqual({ throw: throwRecord, events, state: snapshot });
    expect(UndoResult.parse({ undoneThrowId: 't1', state: snapshot })).toEqual({ undoneThrowId: 't1', state: snapshot });
  });
});

describe('ApiError', () => {
  it('accepts an error code with a message', () => {
    expect(ApiError.parse({ error: 'not_found', message: 'Match m1 not found' })).toEqual({ error: 'not_found', message: 'Match m1 not found' });
  });

  it('rejects an empty error code', () => {
    expect(ApiError.safeParse({ error: '', message: 'x' }).success).toBe(false);
  });
});
