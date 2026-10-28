import { CameraCalibration } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { scorePoint } from './board.js';
import type { Point } from './board.js';
import { CALIBRATION_BOARD_POINTS, calibrationHomography } from './calibration.js';
import { applyHomography } from './homography.js';
import type { Homography } from './homography.js';

const KNOWN: Homography = [0.8, 0.1, 960, -0.05, 0.9, 540, 0.0002, -0.0001, 1];

function polar(r: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: r * Math.sin(radians), y: r * Math.cos(radians) };
}

describe('CALIBRATION_BOARD_POINTS', () => {
  it('lie on the outer double edge', () => {
    for (const { x, y } of CALIBRATION_BOARD_POINTS) {
      expect(Math.hypot(x, y)).toBeCloseTo(170, 9);
    }
  });

  it.each([
    [0, [5, 20]],
    [1, [13, 6]],
    [2, [17, 3]],
    [3, [8, 11]],
  ])('point %i sits on the boundary of %j', (index, segments) => {
    const point = CALIBRATION_BOARD_POINTS[index];
    expect(point).toBeDefined();
    if (point === undefined) {
      return;
    }
    const inward = { x: (point.x * 169) / 170, y: (point.y * 169) / 170 };
    const { hit } = scorePoint(inward);
    expect(hit.multiplier).toBe(2);
    expect(segments).toContain(hit.segment);
  });
});

describe('calibrationHomography', () => {
  const [a, b, c, d] = CALIBRATION_BOARD_POINTS;
  const calibration = CameraCalibration.parse({
    imageWidth: 1920,
    imageHeight: 1080,
    points: [applyHomography(KNOWN, a), applyHomography(KNOWN, b), applyHomography(KNOWN, c), applyHomography(KNOWN, d)],
  });
  const h = calibrationHomography(calibration);

  it('maps the calibration points back onto the board points', () => {
    calibration.points.forEach((point, i) => {
      const target = CALIBRATION_BOARD_POINTS[i];
      expect(target).toBeDefined();
      if (target !== undefined) {
        const mapped = applyHomography(h, point);
        expect(mapped.x).toBeCloseTo(target.x, 6);
        expect(mapped.y).toBeCloseTo(target.y, 6);
      }
    });
  });

  it.each([
    ['T20', polar(103, 0), { segment: 20, multiplier: 3 }],
    ['D16', polar(166, 234), { segment: 16, multiplier: 2 }],
    ['Bull', { x: 0, y: 0 }, { segment: 25, multiplier: 2 }],
    ['Outer Bull', polar(11, 0), { segment: 25, multiplier: 1 }],
  ])('scores the %s centre seen by the camera', (_, boardPoint, hit) => {
    const imagePoint = applyHomography(KNOWN, boardPoint);
    expect(scorePoint(applyHomography(h, imagePoint)).hit).toEqual(hit);
  });
});
