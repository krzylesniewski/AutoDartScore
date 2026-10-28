import { describe, expect, it } from 'vitest';
import { checkoutPractice, player, reviewedThrow, snapshot } from '../test/snapshots';
import { reviewTurn } from './review-turn';

const counted = reviewedThrow('t1');
const firstPending = reviewedThrow('t2', { status: 'pending', scoring: 'waiting' });
const waiting = reviewedThrow('t3', { scoring: 'waiting' });
const secondPending = reviewedThrow('t3', { status: 'pending', scoring: 'waiting' });

function awaiting(throws = [counted, firstPending, waiting], remaining = 301) {
  return snapshot({
    currentPlayerId: 'p1',
    players: [player('p1', 'Anna', { remaining, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
    lastTurnThrows: throws,
    awaitingReview: true,
  });
}

describe('reviewTurn', () => {
  it('lists the pending throws in turn order', () => {
    expect(reviewTurn(awaiting([firstPending, counted, secondPending])).pending.map((entry) => entry.id)).toEqual(['t2', 't3']);
    expect(reviewTurn(snapshot()).pending).toEqual([]);
  });

  it('offers the confirmed throws of the turn for flagging, also a waiting one', () => {
    expect(reviewTurn(awaiting()).flaggable.map((entry) => entry.id)).toEqual(['t1', 't3']);
  });

  it('never offers a void throw', () => {
    const state = snapshot({ lastTurnThrows: [counted, reviewedThrow('t2', { scoring: 'void' })] });
    expect(reviewTurn(state).flaggable.map((entry) => entry.id)).toEqual(['t1']);
  });

  it('offers nothing in a finished, abandoned or ended game and in checkout practice', () => {
    const throws = [counted];
    expect(reviewTurn(snapshot({ finished: true, lastTurnThrows: throws })).flaggable).toEqual([]);
    expect(reviewTurn(snapshot({ status: 'abandoned', lastTurnThrows: throws })).flaggable).toEqual([]);
    expect(reviewTurn(snapshot({ type: 'practice', practiceMode: 'solo_501', status: 'ended', lastTurnThrows: throws })).flaggable).toEqual([]);
    expect(reviewTurn(checkoutPractice(undefined, { lastTurnThrows: throws })).flaggable).toEqual([]);
  });

  it('is full only with 3 throws while the turn waits', () => {
    expect(reviewTurn(awaiting()).full).toBe(true);
    expect(reviewTurn(awaiting([counted, firstPending])).full).toBe(false);
    expect(reviewTurn(snapshot({ lastTurnThrows: [counted, counted, counted] })).full).toBe(false);
  });

  describe('closed', () => {
    it('is true for a full turn', () => {
      expect(reviewTurn(awaiting()).closed).toBe(true);
    });

    it('is false while the reading leaves darts to throw', () => {
      expect(reviewTurn(awaiting([counted, firstPending])).closed).toBe(false);
      expect(reviewTurn(snapshot({ lastTurnThrows: [counted] })).closed).toBe(false);
    });

    it('is true when the pending reading busts before the 3rd dart', () => {
      const bust = reviewedThrow('t2', { status: 'pending', scoring: 'waiting', value: { segment: 20, multiplier: 3 } });
      expect(reviewTurn(awaiting([counted, bust], 40)).closed).toBe(true);
    });

    it('is true when the pending reading wins the leg', () => {
      const win = reviewedThrow('t2', { status: 'pending', scoring: 'waiting', value: { segment: 20, multiplier: 2 } });
      expect(reviewTurn(awaiting([win], 40)).closed).toBe(true);
    });

    it('counts the waiting throws behind the pending one in order', () => {
      const pendingTen = reviewedThrow('t1', { status: 'pending', scoring: 'waiting', value: { segment: 10, multiplier: 1 } });
      const waitingDouble = reviewedThrow('t2', { scoring: 'waiting', value: { segment: 15, multiplier: 2 } });
      expect(reviewTurn(awaiting([pendingTen, waitingDouble], 40)).closed).toBe(true);
      expect(reviewTurn(awaiting([pendingTen, waitingDouble], 60)).closed).toBe(false);
    });

    it('is false in Free run before the 3rd dart', () => {
      const state = snapshot({
        type: 'practice',
        practiceMode: 'free_run',
        startingScore: null,
        players: [player('p1', 'Anna', { remaining: null })],
        lastTurnThrows: [firstPending],
        awaitingReview: true,
      });
      expect(reviewTurn(state).closed).toBe(false);
    });
  });
});
