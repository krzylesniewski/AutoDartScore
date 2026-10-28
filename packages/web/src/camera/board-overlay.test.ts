import type { CameraCalibration } from '@autoscore/schema';
import { CALIBRATION_BOARD_POINTS, type Point } from '@autoscore/vision/geometry';
import { describe, expect, it } from 'vitest';
import { boardOverlay } from './board-overlay';

// Obraz 1000×1000: tarcza powiększona 2 razy wokół (500, 500), y w dół.
function toImage({ x, y }: Point): Point {
  return { x: 500 + 2 * x, y: 500 - 2 * y };
}

const [p1, p2, p3, p4] = CALIBRATION_BOARD_POINTS.map(toImage);
const calibration: CameraCalibration = {
  imageWidth: 1000,
  imageHeight: 1000,
  points: [p1 as Point, p2 as Point, p3 as Point, p4 as Point],
};

function pathPoints(path: string): Point[] {
  return [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToClosedPath(p: Point, path: string): number {
  const points = pathPoints(path);
  return Math.min(...points.map((a, i) => distanceToSegment(p, a, points[(i + 1) % points.length] as Point)));
}

describe('boardOverlay', () => {
  const overlay = boardOverlay(calibration);

  it('draws 6 rings sampled every 3°, 20 wires and 20 labels', () => {
    expect(overlay?.rings).toHaveLength(6);
    for (const ring of overlay?.rings ?? []) {
      expect(pathPoints(ring)).toHaveLength(120);
      expect(ring.endsWith('Z')).toBe(true);
    }
    expect(overlay?.wires).toHaveLength(20);
    expect(overlay?.labels.map((label) => label.segment)).toEqual([20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]);
  });

  it('passes the outer double ring within 0.5 px of the 4 calibration points', () => {
    const outer = overlay?.rings[5] ?? '';
    for (const point of calibration.points) {
      expect(distanceToClosedPath(point, outer)).toBeLessThan(0.5);
    }
  });

  it('maps the rings as circles of twice the board radius', () => {
    const bull = pathPoints(overlay?.rings[0] ?? '');
    for (const point of bull) {
      expect(Math.hypot(point.x - 500, point.y - 500)).toBeCloseTo(12.7, 1);
    }
  });

  it('runs every wire from the outer bull to the outer double edge', () => {
    for (const wire of overlay?.wires ?? []) {
      expect(Math.hypot(wire.from.x - 500, wire.from.y - 500)).toBeCloseTo(31.8, 1);
      expect(Math.hypot(wire.to.x - 500, wire.to.y - 500)).toBeCloseTo(340, 1);
    }
    const first = overlay?.wires[0];
    expect(first?.to.x).toBeGreaterThan(500);
    expect(first?.to.y).toBeLessThan(500);
  });

  it('puts 20 above the center and 6 right of it', () => {
    const at = (segment: number) => overlay?.labels.find((label) => label.segment === segment)?.at;
    expect(at(20)?.y).toBeLessThan(500);
    expect(at(20)?.x).toBeCloseTo(500, 6);
    expect(at(6)?.x).toBeGreaterThan(500);
    expect(at(6)?.y).toBeCloseTo(500, 6);
    expect(at(3)?.y).toBeGreaterThan(500);
    expect(at(11)?.x).toBeLessThan(500);
  });

  it('gives null for 3 collinear points', () => {
    expect(boardOverlay({ ...calibration, points: [calibration.points[0], { x: 500, y: 500 }, calibration.points[2], calibration.points[3]] })).toBeNull();
  });
});
