import type { CameraCalibration } from '@autoscore/schema';
import { applyHomography, BOARD_RADII, BOARD_SEGMENTS, calibrationHomography, invertHomography, type Point } from '@autoscore/vision/geometry';

export interface OverlayWire {
  readonly from: Point;
  readonly to: Point;
}

export interface OverlayLabel {
  readonly segment: number;
  readonly at: Point;
}

// Wszystko w pikselach obrazu. rings w kolejności BOARD_RADII, od Bull do zewnętrznej krawędzi double.
export interface BoardOverlay {
  readonly rings: readonly string[];
  readonly wires: readonly OverlayWire[];
  readonly labels: readonly OverlayLabel[];
}

const RING_STEP_DEGREES = 3;
const LABEL_RADIUS = 185;
const SEGMENT_ANGLE = 360 / BOARD_SEGMENTS.length;

// Kąt zgodnie z ruchem wskazówek zegara od góry, jak w board.ts.
function boardPoint(radius: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: radius * Math.sin(radians), y: radius * Math.cos(radians) };
}

function format(value: number): string {
  return String(Math.round(value * 100) / 100);
}

// null tylko wtedy, gdy homografia rzuci błąd: brak homografii albo punkt odwzorowany w nieskończoność (w = 0).
// Punktów za horyzontem kamery (w o przeciwnym znaku) nie sprawdzamy, więc punkty w złej kolejności mogą dać wynik z wywróconą siatką.
export function boardOverlay(calibration: CameraCalibration): BoardOverlay | null {
  try {
    const toImage = invertHomography(calibrationHomography(calibration));
    const map = (radius: number, degrees: number) => applyHomography(toImage, boardPoint(radius, degrees));
    const rings = Object.values(BOARD_RADII).map((radius) => {
      const commands: string[] = [];
      for (let degrees = 0; degrees < 360; degrees += RING_STEP_DEGREES) {
        const { x, y } = map(radius, degrees);
        commands.push(`${commands.length === 0 ? 'M' : 'L'}${format(x)} ${format(y)}`);
      }
      return `${commands.join(' ')} Z`;
    });
    // Homografia zachowuje proste, więc drut wyznaczają jego dwa końce.
    const wires = BOARD_SEGMENTS.map((_, k) => {
      const degrees = SEGMENT_ANGLE / 2 + SEGMENT_ANGLE * k;
      return { from: map(BOARD_RADII.outerBull, degrees), to: map(BOARD_RADII.doubleOuter, degrees) };
    });
    const labels = BOARD_SEGMENTS.map((segment, k) => ({ segment, at: map(LABEL_RADIUS, SEGMENT_ANGLE * k) }));
    return { rings, wires, labels };
  } catch {
    return null;
  }
}
