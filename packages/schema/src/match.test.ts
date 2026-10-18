import { describe, expect, it } from 'vitest';
import { MatchStatus, MatchType, Placement, PracticeMode } from './index.js';

describe('MatchType', () => {
  it.each(['match', 'casual', 'practice'])('accepts %s', (value) => {
    expect(MatchType.parse(value)).toBe(value);
  });

  it('rejects an unknown type', () => {
    expect(MatchType.safeParse('tournament').success).toBe(false);
  });
});

describe('PracticeMode', () => {
  it.each(['free_run', 'solo_501'])('accepts %s', (value) => {
    expect(PracticeMode.parse(value)).toBe(value);
  });

  it('rejects an unknown mode', () => {
    expect(PracticeMode.safeParse('around_the_clock').success).toBe(false);
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
