import { describe, expect, it } from 'vitest';
import {
  AbandonMatchRequest,
  ApiError,
  BestOf,
  CheckoutAttemptRequest,
  CheckoutSession,
  CreateMatchRequest,
  HealthResponse,
  MatchListItem,
  MatchListQuery,
  MatchSnapshot,
  StartingScore,
  ThrowRecord,
  ThrowResult,
  UndoResult,
} from './index.js';

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
  it('defaults a 1v1 match to 301 and best of 1', () => {
    expect(CreateMatchRequest.parse({ type: 'match', playerIds: ['p1', 'p2'] })).toEqual({
      type: 'match',
      playerIds: ['p1', 'p2'],
      startingScore: 301,
      bestOf: 1,
    });
  });

  it('keeps an explicit starting score and best of', () => {
    expect(CreateMatchRequest.parse({ type: 'match', playerIds: ['p1', 'p2'], startingScore: 501, bestOf: 3 })).toEqual({
      type: 'match',
      playerIds: ['p1', 'p2'],
      startingScore: 501,
      bestOf: 3,
    });
  });

  it('defaults a casual game to 301', () => {
    expect(CreateMatchRequest.parse({ type: 'casual', playerIds: ['p1', 'p2', 'p3'] })).toEqual({
      type: 'casual',
      playerIds: ['p1', 'p2', 'p3'],
      startingScore: 301,
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

  it.each(['2-50', '51-100'])('accepts checkout practice with the range %s', (checkoutRange) => {
    const request = { type: 'practice', practiceMode: 'checkouts', playerIds: ['p1'], checkoutRange };
    expect(CreateMatchRequest.parse(request)).toEqual(request);
  });

  it('rejects checkout practice without a range', () => {
    const result = CreateMatchRequest.safeParse({ type: 'practice', practiceMode: 'checkouts', playerIds: ['p1'] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['checkoutRange']]);
  });

  it.each(['free_run', 'solo_501'])('rejects a checkout range in practice %s', (practiceMode) => {
    const result = CreateMatchRequest.safeParse({ type: 'practice', practiceMode, playerIds: ['p1'], checkoutRange: '2-50' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['checkoutRange']]);
  });

  it('rejects an unknown checkout range', () => {
    expect(CreateMatchRequest.safeParse({ type: 'practice', practiceMode: 'checkouts', playerIds: ['p1'], checkoutRange: '0-50' }).success).toBe(false);
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
  status: 'in_progress',
  abandonment: null,
  endedAt: null,
  finishedAt: null,
  editableUntil: null,
  round: 1,
  startedAt: null,
  legStartedAt: null,
  pausedMs: 0,
  legPausedMs: 0,
  eventSeq: 1,
  currentPlayerId: 'p1',
  legIndex: 0,
  turnIndex: 0,
  currentDarts: [{ segment: 20, multiplier: 3 }],
  players: [
    { id: 'p1', name: 'Anna', avatar: '🎯', color: 1, guest: false, remaining: 241, legsWon: 0, place: null, dartsThrownInLeg: 1 },
    { id: 'p2', name: 'Bartek', avatar: null, color: 7, guest: true, remaining: 301, legsWon: 0, place: null, dartsThrownInLeg: 0 },
  ],
  winnerId: null,
  placements: [],
  freeRun: null,
  checkouts: null,
};

const checkoutSession = {
  range: '51-100',
  target: 81,
  attempts: 2,
  successes: 1,
  skips: 1,
  history: [
    { target: 100, success: false },
    { target: 64, success: true },
  ],
};

describe('CheckoutSession', () => {
  it('accepts a session and one without attempts', () => {
    expect(CheckoutSession.parse(checkoutSession)).toEqual(checkoutSession);
    const fresh = { range: '2-50', target: 2, attempts: 0, successes: 0, skips: 0, history: [] };
    expect(CheckoutSession.parse(fresh)).toEqual(fresh);
  });

  it.each([
    ['more attempts than the history', { ...checkoutSession, attempts: 3 }],
    ['fewer attempts than the history', { ...checkoutSession, attempts: 1 }],
    ['more successes than in the history', { ...checkoutSession, successes: 2 }],
    ['fewer successes than in the history', { ...checkoutSession, successes: 0 }],
    ['an unknown range', { ...checkoutSession, range: '0-50' }],
    ['target 1', { ...checkoutSession, target: 1 }],
    ['target 101', { ...checkoutSession, target: 101 }],
    ['no skips', { ...checkoutSession, skips: undefined }],
    ['negative skips', { ...checkoutSession, skips: -1 }],
    ['fractional skips', { ...checkoutSession, skips: 0.5 }],
    ['skips as a string', { ...checkoutSession, skips: '1' }],
  ])('rejects %s', (_name, value) => {
    expect(CheckoutSession.safeParse(value).success).toBe(false);
  });

  it('accepts skips without attempts', () => {
    const skipped = { range: '2-50', target: 30, attempts: 0, successes: 0, skips: 2, history: [] };
    expect(CheckoutSession.parse(skipped)).toEqual(skipped);
  });

  it('does not carry a seed or a rule', () => {
    expect(CheckoutSession.parse({ ...checkoutSession, seed: 42, rule: 'repeat_on_miss' })).toEqual(checkoutSession);
  });
});

describe('CheckoutAttemptRequest', () => {
  it('accepts a success and a failure', () => {
    expect(CheckoutAttemptRequest.parse({ success: true })).toEqual({ success: true });
    expect(CheckoutAttemptRequest.parse({ success: false })).toEqual({ success: false });
  });

  it.each([
    ['an empty body', {}],
    ['a string', { success: 'true' }],
    ['a number', { success: 1 }],
  ])('rejects %s', (_name, value) => {
    expect(CheckoutAttemptRequest.safeParse(value).success).toBe(false);
  });
});

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
      players: [{ id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, remaining: null, legsWon: null, place: null, dartsThrownInLeg: 3 }],
      freeRun: { dartsThrown: 3, totalPoints: 100, average: 100 },
    };
    expect(MatchSnapshot.parse(freeRun)).toEqual(freeRun);
  });

  it('accepts a checkout practice snapshot', () => {
    const checkouts = {
      ...snapshot,
      type: 'practice',
      practiceMode: 'checkouts',
      startingScore: null,
      legsToWin: null,
      countsToStats: false,
      round: null,
      startedAt: null,
      legStartedAt: null,
      turnIndex: 2,
      currentDarts: [],
      players: [{ id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, remaining: null, legsWon: null, place: null, dartsThrownInLeg: 0 }],
      checkouts: checkoutSession,
    };
    expect(MatchSnapshot.parse(checkouts)).toEqual(checkouts);
  });

  it('rejects a negative eventSeq', () => {
    expect(MatchSnapshot.safeParse({ ...snapshot, eventSeq: -1 }).success).toBe(false);
  });

  it.each([
    ['a missing color', undefined],
    ['color 0', 0],
    ['color 17', 17],
    ['a fractional color', 1.5],
  ])('rejects a player with %s', (_name, color) => {
    const [anna, bartek] = snapshot.players;
    expect(MatchSnapshot.safeParse({ ...snapshot, players: [{ ...anna, color }, bartek] }).success).toBe(false);
  });

  it('requires status', () => {
    expect(MatchSnapshot.safeParse({ ...snapshot, status: undefined }).success).toBe(false);
  });

  it('accepts an abandoned snapshot', () => {
    const abandoned = { ...snapshot, status: 'abandoned', abandonment: { playerId: 'p1', reason: null, at: '2026-10-15T18:40:00.000Z' } };
    expect(MatchSnapshot.parse(abandoned)).toEqual(abandoned);
  });

  it('accepts an ended snapshot', () => {
    const ended = { ...snapshot, status: 'ended', endedAt: '2026-10-15T18:40:00.000Z' };
    expect(MatchSnapshot.parse(ended)).toEqual(ended);
  });

  it('rejects an endedAt that is not an ISO date', () => {
    expect(MatchSnapshot.safeParse({ ...snapshot, status: 'ended', endedAt: 'wczoraj' }).success).toBe(false);
  });

  it('accepts a finished snapshot with the undo window', () => {
    const finished = {
      ...snapshot,
      finished: true,
      status: 'finished',
      finishedAt: '2026-10-15T18:40:00.000Z',
      editableUntil: '2026-10-15T18:45:00.000Z',
    };
    expect(MatchSnapshot.parse(finished)).toEqual(finished);
  });

  it.each(['finishedAt', 'editableUntil'])('rejects a %s that is not an ISO date', (field) => {
    expect(MatchSnapshot.safeParse({ ...snapshot, [field]: 'za pięć minut' }).success).toBe(false);
  });

  it.each(['finishedAt', 'editableUntil'])('requires %s', (field) => {
    expect(MatchSnapshot.safeParse({ ...snapshot, [field]: undefined }).success).toBe(false);
  });

  it('accepts a snapshot with game and leg times', () => {
    const timed = {
      ...snapshot,
      round: 7,
      startedAt: '2026-10-15T18:30:05.000Z',
      legStartedAt: '2026-10-15T18:35:00.000Z',
      pausedMs: 60_000,
      legPausedMs: 0,
    };
    expect(MatchSnapshot.parse(timed)).toEqual(timed);
  });

  it.each(['round', 'startedAt', 'legStartedAt', 'pausedMs', 'legPausedMs'])('requires %s', (field) => {
    expect(MatchSnapshot.safeParse({ ...snapshot, [field]: undefined }).success).toBe(false);
  });

  it('rejects round 0', () => {
    expect(MatchSnapshot.safeParse({ ...snapshot, round: 0 }).success).toBe(false);
  });

  it.each(['pausedMs', 'legPausedMs'])('rejects a negative or non-integer %s', (field) => {
    expect(MatchSnapshot.safeParse({ ...snapshot, [field]: -1 }).success).toBe(false);
    expect(MatchSnapshot.safeParse({ ...snapshot, [field]: 1.5 }).success).toBe(false);
  });

  it.each(['startedAt', 'legStartedAt'])('rejects a %s that is not an ISO date', (field) => {
    expect(MatchSnapshot.safeParse({ ...snapshot, [field]: 'przed chwilą' }).success).toBe(false);
  });
});

describe('AbandonMatchRequest', () => {
  it('trims the reason', () => {
    expect(AbandonMatchRequest.parse({ playerId: 'p1', reason: '  koniec prądu  ' })).toEqual({ playerId: 'p1', reason: 'koniec prądu' });
  });

  it('accepts a request without a reason', () => {
    expect(AbandonMatchRequest.parse({ playerId: 'p1' })).toEqual({ playerId: 'p1' });
  });

  it.each([
    ['an empty reason', { playerId: 'p1', reason: '   ' }],
    ['a reason over 200 characters', { playerId: 'p1', reason: 'x'.repeat(201) }],
    ['a missing player', { reason: 'koniec' }],
  ])('rejects %s', (_name, value) => {
    expect(AbandonMatchRequest.safeParse(value).success).toBe(false);
  });

  it('accepts a reason of 200 characters', () => {
    expect(AbandonMatchRequest.safeParse({ playerId: 'p1', reason: 'x'.repeat(200) }).success).toBe(true);
  });
});

describe('MatchListItem and MatchListQuery', () => {
  it('parses a list item', () => {
    const { id, type, practiceMode, startingScore, legsToWin, createdAt, status, abandonment, currentPlayerId, legIndex, players, freeRun, checkouts, winnerId, placements, endedAt } = snapshot;
    const item = {
      id,
      type,
      practiceMode,
      startingScore,
      legsToWin,
      createdAt,
      status,
      abandonment,
      currentPlayerId,
      legIndex,
      players,
      freeRun,
      checkouts,
      winnerId,
      placements,
      endedAt,
      updatedAt: '2026-10-15T18:31:00.000Z',
    };
    expect(MatchListItem.parse(item)).toEqual(item);
    expect(MatchListItem.safeParse({ ...item, updatedAt: undefined }).success).toBe(false);
  });

  it('parses a checkout practice list item', () => {
    const { id, createdAt, status, abandonment, legIndex, winnerId, placements, endedAt } = snapshot;
    const item = {
      id,
      type: 'practice',
      practiceMode: 'checkouts',
      startingScore: null,
      legsToWin: null,
      createdAt,
      status,
      abandonment,
      currentPlayerId: 'p1',
      legIndex,
      players: [{ id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, remaining: null, legsWon: null, place: null, dartsThrownInLeg: 0 }],
      freeRun: null,
      checkouts: checkoutSession,
      winnerId,
      placements,
      endedAt,
      updatedAt: '2026-10-15T18:31:00.000Z',
    };
    expect(MatchListItem.parse(item)).toEqual(item);
    expect(MatchListItem.safeParse({ ...item, checkouts: undefined }).success).toBe(false);
  });

  it('requires the result fields', () => {
    const { id, type, practiceMode, startingScore, legsToWin, createdAt, status, abandonment, currentPlayerId, legIndex, players, freeRun, checkouts, winnerId, placements, endedAt } = snapshot;
    const item = { id, type, practiceMode, startingScore, legsToWin, createdAt, status, abandonment, currentPlayerId, legIndex, players, freeRun, checkouts, winnerId, placements, endedAt, updatedAt: '2026-10-15T18:31:00.000Z' };
    expect(MatchListItem.safeParse({ ...item, winnerId: undefined }).success).toBe(false);
    expect(MatchListItem.safeParse({ ...item, placements: undefined }).success).toBe(false);
    expect(MatchListItem.safeParse({ ...item, endedAt: undefined }).success).toBe(false);
  });

  it('accepts only the unfinished status filter', () => {
    expect(MatchListQuery.parse({})).toEqual({});
    expect(MatchListQuery.parse({ status: 'unfinished' })).toEqual({ status: 'unfinished' });
    expect(MatchListQuery.safeParse({ status: 'finished' }).success).toBe(false);
  });

  it('filters by player and type together with the status', () => {
    expect(MatchListQuery.parse({ status: 'unfinished', playerId: 'p1', type: 'casual' })).toEqual({ status: 'unfinished', playerId: 'p1', type: 'casual' });
    expect(MatchListQuery.safeParse({ type: 'bogus' }).success).toBe(false);
    expect(MatchListQuery.safeParse({ playerId: '' }).success).toBe(false);
  });
});

describe('ThrowResult and UndoResult', () => {
  it('accept a throw with its events and an undo', () => {
    const events = [{ type: 'turn_completed', playerId: 'p1', legIndex: 0, turnIndex: 0, darts: [{ segment: 20, multiplier: 3 }], total: 60, remaining: 241 }];
    expect(ThrowResult.parse({ throw: throwRecord, events, state: snapshot })).toEqual({ throw: throwRecord, events, state: snapshot });
    expect(UndoResult.parse({ undoneThrowId: 't1', state: snapshot })).toEqual({ undoneThrowId: 't1', state: snapshot });
  });

  it('accept an undo of a checkout attempt without a throw id', () => {
    expect(UndoResult.parse({ undoneThrowId: null, state: snapshot })).toEqual({ undoneThrowId: null, state: snapshot });
    expect(UndoResult.safeParse({ undoneThrowId: '', state: snapshot }).success).toBe(false);
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

describe('HealthResponse', () => {
  it('accepts the ok status', () => {
    expect(HealthResponse.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it.each([{ status: 'down' }, {}])('rejects %j', (value) => {
    expect(HealthResponse.safeParse(value).success).toBe(false);
  });
});
