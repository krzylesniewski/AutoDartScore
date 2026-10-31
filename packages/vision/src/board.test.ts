import { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { BOARD_SEGMENTS, scorePoint } from './board.js';
import type { Point } from './board.js';

function polar(r: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: r * Math.sin(radians), y: r * Math.cos(radians) };
}

const segmentCentres = BOARD_SEGMENTS.map((segment, i) => [segment, 18 * i] as const);

describe('scorePoint', () => {
  it.each([
    ['inner single', 57.45, 1],
    ['treble', 103, 3],
    ['outer single', 134.5, 1],
    ['double', 166, 2],
  ] as const)('scores every segment in the %s ring', (_, r, multiplier) => {
    for (const [segment, angle] of segmentCentres) {
      const { hit } = scorePoint(polar(r, angle));
      expect(hit).toEqual({ segment, multiplier });
      expect(Hit.parse(hit)).toEqual(hit);
    }
  });

  it('scores the Bull, the Outer Bull and misses', () => {
    expect(scorePoint({ x: 0, y: 0 }).hit).toEqual({ segment: 25, multiplier: 2 });
    expect(scorePoint(polar(11, 40)).hit).toEqual({ segment: 25, multiplier: 1 });
    expect(scorePoint(polar(171, 0)).hit).toEqual({ segment: 0, multiplier: 0 });
    expect(scorePoint(polar(300, 200)).hit).toEqual({ segment: 0, multiplier: 0 });
  });

  it.each([
    [6.35, { segment: 25, multiplier: 2 }, { segment: 25, multiplier: 1 }],
    [15.9, { segment: 25, multiplier: 1 }, { segment: 20, multiplier: 1 }],
    [99, { segment: 20, multiplier: 1 }, { segment: 20, multiplier: 3 }],
    [107, { segment: 20, multiplier: 3 }, { segment: 20, multiplier: 1 }],
    [162, { segment: 20, multiplier: 1 }, { segment: 20, multiplier: 2 }],
    [170, { segment: 20, multiplier: 2 }, { segment: 0, multiplier: 0 }],
  ])('scores both sides of the ring at r = %d', (r, inside, outside) => {
    expect(scorePoint(polar(r - 0.01, 0)).hit).toEqual(inside);
    expect(scorePoint(polar(r + 0.01, 0)).hit).toEqual(outside);
  });

  it.each([
    [8.99, 20],
    [9.01, 1],
    [350.99, 5],
    [351.01, 20],
  ])('scores %d° at r = 130 as segment %i', (angle, segment) => {
    expect(scorePoint(polar(130, angle)).hit).toEqual({ segment, multiplier: 1 });
  });

  it('scores the bottom of the board as segment 3', () => {
    expect(scorePoint({ x: 0, y: -100 }).hit.segment).toBe(3);
  });

  it.each([
    ['the centre to the Bull wire', { x: 0, y: 0 }, 6.35],
    ['the T20 centre to the treble wires', { x: 0, y: 103 }, 4],
    ['the inner single to the radial wire', { x: 0, y: 57.45 }, 57.45 * Math.sin(Math.PI / 20)],
    ['a miss to the outer double wire', { x: 0, y: 180 }, 10],
    ['a point 1 mm off the 20|1 wire', offRadialWire(130, 9, 1), 1],
    ['a point on the treble wire', polar(99, 30), 0],
  ])('measures %s', (_, point, expected) => {
    expect(scorePoint(point).wireDistance).toBeCloseTo(expected, 6);
  });

  it.each([
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, 10],
  ])('rejects the non-finite point (%d, %d)', (x, y) => {
    expect(() => scorePoint({ x, y })).toThrow(Error);
  });
});

function offRadialWire(r: number, degrees: number, offset: number): Point {
  const onWire = polar(r, degrees);
  const normal = polar(offset, degrees + 90);
  return { x: onWire.x + normal.x, y: onWire.y + normal.y };
}
