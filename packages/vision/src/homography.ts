import type { Point } from './board.js';

// Macierz 3×3 wierszami. Skala jest dowolna, liczy się tylko odwzorowanie punktów.
export type Homography = readonly [number, number, number, number, number, number, number, number, number];

type Quad = readonly [Point, Point, Point, Point];

const COLLINEAR_TOLERANCE = 1e-9;
const SINGULAR_TOLERANCE = 1e-12;

// DLT na czterech parach z h33 = 1.
export function computeHomography(from: Quad, to: Quad): Homography {
  assertNonDegenerate(from, 'source');
  assertNonDegenerate(to, 'destination');
  // Normalizacja Hartleya: piksele rzędu 1920 obok jedynek dają źle uwarunkowany układ.
  const fromNorm = normalization(from);
  const toNorm = normalization(to);
  const rows: number[][] = [];
  for (let i = 0; i < 4; i += 1) {
    const p = normalize(fromNorm, pointAt(from, i));
    const q = normalize(toNorm, pointAt(to, i));
    rows.push([p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y, q.x]);
    rows.push([0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y, q.y]);
  }
  const normalized = toHomography([...solve(rows), 1]);
  return multiply(denormalizationMatrix(toNorm), multiply(normalized, normalizationMatrix(fromNorm)));
}

export function applyHomography(h: Homography, point: Point): Point {
  const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = h;
  const { x, y } = point;
  const w = h31 * x + h32 * y + h33;
  if (Math.abs(w) <= SINGULAR_TOLERANCE * (Math.abs(h31 * x) + Math.abs(h32 * y) + Math.abs(h33))) {
    throw new Error(`Point (${x}, ${y}) maps to infinity`);
  }
  return { x: (h11 * x + h12 * y + h13) / w, y: (h21 * x + h22 * y + h23) / w };
}

export function invertHomography(h: Homography): Homography {
  const [a, b, c, d, e, f, g, i, j] = h;
  const adjugate: Homography = [
    e * j - f * i,
    c * i - b * j,
    b * f - c * e,
    f * g - d * j,
    a * j - c * g,
    c * d - a * f,
    d * i - e * g,
    b * g - a * i,
    a * e - b * d,
  ];
  const determinant = a * adjugate[0] + b * adjugate[3] + c * adjugate[6];
  const scale = Math.max(...h.map(Math.abs));
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= SINGULAR_TOLERANCE * scale ** 3) {
    throw new Error('Homography is singular and cannot be inverted');
  }
  return toHomography(adjugate.map((value) => value / determinant));
}

interface Normalization {
  readonly cx: number;
  readonly cy: number;
  readonly s: number;
}

function pointAt(points: Quad, index: number): Point {
  const point = points[index];
  if (point === undefined) {
    throw new Error(`Missing point ${index}`);
  }
  return point;
}

// Każde trzy z czterech punktów muszą tworzyć trójkąt, inaczej homografia nie jest wyznaczona.
// Próg pola jest względny do rozrzutu punktów, więc działa tak samo dla mm i pikseli.
function assertNonDegenerate(points: Quad, label: string): void {
  for (const { x, y } of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Homography ${label} points must be finite, got (${x}, ${y})`);
    }
  }
  const cx = points.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / 4;
  const spread = Math.max(...points.map((p) => (p.x - cx) ** 2 + (p.y - cy) ** 2));
  for (let skip = 0; skip < 4; skip += 1) {
    const [p, q, r] = points.filter((_, i) => i !== skip);
    if (p === undefined || q === undefined || r === undefined) {
      throw new Error(`Missing ${label} point`);
    }
    const doubleArea = Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    if (doubleArea <= COLLINEAR_TOLERANCE * spread) {
      throw new Error(`Homography ${label} points must not have three collinear or duplicated points`);
    }
  }
}

function normalization(points: Quad): Normalization {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / 4;
  const meanDistance = points.reduce((sum, p) => sum + Math.hypot(p.x - cx, p.y - cy), 0) / 4;
  return { cx, cy, s: Math.SQRT2 / meanDistance };
}

function normalize({ cx, cy, s }: Normalization, point: Point): Point {
  return { x: s * (point.x - cx), y: s * (point.y - cy) };
}

function normalizationMatrix({ cx, cy, s }: Normalization): Homography {
  return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1];
}

function denormalizationMatrix({ cx, cy, s }: Normalization): Homography {
  return [1 / s, 0, cx, 0, 1 / s, cy, 0, 0, 1];
}

function multiply(left: Homography, right: Homography): Homography {
  const result: number[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      let sum = 0;
      for (let k = 0; k < 3; k += 1) {
        sum += (left[row * 3 + k] ?? 0) * (right[k * 3 + col] ?? 0);
      }
      result.push(sum);
    }
  }
  return toHomography(result);
}

function toHomography(values: readonly number[]): Homography {
  const [a, b, c, d, e, f, g, h, i] = values;
  if (
    values.length !== 9 ||
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined ||
    e === undefined ||
    f === undefined ||
    g === undefined ||
    h === undefined ||
    i === undefined
  ) {
    throw new Error(`Homography needs 9 entries, got ${values.length}`);
  }
  return [a, b, c, d, e, f, g, h, i];
}

// Eliminacja Gaussa z częściowym wyborem elementu głównego na macierzy rozszerzonej n×(n+1).
function solve(augmented: number[][]): number[] {
  const n = augmented.length;
  const rows = augmented.map((row) => [...row]);
  const scale = Math.max(...rows.flatMap((row) => row.slice(0, n).map(Math.abs)));
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(entry(rows, row, col)) > Math.abs(entry(rows, pivot, col))) {
        pivot = row;
      }
    }
    if (Math.abs(entry(rows, pivot, col)) <= SINGULAR_TOLERANCE * scale) {
      throw new Error('Homography system is singular');
    }
    [rows[col], rows[pivot]] = [rowAt(rows, pivot), rowAt(rows, col)];
    const pivotRow = rowAt(rows, col);
    const pivotValue = entry(rows, col, col);
    for (let row = col + 1; row < n; row += 1) {
      const current = rowAt(rows, row);
      const factor = entry(rows, row, col) / pivotValue;
      for (let k = col; k <= n; k += 1) {
        current[k] = (current[k] ?? 0) - factor * (pivotRow[k] ?? 0);
      }
    }
  }
  const solution = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = entry(rows, row, n);
    for (let k = row + 1; k < n; k += 1) {
      sum -= entry(rows, row, k) * (solution[k] ?? 0);
    }
    solution[row] = sum / entry(rows, row, row);
  }
  return solution;
}

function rowAt(rows: number[][], index: number): number[] {
  const row = rows[index];
  if (row === undefined) {
    throw new Error(`Missing row ${index}`);
  }
  return row;
}

function entry(rows: number[][], row: number, col: number): number {
  return rowAt(rows, row)[col] ?? 0;
}
