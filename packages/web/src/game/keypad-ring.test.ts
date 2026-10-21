import { describe, expect, it } from 'vitest';
import { MIN_KEY_PX, RING_CENTER_HEIGHT_PERCENT, RING_CENTER_WIDTH_PERCENT, RING_KEY_PERCENT, ringKeyPosition } from './keypad-ring';

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const KEYS = Array.from({ length: 20 }, (_, index) => index);
const GAP_PX = 8;

function keySide(side: number): number {
  return Math.max(MIN_KEY_PX, (RING_KEY_PERCENT / 100) * side);
}

function keyCentre(side: number, index: number): { x: number; y: number } {
  const { left, top } = ringKeyPosition(index);
  return { x: (left / 100) * side, y: (top / 100) * side };
}

function keyRect(side: number, index: number): Rect {
  const { x, y } = keyCentre(side, index);
  const half = keySide(side) / 2;
  return { left: x - half, top: y - half, right: x + half, bottom: y + half };
}

// 25 i Bull obok siebie w środku koła, z odstępem między nimi.
function centreRects(side: number): Rect[] {
  const width = (RING_CENTER_WIDTH_PERCENT / 100) * side;
  const height = Math.max(MIN_KEY_PX, (RING_CENTER_HEIGHT_PERCENT / 100) * side);
  const left = (side - width) / 2;
  const top = (side - height) / 2;
  const keyWidth = (width - GAP_PX) / 2;
  return [
    { left, top, right: left + keyWidth, bottom: top + height },
    { left: left + keyWidth + GAP_PX, top, right: left + width, bottom: top + height },
  ];
}

function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe('ringKeyPosition', () => {
  it.each([
    [0, 50, 7],
    [5, 93, 50],
    [10, 50, 93],
    [15, 7, 50],
  ])('puts key %i at %f, %f', (index, left, top) => {
    const position = ringKeyPosition(index);
    expect(position.left).toBeCloseTo(left, 9);
    expect(position.top).toBeCloseTo(top, 9);
  });
});

// Przy kole mniejszym niż około 327 px sąsiednie klawisze 44 px nachodziłyby na siebie, dlatego koło ma co najmniej 330 px.
describe.each([330, 336, 351, 356, 366, 400, 450])('a ring of %i px', (side) => {
  it('has keys of at least 44 px', () => {
    expect(keySide(side)).toBeGreaterThanOrEqual(44);
  });

  it('keeps adjacent round keys apart', () => {
    for (const index of KEYS) {
      const a = keyCentre(side, index);
      const b = keyCentre(side, (index + 1) % KEYS.length);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(keySide(side));
    }
  });

  it('keeps every key inside the ring square', () => {
    for (const index of KEYS) {
      const rect = keyRect(side, index);
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(side);
      expect(rect.bottom).toBeLessThanOrEqual(side);
    }
  });

  it('keeps 25 and Bull clear of every number key square', () => {
    for (const centre of centreRects(side)) {
      for (const index of KEYS) {
        expect(intersects(centre, keyRect(side, index))).toBe(false);
      }
    }
  });
});
