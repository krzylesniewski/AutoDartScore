import { describe, expect, it } from 'vitest';
import { createDartWatcher, type WatchEvent } from './dart-watcher.js';
import type { Frame } from './frame.js';

const WIDTH = 320;
const HEIGHT = 180;

// Szara tarcza i ciemne bloki 40×40, czyli po kilka komórek 20×20 analizy.
function frame(timestamp: number, blocks: readonly (readonly [number, number])[] = [], gray = 128): Frame {
  const data = new Uint8Array(WIDTH * HEIGHT * 3).fill(gray);
  for (const [bx, by] of blocks) {
    for (let y = by; y < by + 40; y++) {
      data.fill(0, (y * WIDTH + bx) * 3, (y * WIDTH + bx + 40) * 3);
    }
  }
  return { width: WIDTH, height: HEIGHT, data, timestamp };
}

function pushAll(frames: readonly Frame[], removalMs?: number): (WatchEvent | null)[] {
  const watcher = createDartWatcher(removalMs === undefined ? {} : { removalMs });
  return frames.map((f) => watcher.push(f));
}

describe('createDartWatcher', () => {
  it('takes the first frame as the reference', () => {
    expect(pushAll([frame(0)])).toEqual([null]);
  });

  it('emits settled with the last still frame before the motion and the first still frame after it', () => {
    const empty = frame(200);
    const moving = frame(400, [[40, 40]]);
    const settled = frame(600, [[40, 40]]);
    const events = pushAll([frame(0), empty, moving, settled, frame(800, [[40, 40]])]);
    expect(events.slice(0, 3)).toEqual([null, null, null]);
    expect(events[3]).toEqual({ kind: 'settled', before: empty, after: settled, motionMs: 200 });
    expect(events[4]).toBeNull();
  });

  it('refreshes the reference on still frames, so slow drift does not count', () => {
    // Każdy krok to 1 poziom jasności, poniżej progu piksela, a suma 40 poziomów już by go przekroczyła.
    const drift = Array.from({ length: 41 }, (_, i) => frame(i * 200, [], 100 + i));
    const last = drift.at(-1) as Frame;
    const dart = frame(41 * 200, [[40, 40]], 140);
    const after = frame(42 * 200, [[40, 40]], 140);
    const events = pushAll([...drift, dart, after]);
    expect(events.slice(0, 42).every((event) => event === null)).toBe(true);
    expect(events[42]).toEqual({ kind: 'settled', before: last, after, motionMs: 200 });
  });

  it('extends motion over consecutive changing frames', () => {
    const reference = frame(0);
    const after = frame(800, [[120, 40]]);
    const events = pushAll([reference, frame(200, [[40, 40]]), frame(400, [[80, 40]]), frame(600, [[120, 40]]), after]);
    expect(events.at(-1)).toEqual({ kind: 'settled', before: reference, after, motionMs: 600 });
  });

  it('emits removal for motion of 1500 ms or more and takes the next still frame as the reference', () => {
    const moving = Array.from({ length: 8 }, (_, i) => frame(200 + i * 200, [[(i % 2) * 80, 40]]));
    const empty = frame(1800);
    const empty2 = frame(2000);
    const dart = frame(2200, [[200, 100]]);
    const settled = frame(2400, [[200, 100]]);
    const events = pushAll([frame(0, [[40, 40]]), ...moving, empty, empty2, dart, settled]);
    expect(events.slice(0, 10).every((event) => event === null)).toBe(true);
    expect(events[10]).toEqual({ kind: 'removal', motionMs: 1800 });
    expect(events.at(-1)).toEqual({ kind: 'settled', before: empty2, after: settled, motionMs: 200 });
  });

  it('treats exactly removalMs as removal and just below it as settled', () => {
    const start = frame(0);
    const removal = pushAll([start, frame(100, [[40, 40]]), frame(1600, [[40, 40]])]);
    expect(removal.at(-1)).toEqual({ kind: 'removal', motionMs: 1500 });
    const settled = pushAll([start, frame(100, [[40, 40]]), frame(1599, [[40, 40]])]);
    expect(settled.at(-1)).toMatchObject({ kind: 'settled', motionMs: 1499 });
  });

  it('uses the injected removalMs', () => {
    const events = pushAll([frame(0), frame(200, [[40, 40]]), frame(400, [[40, 40]])], 200);
    expect(events.at(-1)).toEqual({ kind: 'removal', motionMs: 200 });
  });

  it('emits nothing when the source ends mid-motion', () => {
    const events = pushAll([frame(0), frame(200), frame(400, [[40, 40]]), frame(600, [[80, 40]]), frame(800, [[120, 40]])]);
    expect(events.every((event) => event === null)).toBe(true);
  });

  it('uses the injected isStill', () => {
    const watcher = createDartWatcher({ isStill: (a, b) => a.data[0] === b.data[0] });
    const before = frame(0, [], 10);
    const after = frame(400, [], 20);
    expect([watcher.push(before), watcher.push(frame(200, [], 20)), watcher.push(after)]).toEqual([
      null,
      null,
      { kind: 'settled', before, after, motionMs: 200 },
    ]);
  });
});
