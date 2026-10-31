import { describe, expect, it } from 'vitest';
import { Hit, HitEvent, HitReview } from './index.js';

describe('Hit', () => {
  it.each([
    [1, 1],
    [20, 3],
    [16, 2],
    [25, 1], // Outer Bull
    [25, 2], // Bull
    [0, 0], // miss
  ])('accepts segment %i with multiplier %i', (segment, multiplier) => {
    expect(Hit.safeParse({ segment, multiplier }).success).toBe(true);
  });

  it.each([
    [25, 3], // no treble Bull
    [25, 0],
    [0, 1], // miss must have multiplier 0
    [20, 0],
    [21, 1],
    [-1, 1],
    [19.5, 1],
    [20, 4],
  ])('rejects segment %d with multiplier %d', (segment, multiplier) => {
    expect(Hit.safeParse({ segment, multiplier }).success).toBe(false);
  });
});

describe('HitEvent', () => {
  const valid = {
    eventId: '4b8e7a61-2c0f-4f5e-9d1a-6c3b2a1f0e9d',
    matchId: 'm_123',
    source: 'camera-1',
    sequence: 42,
    segment: 20,
    multiplier: 3,
    confidence: 0.87,
    detectedAt: '2026-10-15T18:30:12.345Z',
  };

  it('accepts the documented example', () => {
    expect(HitEvent.parse(valid)).toEqual(valid);
  });

  it.each([
    ['eventId', 'not-a-uuid'],
    ['matchId', ''],
    ['source', ''],
    ['sequence', -1],
    ['confidence', 1.5],
    ['detectedAt', '15.10.2026'],
  ])('rejects invalid %s', (field, value) => {
    expect(HitEvent.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });

  it('rejects an impossible segment and multiplier combination', () => {
    expect(HitEvent.safeParse({ ...valid, segment: 25, multiplier: 3 }).success).toBe(false);
  });

  const review = {
    reason: 'near_wire',
    candidates: [
      { segment: 5, multiplier: 1, probability: 0.48 },
      { segment: 20, multiplier: 1, probability: 0.45 },
    ],
    frames: { before: 'session-01/0042-before.jpg', after: 'session-01/0042-after.jpg' },
    tip: { x: 412, y: 238.5 },
  };

  it('accepts a hit with a review', () => {
    expect(HitEvent.parse({ ...valid, review })).toEqual({ ...valid, review });
  });

  it('leaves the review key out when the hit has none', () => {
    expect(HitEvent.parse(valid)).not.toHaveProperty('review');
  });

  it('defaults the review candidates to an empty list', () => {
    expect(HitEvent.parse({ ...valid, review: { reason: 'occlusion' } }).review).toEqual({ reason: 'occlusion', candidates: [] });
  });

  it.each([
    ['the manual reason', { ...review, reason: 'manual' }],
    ['a treble Bull candidate', { ...review, candidates: [{ segment: 25, multiplier: 3, probability: 0.5 }] }],
    ['a probability above 1', { ...review, candidates: [{ segment: 20, multiplier: 1, probability: 1.2 }] }],
    ['more than 10 candidates', { ...review, candidates: Array.from({ length: 11 }, () => ({ segment: 1, multiplier: 1, probability: 0.1 })) }],
    ['an absolute frame path', { ...review, frames: { before: '/var/frames/a.jpg', after: 'b.jpg' } }],
    ['a frame path with ..', { ...review, frames: { before: 'a.jpg', after: 'session-01/../../b.jpg' } }],
    ['an empty frame path', { ...review, frames: { before: '', after: 'b.jpg' } }],
    ['a negative tip coordinate', { ...review, tip: { x: -1, y: 10 } }],
    ['an infinite tip coordinate', { ...review, tip: { x: Infinity, y: 10 } }],
  ])('rejects a review with %s', (_name, invalid) => {
    expect(HitEvent.safeParse({ ...valid, review: invalid }).success).toBe(false);
  });

  it('accepts a frame path with dots inside a name', () => {
    expect(HitReview.safeParse({ reason: 'low_confidence', frames: { before: 'a..b.jpg', after: './c.jpg' } }).success).toBe(true);
  });
});
