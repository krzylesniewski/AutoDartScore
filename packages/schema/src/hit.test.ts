import { describe, expect, it } from 'vitest';
import { Hit, HitEvent } from './index.js';

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
});
