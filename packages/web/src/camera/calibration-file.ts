import type { CameraCalibration } from '@autoscore/schema';

// Format calibration.json w fixtures/<sesja>/: obiekt CameraCalibration bez zmian.
export function calibrationFileContent(calibration: CameraCalibration): string {
  return `${JSON.stringify(calibration, null, 2)}\n`;
}
