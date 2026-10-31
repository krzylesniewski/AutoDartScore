import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Frame } from './frame.js';
import { VideoFileSource } from './video-file-source.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

let dir: string;
let shortClip: string;
let longClip: string;

async function makeClip(file: string, seconds: number): Promise<void> {
  // Brak ffmpeg ma wywrócić testy, a nie je pominąć, żeby CI bez ffmpeg nie przechodziło po cichu.
  await promisify(execFile)('ffmpeg', [
    '-hide_banner', '-v', 'error',
    '-f', 'lavfi', '-i', `testsrc=size=64x48:rate=5`,
    '-t', String(seconds),
    '-c:v', 'mpeg4', '-pix_fmt', 'yuv420p',
    file,
  ]);
}

function lastFfmpegChild(): ChildProcess {
  const children = vi
    .mocked(spawn)
    .mock.results.map((result) => result.value as ChildProcess)
    .filter((child) => child.spawnargs.includes('rawvideo'));
  const child = children.at(-1);
  if (child === undefined) {
    throw new Error('ffmpeg was not spawned');
  }
  return child;
}

function firstFrame(source: VideoFileSource): Promise<IteratorResult<Frame>> {
  return source.frames()[Symbol.asyncIterator]().next();
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
  shortClip = join(dir, 'short.mp4');
  longClip = join(dir, 'long.mp4');
  await makeClip(shortClip, 2);
  await makeClip(longClip, 60);
}, 60_000);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('VideoFileSource', () => {
  it('reads every frame with its pts as the timestamp', async () => {
    const frames: Frame[] = [];
    for await (const frame of new VideoFileSource(shortClip).frames()) {
      frames.push(frame);
    }
    expect(frames).toHaveLength(10);
    frames.forEach((frame, index) => {
      expect(frame.width).toBe(64);
      expect(frame.height).toBe(48);
      expect(frame.data.length).toBe(9216);
      expect(Math.abs(frame.timestamp - index * 200)).toBeLessThan(1);
    });
    expect(new Set(frames.map((frame) => frame.data.buffer)).size).toBe(10);
  });

  it('stops ffmpeg blocked on a full pipe when closed', async () => {
    const source = new VideoFileSource(longClip);
    let count = 0;
    let closeMs = Infinity;
    const loop = (async () => {
      for await (const frame of source.frames()) {
        expect(frame.data.length).toBe(9216);
        count += 1;
        if (count === 2) {
          // Czekamy, aż ffmpeg zapełni potok i zablokuje się na zapisie.
          await new Promise((resolve) => setTimeout(resolve, 300));
          const start = performance.now();
          await source.close();
          closeMs = performance.now() - start;
        }
      }
    })();
    await expect(loop).resolves.toBeUndefined();
    expect(count).toBe(2);
    // SIGKILL przychodzi po 2 s, więc szybsze zamknięcie oznacza, że wystarczył SIGTERM.
    expect(closeMs).toBeLessThan(1900);
    expect(hasExited(lastFfmpegChild())).toBe(true);
  });

  it('stops ffmpeg when close() is called while the loop waits for a frame', async () => {
    const source = new VideoFileSource(longClip);
    const iterator = source.frames()[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.next();
    const pending = iterator.next();
    await source.close();
    const child = lastFfmpegChild();
    expect(hasExited(child)).toBe(true);
    const result = await pending;
    // Klatka mogła już czekać w buforze, ale potem iteracja kończy się bez błędu.
    if (!result.done) {
      await expect(iterator.next()).resolves.toEqual({ done: true, value: undefined });
    }
  });

  it('stops ffmpeg on break', async () => {
    let count = 0;
    for await (const frame of new VideoFileSource(longClip).frames()) {
      expect(frame.data.length).toBe(9216);
      count += 1;
      if (count === 2) {
        break;
      }
    }
    expect(count).toBe(2);
    expect(hasExited(lastFfmpegChild())).toBe(true);
  });

  it('yields nothing when closed before iteration', async () => {
    const source = new VideoFileSource(shortClip);
    await source.close();
    const frames: Frame[] = [];
    for await (const frame of source.frames()) {
      frames.push(frame);
    }
    expect(frames).toEqual([]);
  });

  it('throws on a second frames() call', () => {
    const source = new VideoFileSource(shortClip);
    source.frames();
    expect(() => source.frames()).toThrow(Error);
  });

  it('rejects a missing file with its path', async () => {
    const missing = join(dir, 'missing.mp4');
    await expect(firstFrame(new VideoFileSource(missing))).rejects.toThrow(missing);
  });

  it('rejects a missing ffprobe binary', async () => {
    const source = new VideoFileSource(shortClip, { ffprobePath: join(dir, 'no-ffprobe') });
    await expect(firstFrame(source)).rejects.toThrow('ffprobe not found on PATH');
  });

  it('rejects a missing ffmpeg binary', async () => {
    const source = new VideoFileSource(shortClip, { ffmpegPath: join(dir, 'no-ffmpeg') });
    await expect(firstFrame(source)).rejects.toThrow('ffmpeg not found on PATH');
  });
});
