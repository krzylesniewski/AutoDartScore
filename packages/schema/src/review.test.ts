import { describe, expect, it } from 'vitest';
import { ReviewedThrow, ThrowReview, VerifyThrowRequest } from './index.js';

const review = {
  reason: 'near_wire',
  flaggedBy: 'system',
  candidates: [
    { segment: 5, multiplier: 1, probability: 0.48 },
    { segment: 20, multiplier: 1, probability: 0.45 },
  ],
  frames: { before: 'session-01/0042-before.jpg', after: 'session-01/0042-after.jpg' },
  tip: { x: 412, y: 238 },
  resolved: { segment: 12, multiplier: 1, by: 'player', at: '2026-10-15T18:31:00.000Z' },
};

const reviewed = {
  id: 't1',
  sequence: 0,
  source: 'camera-1',
  confidence: 0.6,
  reading: { segment: 5, multiplier: 1 },
  value: { segment: 12, multiplier: 1 },
  status: 'confirmed',
  scoring: 'counted',
  review,
};

describe('ThrowReview', () => {
  it('round-trips the documented shape', () => {
    expect(ThrowReview.parse(review)).toEqual(review);
  });

  it('accepts a manual flag by the player without frames, tip or resolution', () => {
    const manual = { reason: 'manual', flaggedBy: 'player', candidates: [], resolved: null };
    expect(ThrowReview.parse(manual)).toEqual(manual);
  });

  it.each([
    ['an unknown reason', { ...review, reason: 'guess' }],
    ['an unknown actor', { ...review, flaggedBy: 'camera' }],
    ['a treble Bull resolution', { ...review, resolved: { ...review.resolved, segment: 25, multiplier: 3 } }],
    ['a resolution without a time', { ...review, resolved: { segment: 12, multiplier: 1, by: 'player' } }],
  ])('rejects %s', (_name, invalid) => {
    expect(ThrowReview.safeParse(invalid).success).toBe(false);
  });
});

describe('ReviewedThrow', () => {
  it('round-trips a corrected throw', () => {
    expect(ReviewedThrow.parse(reviewed)).toEqual(reviewed);
  });

  it('round-trips a throw that was never flagged', () => {
    const plain = { ...reviewed, confidence: 1, value: reviewed.reading, review: null };
    expect(ReviewedThrow.parse(plain)).toEqual(plain);
  });

  it.each([
    ['status', 'verified'],
    ['scoring', 'ignored'],
    ['value', { segment: 0, multiplier: 1 }],
  ])('rejects an invalid %s', (field, value) => {
    expect(ReviewedThrow.safeParse({ ...reviewed, [field]: value }).success).toBe(false);
  });
});

describe('VerifyThrowRequest', () => {
  it('accepts a hit and rejects an impossible one', () => {
    expect(VerifyThrowRequest.parse({ segment: 25, multiplier: 2 })).toEqual({ segment: 25, multiplier: 2 });
    expect(VerifyThrowRequest.safeParse({ segment: 25, multiplier: 3 }).success).toBe(false);
  });
});
