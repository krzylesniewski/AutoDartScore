import { CameraCalibration, type ImagePoint } from '@autoscore/schema';
import { calibrationHomography } from '@autoscore/vision/geometry';

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

// Zawsze 4 pozycje w kolejności CALIBRATION_STEPS, null to punkt jeszcze nieustawiony.
export type CalibrationPoints = readonly (ImagePoint | null)[];

export const CALIBRATION_STEPS: readonly { readonly segments: readonly [number, number] }[] = [
  { segments: [5, 20] },
  { segments: [13, 6] },
  { segments: [17, 3] },
  { segments: [8, 11] },
];

export const EMPTY_POINTS: CalibrationPoints = CALIBRATION_STEPS.map(() => null);

export function placePoint(points: CalibrationPoints, index: number, point: ImagePoint): CalibrationPoints {
  return points.map((current, i) => (i === index ? point : current));
}

// Szuka od następnego po placedIndex, z zawinięciem, więc wcześniej pominięty punkt też wróci.
export function nextStep(points: CalibrationPoints, placedIndex: number): number | null {
  for (let offset = 1; offset <= points.length; offset += 1) {
    const index = (placedIndex + offset) % points.length;
    if (points[index] === null) {
      return index;
    }
  }
  return null;
}

// Schemat sprawdza tylko granice obrazu. Homografia odrzuca też trzy punkty na jednej prostej.
export function toCalibration(points: CalibrationPoints, size: ImageSize): CameraCalibration | null {
  const [p1, p2, p3, p4] = points;
  if (points.length !== 4 || !p1 || !p2 || !p3 || !p4) {
    return null;
  }
  const parsed = CameraCalibration.safeParse({ imageWidth: size.width, imageHeight: size.height, points: [p1, p2, p3, p4] });
  if (!parsed.success) {
    return null;
  }
  try {
    calibrationHomography(parsed.data);
  } catch {
    return null;
  }
  return parsed.data;
}
