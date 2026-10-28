import { CameraCalibration } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { calibrationFileContent } from './calibration-file';

const calibration: CameraCalibration = {
  imageWidth: 1920,
  imageHeight: 1080,
  points: [
    { x: 960.5, y: 200.1 },
    { x: 1500, y: 540 },
    { x: 960, y: 900 },
    { x: 420, y: 540 },
  ],
};

describe('calibrationFileContent', () => {
  it('writes the calibration as indented JSON with a final newline', () => {
    const content = calibrationFileContent(calibration);
    expect(content.startsWith('{\n  "imageWidth": 1920,\n')).toBe(true);
    expect(content.endsWith('}\n')).toBe(true);
  });

  it('round-trips through CameraCalibration.parse', () => {
    expect(CameraCalibration.parse(JSON.parse(calibrationFileContent(calibration)))).toEqual(calibration);
  });
});
