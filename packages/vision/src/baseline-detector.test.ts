import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baselineDetector, measureChange } from './baseline-detector.js';
import type { Detection } from './detector.js';
import { loadEventFrames, loadFixtureSession } from './fixtures.js';
import { FRAME_BYTES_PER_PIXEL, type Frame } from './frame.js';

const SESSION_01 = resolve(import.meta.dirname, '../../../fixtures/session-01');

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function grayFrame(value: number, rects: readonly Rect[] = [], width = 320, height = 180): Frame {
  const data = new Uint8Array(width * height * FRAME_BYTES_PER_PIXEL).fill(value);
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      data.fill(0, (y * width + rect.x) * FRAME_BYTES_PER_PIXEL, (y * width + rect.x + rect.width) * FRAME_BYTES_PER_PIXEL);
    }
  }
  return { width, height, data, timestamp: 0 };
}

function cells(count: number): Rect[] {
  return Array.from({ length: count }, (_, i) => ({ x: (i % 16) * 20, y: Math.floor(i / 16) * 20, width: 20, height: 20 }));
}

async function detect(before: Frame, after: Frame): Promise<Detection> {
  return baselineDetector.detect({ before, after, calibration: null });
}

describe('measureChange', () => {
  it('measures a dark block covering two cells', () => {
    const change = measureChange(grayFrame(128), grayFrame(128, [{ x: 40, y: 60, width: 40, height: 20 }]));
    expect(change).toEqual({ changedFraction: 800 / 57600, activeCells: 2, spread: 2 / 144 });
  });

  it('averages source blocks when downscaling a 1920×1080 frame', () => {
    const before = grayFrame(128, [], 1920, 1080);
    const after = grayFrame(128, [{ x: 240, y: 360, width: 240, height: 120 }], 1920, 1080);
    expect(measureChange(before, after)).toEqual({ changedFraction: 800 / 57600, activeCells: 2, spread: 2 / 144 });
  });

  it('rejects frames of different sizes', () => {
    expect(() => measureChange(grayFrame(128), grayFrame(128, [], 640, 360))).toThrow('Frame sizes differ');
  });

  it('rejects a frame smaller than 320×180', () => {
    expect(() => measureChange(grayFrame(128, [], 319, 180), grayFrame(128, [], 319, 180))).toThrow(
      'smaller than 320x180',
    );
  });
});

describe('baselineDetector', () => {
  it('returns none for identical frames', async () => {
    expect(await detect(grayFrame(128), grayFrame(128))).toEqual({ kind: 'none' });
  });

  it('returns a pending dart for a dark block covering two cells', async () => {
    const after = grayFrame(128, [{ x: 40, y: 60, width: 40, height: 20 }]);
    expect(await detect(grayFrame(128), after)).toEqual({ kind: 'dart', hit: null, confidence: 0, candidates: [] });
  });

  it('returns none for a whole-frame brightness shift', async () => {
    expect(measureChange(grayFrame(100), grayFrame(160)).spread).toBe(1);
    expect(await detect(grayFrame(100), grayFrame(160))).toEqual({ kind: 'none' });
  });

  it('returns none for a small change spread over many cells', async () => {
    // 21 pikseli na kratkę to ponad 5%, a całość zostaje poniżej progu 0.03.
    const rects = cells(20).map(({ x, y }) => ({ x, y, width: 7, height: 3 }));
    const change = measureChange(grayFrame(128), grayFrame(128, rects));
    expect(change.changedFraction).toBeLessThan(0.03);
    expect(change.spread).toBeGreaterThan(0.12);
    expect(await detect(grayFrame(128), grayFrame(128, rects))).toEqual({ kind: 'none' });
  });

  it('returns none for five fully changed cells, above the large change limit', async () => {
    const change = measureChange(grayFrame(128), grayFrame(128, cells(5)));
    expect(change.changedFraction).toBeGreaterThan(0.03);
    expect(change.spread).toBeLessThan(0.12);
    expect(await detect(grayFrame(128), grayFrame(128, cells(5)))).toEqual({ kind: 'none' });
  });

  it('returns none for one fully changed cell as noise', async () => {
    const change = measureChange(grayFrame(128), grayFrame(128, cells(1)));
    expect(change).toEqual({ changedFraction: 400 / 57600, activeCells: 1, spread: 1 / 144 });
    expect(await detect(grayFrame(128), grayFrame(128, cells(1)))).toEqual({ kind: 'none' });
  });

  it('rejects frames of different sizes', async () => {
    await expect(detect(grayFrame(128), grayFrame(128, [], 640, 360))).rejects.toThrow('Frame sizes differ');
  });

  it('rejects frames smaller than 320×180', async () => {
    await expect(detect(grayFrame(128, [], 320, 179), grayFrame(128, [], 320, 179))).rejects.toThrow(
      'smaller than 320x180',
    );
  });

  it(
    'keeps the detected kind of every session-01 event',
    async () => {
      // 05 i 09 to naprawdę removal, a 14 to dryf światła. Baseline widzi je jako lotkę.
      const darts = ['02', '03', '04', '05', '06', '07', '08', '09', '12', '13', '14', '15'];
      const session = await loadFixtureSession(SESSION_01);
      const detected: Record<string, string> = {};
      for (const event of session.events) {
        const { before, after } = await loadEventFrames(event);
        const detection = await baselineDetector.detect({ before, after, calibration: null });
        if (detection.kind === 'dart') {
          expect(detection.hit).toBeNull();
        }
        detected[event.id] = detection.kind;
      }
      expect(detected).toEqual(
        Object.fromEntries(session.events.map(({ id }) => [id, darts.includes(id) ? 'dart' : 'none'])),
      );
      expect(Object.keys(detected)).toHaveLength(21);
    },
    60_000,
  );
});
