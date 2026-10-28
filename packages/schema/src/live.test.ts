import { describe, expect, it } from 'vitest';
import { LiveMessage } from './index.js';

const meta = { matchId: 'm1', eventSeq: 3 };
const darts = [{ segment: 20, multiplier: 1 }];

const state = {
  id: 'm1',
  type: 'casual',
  practiceMode: null,
  startingScore: 301,
  legsToWin: null,
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
  eventSeq: 3,
  currentPlayerId: 'p2',
  legIndex: 0,
  turnIndex: 1,
  currentDarts: [],
  players: [
    { id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, remaining: 0, legsWon: null, place: 1, dartsThrownInLeg: 3 },
    { id: 'p2', name: 'Bartek', avatar: null, color: 7, guest: false, remaining: 301, legsWon: null, place: null, dartsThrownInLeg: 0 },
  ],
  winnerId: null,
  placements: [],
  freeRun: null,
  checkouts: null,
  lastTurnThrows: [],
  awaitingReview: false,
};

const throwRecord = {
  id: 't3',
  matchId: 'm1',
  eventId: '4b8e7a61-2c0f-4f5e-9d1a-6c3b2a1f0e9d',
  source: 'camera-1',
  sequence: 2,
  segment: 20,
  multiplier: 1,
  confidence: 0.87,
  detectedAt: '2026-10-15T18:30:12.345Z',
  receivedAt: '2026-10-15T18:30:12.400Z',
};

const reviewedThrow = {
  id: 't3',
  sequence: 2,
  source: 'camera-1',
  confidence: 0.5,
  reading: { segment: 20, multiplier: 1 },
  value: { segment: 5, multiplier: 1 },
  status: 'confirmed',
  scoring: 'counted',
  review: {
    reason: 'near_wire',
    flaggedBy: 'system',
    candidates: [{ segment: 5, multiplier: 1, probability: 0.48 }],
    resolved: { segment: 5, multiplier: 1, by: 'player', at: '2026-10-15T18:31:00.000Z' },
  },
};

describe('LiveMessage', () => {
  it.each([
    { type: 'state_updated', ...meta, state },
    { type: 'throw_registered', ...meta, throw: throwRecord },
    { type: 'throw_undone', ...meta, throwId: 't3' },
    { type: 'throw_flagged', ...meta, throw: { ...reviewedThrow, value: reviewedThrow.reading, status: 'pending', scoring: 'waiting', review: { ...reviewedThrow.review, resolved: null } } },
    { type: 'throw_verified', ...meta, throw: reviewedThrow },
    { type: 'turn_completed', ...meta, playerId: 'p1', legIndex: 0, turnIndex: 0, darts, total: 20, remaining: 281 },
    { type: 'bust', ...meta, playerId: 'p1', legIndex: 0, turnIndex: 4, darts, remaining: 16 },
    { type: 'leg_won', ...meta, playerId: 'p1', legIndex: 0, checkout: 40, dartsThrown: 15 },
    { type: 'match_won', ...meta, playerId: 'p1', legsWon: { p1: 2, p2: 1 } },
    { type: 'player_finished', ...meta, playerId: 'p1', legIndex: 0, place: 1, checkout: 40, dartsThrown: 18 },
    {
      type: 'casual_finished',
      ...meta,
      placements: [
        { playerId: 'p1', place: 1 },
        { playerId: 'p2', place: 2 },
      ],
    },
    { type: 'achievement', ...meta, playerId: 'p1', kind: 'turn_record', value: 140, previous: 100 },
  ])('round-trips $type', (message) => {
    expect(LiveMessage.parse(message)).toEqual(message);
  });

  it('rejects a message without matchId', () => {
    expect(LiveMessage.safeParse({ type: 'throw_undone', eventSeq: 1, throwId: 't1' }).success).toBe(false);
  });

  it('rejects a negative eventSeq', () => {
    expect(LiveMessage.safeParse({ type: 'throw_undone', matchId: 'm1', eventSeq: -1, throwId: 't1' }).success).toBe(false);
  });

  it('rejects a domain event without eventSeq', () => {
    expect(LiveMessage.safeParse({ type: 'match_won', matchId: 'm1', playerId: 'p1', legsWon: { p1: 1, p2: 0 } }).success).toBe(false);
  });

  it('rejects a state whose player has no color', () => {
    const players = state.players.map((player) => ({ ...player, color: undefined }));
    expect(LiveMessage.safeParse({ type: 'state_updated', ...meta, state: { ...state, players } }).success).toBe(false);
  });

  it('parses an achievement without a previous value', () => {
    const message = { type: 'achievement', ...meta, playerId: 'p1', kind: 'first_180', value: 180, previous: null };
    expect(LiveMessage.parse(message)).toEqual(message);
  });

  it('rejects an achievement of an unknown kind', () => {
    expect(LiveMessage.safeParse({ type: 'achievement', ...meta, playerId: 'p1', kind: 'best_average', value: 60, previous: 50 }).success).toBe(false);
  });

  it('rejects an achievement with a negative value', () => {
    expect(LiveMessage.safeParse({ type: 'achievement', ...meta, playerId: 'p1', kind: 'turn_record', value: -1, previous: 0 }).success).toBe(false);
  });

  it('rejects an achievement without previous', () => {
    expect(LiveMessage.safeParse({ type: 'achievement', ...meta, playerId: 'p1', kind: 'turn_record', value: 140 }).success).toBe(false);
  });

  it('rejects an unknown type', () => {
    expect(LiveMessage.safeParse({ type: 'throw_corrected', ...meta, throwId: 't1' }).success).toBe(false);
  });
});
