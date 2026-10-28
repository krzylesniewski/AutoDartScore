import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readJpegFrame } from './jpeg-frame.js';

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
