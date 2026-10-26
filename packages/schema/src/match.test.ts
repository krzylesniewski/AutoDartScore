import { describe, expect, it } from 'vitest';
import { CheckoutAttempt, CheckoutRange, MatchStatus, MatchType, Placement, PracticeMode } from './index.js';

describe('MatchType', () => {
  it.each(['match', 'casual', 'practice'])('accepts %s', (value) => {
    expect(MatchType.parse(value)).toBe(value);
  });

  it('rejects an unknown type', () => {
    expect(MatchType.safeParse('tournament').success).toBe(false);
  });
});

describe('PracticeMode', () => {
  it.each(['free_run', 'solo_501', 'checkouts'])('accepts %s', (value) => {
    expect(PracticeMode.parse(value)).toBe(value);
  });

  it('rejects an unknown mode', () => {
    expect(PracticeMode.safeParse('around_the_clock').success).toBe(false);
  });
});

describe('CheckoutRange', () => {
  it.each(['2-50', '51-100'])('accepts %s', (value) => {
    expect(CheckoutRange.parse(value)).toBe(value);
  });

  it.each(['0-50', '2-100', ''])('rejects %j', (value) => {
    expect(CheckoutRange.safeParse(value).success).toBe(false);
  });
});

describe('CheckoutAttempt', () => {
  it('accepts targets from 2 to 100', () => {
    expect(CheckoutAttempt.parse({ target: 2, success: true })).toEqual({ target: 2, success: true });
    expect(CheckoutAttempt.parse({ target: 100, success: false })).toEqual({ target: 100, success: false });
  });

  it.each([
    ['target 1', { target: 1, success: true }],
    ['target 101', { target: 101, success: true }],
    ['a fractional target', { target: 40.5, success: true }],
    ['a missing result', { target: 40 }],
  ])('rejects %s', (_name, value) => {
    expect(CheckoutAttempt.safeParse(value).success).toBe(false);
  });
});

describe('Placement', () => {
  it('accepts places 1 to 4', () => {
    for (const place of [1, 2, 3, 4]) {
      expect(Placement.safeParse({ playerId: 'p1', place }).success).toBe(true);
    }
  });

  it.each([
    ['place 0', { playerId: 'p1', place: 0 }],
    ['place 5', { playerId: 'p1', place: 5 }],
    ['an empty playerId', { playerId: '', place: 1 }],
  ])('rejects %s', (_name, value) => {
    expect(Placement.safeParse(value).success).toBe(false);
  });
});

describe('MatchStatus', () => {
  it.each(['in_progress', 'abandoned', 'ended', 'finished'])('accepts %s', (value) => {
    expect(MatchStatus.parse(value)).toBe(value);
  });

  it('rejects an unknown status', () => {
    expect(MatchStatus.safeParse('paused').success).toBe(false);
  });
});
