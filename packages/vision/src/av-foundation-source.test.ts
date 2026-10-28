import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avFoundationArgs, AvFoundationSource } from './av-foundation-source.js';

let dir: string;
let fakeFfmpeg: string;

// Zamiast kamery: skrypt Node udający ffmpeg z -f rawvideo.
async function writeFake(name: string, body: string): Promise<string> {
  const file = join(dir, name);
  await writeFile(file, `#!/usr/bin/env node\n${body}\n`);
  await chmod(file, 0o755);
  return file;
}

async function collect(source: AvFoundationSource): Promise<number> {
  let count = 0;
  for await (const frame of source.frames()) {
    expect(frame.data.length).toBe(6220800);
    count += 1;
  }
  return count;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
  fakeFfmpeg = await writeFake('two-frames.mjs', 'process.stdout.write(Buffer.alloc(1920 * 1080 * 3 * 2));');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('avFoundationArgs', () => {
  it('builds the known-good argv with the camera name as one element', () => {
    expect(avFoundationArgs('HD Pro Webcam C920:none')).toEqual([
      '-hide_banner', '-v', 'error',
      '-f', 'avfoundation',
      '-framerate', '30.000030',
      '-video_size', '1920x1080',
      '-pixel_format', 'uyvy422',
      '-i', 'HD Pro Webcam C920:none',
      '-fps_mode', 'passthrough',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgb24',
      '-',
    ]);
  });

  it('passes a name with spaces and quotes unchanged', () => {
    const args = avFoundationArgs(`Cam "1" && echo x:none`);
    expect(args[args.indexOf('-i') + 1]).toBe(`Cam "1" && echo x:none`);
  });
});

describe('AvFoundationSource', () => {
  it('stamps frames with the time since ffmpeg was spawned', async () => {
    const times = [1000, 1250, 1600];
    const source = new AvFoundationSource('HD Pro Webcam C920:none', {
      ffmpegPath: fakeFfmpeg,
      now: () => times.shift() ?? Number.NaN,
    });
    const timestamps: number[] = [];
    for await (const frame of source.frames()) {
      expect(frame.width).toBe(1920);
      expect(frame.height).toBe(1080);
      expect(frame.data.length).toBe(6220800);
      timestamps.push(frame.timestamp);
    }
    expect(timestamps).toEqual([250, 600]);
  });

  it('throws on a second frames() call', () => {
    const source = new AvFoundationSource('HD Pro Webcam C920:none', { ffmpegPath: fakeFfmpeg });
    source.frames();
    expect(() => source.frames()).toThrow(Error);
  });

  it('rejects output that ends mid-frame', async () => {
    const ffmpegPath = await writeFake('half-frame.mjs', 'process.stdout.write(Buffer.alloc(1920 * 1080 * 3 * 1.5));');
    await expect(collect(new AvFoundationSource('Cam:none', { ffmpegPath }))).rejects.toThrow('truncated');
  });

  it('rejects a non-zero exit with the end of stderr', async () => {
    const ffmpegPath = await writeFake(
      'fails.mjs',
      'process.stderr.write("Selected framerate is not supported");\nprocess.exitCode = 1;',
    );
    await expect(collect(new AvFoundationSource('Cam:none', { ffmpegPath }))).rejects.toThrow(
      /code 1: Selected framerate is not supported/,
    );
  });
});
