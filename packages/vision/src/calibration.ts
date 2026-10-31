import type { CameraCalibration } from '@autoscore/schema';
import { BOARD_RADII } from './board.js';
import type { Point } from './board.js';
import { computeHomography } from './homography.js';
import type { Homography } from './homography.js';

// Punkty na tarczy w kolejności CameraCalibration: granice 5|20, 13|6, 17|3, 8|11
// na zewnętrznej krawędzi double. Kąt zgodnie z ruchem wskazówek zegara od góry.
export const CALIBRATION_BOARD_POINTS: readonly [Point, Point, Point, Point] = [
  outerDoublePoint(351),
  outerDoublePoint(81),
  outerDoublePoint(171),
  outerDoublePoint(261),
];

// Obraz → tarcza. Tarcza → obraz (siatka segmentów na obrazie) to invertHomography wyniku.
export function calibrationHomography(calibration: CameraCalibration): Homography {
  return computeHomography(calibration.points, CALIBRATION_BOARD_POINTS);
}

function outerDoublePoint(degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: BOARD_RADII.doubleOuter * Math.sin(radians), y: BOARD_RADII.doubleOuter * Math.cos(radians) };
}
