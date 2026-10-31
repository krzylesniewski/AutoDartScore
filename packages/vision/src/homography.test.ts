import { describe, expect, it } from 'vitest';
import type { Point } from './board.js';
import { applyHomography, computeHomography, invertHomography } from './homography.js';
import type { Homography } from './homography.js';

type Quad = readonly [Point, Point, Point, Point];

const KNOWN: Homography = [0.8, 0.1, 960, -0.05, 0.9, 540, 0.0002, -0.0001, 1];

const square: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const boardPoints: Quad = [
  { x: -30, y: 160 },
  { x: 165, y: 25 },
  { x: 20, y: -150 },
  { x: -170, y: -10 },
];

const otherPoints: readonly Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 0, y: 100 },
  { x: -100, y: -100 },
  { x: 50.5, y: -75.25 },
  { x: 170, y: 170 },
  { x: -170, y: 170 },
  { x: 200, y: -200 },
  { x: 12.345, y: 67.89 },
  { x: -1, y: 1 },
  { x: 300, y: 10 },
  { x: -250, y: -50 },
];

function mapQuad(h: Homography, points: Quad): Quad {
  const [a, b, c, d] = points;
  return [applyHomography(h, a), applyHomography(h, b), applyHomography(h, c), applyHomography(h, d)];
}

function expectPointClose(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

describe('computeHomography', () => {
  it('maps any point to itself for identity correspondences', () => {
    const h = computeHomography(square, square);
    for (const point of otherPoints) {
      expectPointClose(applyHomography(h, point), point);
    }
  });

  describe('with a known board → image matrix', () => {
    const imagePoints = mapQuad(KNOWN, boardPoints);
    const h = computeHomography(boardPoints, imagePoints);

    it('maps the four points onto their targets', () => {
      boardPoints.forEach((point, i) => {
        const target = imagePoints[i];
        expect(target).toBeDefined();
        if (target !== undefined) {
          expectPointClose(applyHomography(h, point), target);
        }
      });
    });

    it.each(otherPoints)('maps (%o) like the known matrix', (point) => {
      expectPointClose(applyHomography(h, point), applyHomography(KNOWN, point));
    });

    it.each(otherPoints)('round-trips (%o) through the inverse', (point) => {
      expectPointClose(applyHomography(invertHomography(h), applyHomography(h, point)), point);
    });
  });

  const collinear: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 0, y: 5 },
  ];
  const duplicated: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];

  it('rejects three collinear source points', () => {
    expect(() => computeHomography(collinear, square)).toThrow(/collinear/);
  });

  it('rejects three collinear destination points', () => {
    expect(() => computeHomography(square, collinear)).toThrow(/destination/);
  });

  it('rejects nearly collinear pixel-scale points', () => {
    const nearly: Quad = [
      { x: 100, y: 100 },
      { x: 1000, y: 500 },
      { x: 1900, y: 900 + 1e-7 },
      { x: 500, y: 1000 },
    ];
    expect(() => computeHomography(nearly, square)).toThrow(/collinear/);
  });

  it('rejects a duplicated point', () => {
    expect(() => computeHomography(duplicated, square)).toThrow(/duplicated/);
  });

  it('rejects non-finite points', () => {
    const [a, b, c] = square;
    expect(() => computeHomography([a, b, c, { x: Number.NaN, y: 1 }], square)).toThrow(/finite/);
  });
});

describe('invertHomography', () => {
  it('rejects a singular matrix', () => {
    expect(() => invertHomography([1, 0, 0, 0, 1, 0, 0, 0, 0])).toThrow(/singular/);
  });
});

describe('applyHomography', () => {
  it('rejects a point that maps to infinity', () => {
    expect(() => applyHomography([1, 0, 0, 0, 1, 0, 1, 0, 1], { x: -1, y: 0 })).toThrow(/infinity/);
  });
});
