import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decode } from 'jpeg-js';
import type { Frame } from './frame.js';
import { encodeJpegFrame, readJpegFrame } from './jpeg-frame.js';

const fixture = resolve(import.meta.dirname, '../../../fixtures/session-01/02-before.jpg');

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('readJpegFrame', () => {
  it('decodes a fixture to an RGB24 frame', async () => {
    const frame = await readJpegFrame(fixture);
    expect(frame.width).toBe(1920);
    expect(frame.height).toBe(1080);
    expect(frame.data).toBeInstanceOf(Uint8Array);
    expect(frame.data.length).toBe(6220800);
    expect(frame.timestamp).toBe(0);
  });

  it('keeps the given timestamp', async () => {
    expect((await readJpegFrame(fixture, 5423)).timestamp).toBe(5423);
  });

  it('rejects a file that is not a JPEG with its path', async () => {
    const file = join(dir, 'not-a-jpeg.jpg');
    await writeFile(file, 'not a jpeg');
    await expect(readJpegFrame(file)).rejects.toThrow(file);
  });

  it('rejects a missing file with its path', async () => {
    const file = join(dir, 'missing.jpg');
    await expect(readJpegFrame(file)).rejects.toThrow(file);
  });
});

describe('encodeJpegFrame', () => {
  function gradient(width: number, height: number): Frame {
    const data = new Uint8Array(width * height * 3);
    for (let i = 0; i < width * height; i += 1) {
      data[i * 3] = (i * 7) % 256;
      data[i * 3 + 1] = 128;
      data[i * 3 + 2] = 255 - ((i * 7) % 256);
    }
    return { width, height, data, timestamp: 0 };
  }

  it('encodes an RGB24 frame to a JPEG of the same size', () => {
    const jpeg = encodeJpegFrame(gradient(64, 48));
    expect([...jpeg.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    const decoded = decode(jpeg, { useTArray: true, formatAsRGBA: false });
    expect(decoded.width).toBe(64);
    expect(decoded.height).toBe(48);
    expect(decoded.data[1]).toBeGreaterThan(110);
    expect(decoded.data[1]).toBeLessThan(146);
  });

  it('round-trips a fixture through readJpegFrame', async () => {
    const frame = await readJpegFrame(fixture);
    const file = join(dir, 'round-trip.jpg');
    await writeFile(file, encodeJpegFrame(frame, 75));
    const decoded = await readJpegFrame(file);
    expect([decoded.width, decoded.height]).toEqual([1920, 1080]);
  });

  it('gives a smaller file for a lower quality', () => {
    const frame = gradient(64, 48);
    expect(encodeJpegFrame(frame, 30).length).toBeLessThan(encodeJpegFrame(frame, 95).length);
  });

  it('rejects a frame whose data does not match its size', () => {
    expect(() => encodeJpegFrame({ width: 4, height: 4, data: new Uint8Array(10), timestamp: 0 })).toThrow('expected RGB24');
  });
});
