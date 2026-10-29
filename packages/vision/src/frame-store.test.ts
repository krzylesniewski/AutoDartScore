import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ReviewFrames } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Frame } from './frame.js';
import { saveDartFrames } from './frame-store.js';

const eventId = '6f1c1b7e-3c1a-4c7e-9a52-0d0f5a1d2b3c';

function frame(gray: number): Frame {
  return { width: 32, height: 18, data: new Uint8Array(32 * 18 * 3).fill(gray), timestamp: 0 };
}

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'autoscore-frames-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('saveDartFrames', () => {
  it('creates the missing directories and writes two JPEGs', async () => {
    const framesDir = path.join(root, 'nested', 'frames');
    const frames = await saveDartFrames({ framesDir, matchId: 'm_1', eventId, before: frame(40), after: frame(200) });
    expect(frames).toEqual({ before: `m_1/${eventId}-before.jpg`, after: `m_1/${eventId}-after.jpg` });
    expect(ReviewFrames.safeParse(frames).success).toBe(true);
    expect((await readdir(path.join(framesDir, 'm_1'))).sort()).toEqual([`${eventId}-after.jpg`, `${eventId}-before.jpg`]);
    for (const file of [frames.before, frames.after]) {
      const jpeg = await readFile(path.join(framesDir, file));
      expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    }
  });

  it('keeps the frames of other darts in the same game', async () => {
    const other = '0b9a3f2e-1d4c-4e5f-8a6b-7c8d9e0f1a2b';
    await saveDartFrames({ framesDir: root, matchId: 'm_1', eventId: other, before: frame(40), after: frame(200) });
    await saveDartFrames({ framesDir: root, matchId: 'm_1', eventId, before: frame(40), after: frame(200) });
    expect(await readdir(path.join(root, 'm_1'))).toHaveLength(4);
  });

  it('refuses a match id that leaves the frames directory', async () => {
    await expect(saveDartFrames({ framesDir: root, matchId: '..', eventId, before: frame(40), after: frame(200) })).rejects.toThrow();
    expect(await readdir(root)).toEqual([]);
  });
});
