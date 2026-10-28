import { BULL_SEGMENT, MISS_SEGMENT } from '@autoscore/schema';
import type { Hit } from '@autoscore/schema';

// Jeden typ punktu dla tarczy (mm) i obrazu (piksele).
export interface Point {
  readonly x: number;
  readonly y: number;
}

// Zgodnie z ruchem wskazówek zegara od góry. 20 jest wyśrodkowane na górze.
export const BOARD_SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;

// Promienie drutów w mm od środka (BDO/WDF).
export const BOARD_RADII = {
  bull: 6.35,
  outerBull: 15.9,
  trebleInner: 99,
  trebleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
} as const;

export interface BoardScore {
  readonly hit: Hit;
  // Odległość w mm do najbliższego drutu (okręgu albo drutu promieniowego).
  readonly wireDistance: number;
}

const SEGMENT_ANGLE = 360 / BOARD_SEGMENTS.length;
const RING_RADII = Object.values(BOARD_RADII);
const RADIAL_WIRE_DIRECTIONS: readonly Point[] = BOARD_SEGMENTS.map((_, k) =>
  polarUnit(SEGMENT_ANGLE / 2 + SEGMENT_ANGLE * k),
);

// Współrzędne tarczy: mm, środek w (0, 0), x w prawo, y w górę.
export function scorePoint(point: Point): BoardScore {
  const { x, y } = point;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Board point must be finite, got (${x}, ${y})`);
  }
  const r = Math.hypot(x, y);
  return { hit: hitAt(r, segmentAt(x, y)), wireDistance: wireDistance(point, r) };
}

function hitAt(r: number, segment: number): Hit {
  if (r <= BOARD_RADII.bull) {
    return { segment: BULL_SEGMENT, multiplier: 2 };
  }
  if (r <= BOARD_RADII.outerBull) {
    return { segment: BULL_SEGMENT, multiplier: 1 };
  }
  if (r < BOARD_RADII.trebleInner) {
    return { segment, multiplier: 1 };
  }
  if (r <= BOARD_RADII.trebleOuter) {
    return { segment, multiplier: 3 };
  }
  if (r < BOARD_RADII.doubleInner) {
    return { segment, multiplier: 1 };
  }
  if (r <= BOARD_RADII.doubleOuter) {
    return { segment, multiplier: 2 };
  }
  return { segment: MISS_SEGMENT, multiplier: 0 };
}

// Punkt dokładnie na drucie promieniowym należy do segmentu zgodnie z ruchem wskazówek zegara.
// Jego wireDistance to 0, więc wybór strony nie ma znaczenia dla weryfikacji.
function segmentAt(x: number, y: number): number {
  const theta = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  const index = Math.floor(((theta + SEGMENT_ANGLE / 2) % 360) / SEGMENT_ANGLE);
  const segment = BOARD_SEGMENTS[index % BOARD_SEGMENTS.length];
  if (segment === undefined) {
    throw new Error(`No segment at angle ${theta}`);
  }
  return segment;
}

// Druty promieniowe biegną od Outer Bull do zewnętrznej krawędzi double, więc punkt w środku
// albo poza tarczą mierzy się do ich końców, a nie do prostej.
function wireDistance(point: Point, r: number): number {
  let nearest = Infinity;
  for (const radius of RING_RADII) {
    nearest = Math.min(nearest, Math.abs(r - radius));
  }
  for (const direction of RADIAL_WIRE_DIRECTIONS) {
    const along = Math.min(
      Math.max(point.x * direction.x + point.y * direction.y, BOARD_RADII.outerBull),
      BOARD_RADII.doubleOuter,
    );
    nearest = Math.min(nearest, Math.hypot(point.x - along * direction.x, point.y - along * direction.y));
  }
  return nearest;
}

// Kąt w stopniach zgodnie z ruchem wskazówek zegara od +y.
function polarUnit(degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: Math.sin(radians), y: Math.cos(radians) };
}
