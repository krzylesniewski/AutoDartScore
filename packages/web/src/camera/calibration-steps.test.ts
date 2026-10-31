import { describe, expect, it } from 'vitest';
import { CALIBRATION_STEPS, EMPTY_POINTS, nextStep, placePoint, toCalibration, type CalibrationPoints } from './calibration-steps';

const size = { width: 1920, height: 1080 };
const valid: CalibrationPoints = [
  { x: 960, y: 200 },
  { x: 1500, y: 540 },
  { x: 960, y: 900 },
  { x: 420, y: 540 },
];

describe('calibration steps', () => {
  it('follows the CameraCalibration order', () => {
    expect(CALIBRATION_STEPS.map((step) => step.segments)).toEqual([
      [5, 20],
      [13, 6],
      [17, 3],
      [8, 11],
    ]);
    expect(EMPTY_POINTS).toEqual([null, null, null, null]);
  });

  it('places points in order and ends after the fourth', () => {
    let points = EMPTY_POINTS;
    const visited: (number | null)[] = [];
    let active: number | null = 0;
    while (active !== null) {
      points = placePoint(points, active, { x: active, y: active });
      active = nextStep(points, active);
      visited.push(active);
    }
    expect(visited).toEqual([1, 2, 3, null]);
    expect(points).toEqual([0, 1, 2, 3].map((i) => ({ x: i, y: i })));
  });

  it('wraps around to a skipped point', () => {
    const points = placePoint(placePoint(EMPTY_POINTS, 2, { x: 1, y: 1 }), 3, { x: 2, y: 2 });
    expect(nextStep(points, 3)).toBe(0);
    expect(nextStep(placePoint(points, 0, { x: 3, y: 3 }), 0)).toBe(1);
  });

  it('starts from the first unset point when searching after the last index', () => {
    expect(nextStep(EMPTY_POINTS, 3)).toBe(0);
    expect(nextStep(valid, 3)).toBeNull();
  });

  it('corrects one point and keeps the others', () => {
    const corrected = placePoint(valid, 1, { x: 1490.5, y: 530.2 });
    expect(corrected).toEqual([valid[0], { x: 1490.5, y: 530.2 }, valid[2], valid[3]]);
    expect(valid[1]).toEqual({ x: 1500, y: 540 });
    expect(nextStep(corrected, 1)).toBeNull();
  });
});

describe('toCalibration', () => {
  it('builds a calibration from 4 points', () => {
    expect(toCalibration(valid, size)).toEqual({ imageWidth: 1920, imageHeight: 1080, points: valid });
  });

  it('gives null for 3 points', () => {
    expect(toCalibration([...valid.slice(0, 3), null], size)).toBeNull();
    expect(toCalibration([null, ...valid.slice(1)], size)).toBeNull();
    expect(toCalibration(valid.slice(0, 3), size)).toBeNull();
  });

  it('gives null for a point outside the image', () => {
    expect(toCalibration(valid, { width: 1400, height: 1080 })).toBeNull();
  });

  it('gives null for 3 collinear points', () => {
    expect(toCalibration(placePoint(valid, 2, { x: 960, y: 540 }), size)).toBeNull();
  });

  it('gives null for a repeated point', () => {
    expect(toCalibration(placePoint(valid, 1, { x: 960, y: 200 }), size)).toBeNull();
  });
});
