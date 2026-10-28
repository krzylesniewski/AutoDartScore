import { describe, expect, it } from 'vitest';
import { CameraCalibration, CameraId, DEFAULT_CAMERA_ID } from './index.js';

const valid = {
  imageWidth: 1920,
  imageHeight: 1080,
  points: [
    { x: 960.5, y: 120.25 },
    { x: 1500, y: 540 },
    { x: 960, y: 1000 },
    { x: 400, y: 540 },
  ],
};

function withPoint(index: number, point: { x: number; y: number }) {
  return { ...valid, points: valid.points.map((p, i) => (i === index ? point : p)) };
}

describe('CameraCalibration', () => {
  it('accepts four points inside the image', () => {
    expect(CameraCalibration.parse(valid)).toEqual(valid);
  });

  it('accepts points on the image border', () => {
    expect(CameraCalibration.safeParse(withPoint(0, { x: 0, y: 0 })).success).toBe(true);
    expect(CameraCalibration.safeParse(withPoint(1, { x: 1920, y: 1080 })).success).toBe(true);
  });

  it.each([
    ['3 points', valid.points.slice(0, 3)],
    ['5 points', [...valid.points, { x: 10, y: 10 }]],
  ])('rejects %s', (_, points) => {
    expect(CameraCalibration.safeParse({ ...valid, points }).success).toBe(false);
  });

  it.each([
    ['a negative x', { x: -0.5, y: 100 }],
    ['a negative y', { x: 100, y: -1 }],
    ['x beyond the width', { x: 1920.5, y: 100 }],
    ['y beyond the height', { x: 100, y: 1081 }],
  ])('rejects %s with an error on points', (_, point) => {
    const result = CameraCalibration.safeParse(withPoint(2, point));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['points']);
  });

  it.each([
    ['a non-integer width', { imageWidth: 1920.5 }],
    ['a non-integer height', { imageHeight: 1080.5 }],
    ['a zero width', { imageWidth: 0 }],
    ['a zero height', { imageHeight: 0 }],
  ])('rejects %s', (_, size) => {
    expect(CameraCalibration.safeParse({ ...valid, ...size }).success).toBe(false);
  });

  it.each([
    ['NaN x', { x: Number.NaN, y: 100 }],
    ['NaN y', { x: 100, y: Number.NaN }],
    ['Infinity x', { x: Number.POSITIVE_INFINITY, y: 100 }],
    ['-Infinity y', { x: 100, y: Number.NEGATIVE_INFINITY }],
  ])('rejects %s', (_, point) => {
    expect(CameraCalibration.safeParse(withPoint(3, point)).success).toBe(false);
  });
});

describe('CameraId', () => {
  it.each(['camera-1', 'c', '0', 'usb-cam-2', 'a'.repeat(32)])('accepts %j', (id) => {
    expect(CameraId.safeParse(id).success).toBe(true);
  });

  it.each([
    ['an empty id', ''],
    ['uppercase', 'Camera-1'],
    ['a slash', 'camera/1'],
    ['a leading dash', '-camera'],
    ['a space', 'camera 1'],
    ['33 characters', 'a'.repeat(33)],
  ])('rejects %s', (_, id) => {
    expect(CameraId.safeParse(id).success).toBe(false);
  });

  it('accepts the default camera id', () => {
    expect(DEFAULT_CAMERA_ID).toBe('camera-1');
    expect(CameraId.parse(DEFAULT_CAMERA_ID)).toBe('camera-1');
  });
});
