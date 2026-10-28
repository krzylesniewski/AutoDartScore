import type { CameraSource } from './camera-source.js';
import { captureOutput, FfmpegFrames } from './ffmpeg-frames.js';
import type { Frame } from './frame.js';

export interface VideoFileSourceOptions {
  readonly ffmpegPath?: string;
  readonly ffprobePath?: string;
}

interface VideoProbe {
  readonly width: number;
  readonly height: number;
  readonly ptsTimes: readonly number[];
}

// Klatki z nagrania tak szybko, jak ffmpeg je dekoduje, bez odtwarzania w czasie rzeczywistym.
export class VideoFileSource implements CameraSource {
  private readonly ffmpegPath: string;
  private readonly ffprobePath: string;
  private readonly abort = new AbortController();
  private started = false;
  private closed = false;
  private probing: Promise<unknown> = Promise.resolve();
  private runner: FfmpegFrames | null = null;

  constructor(
    private readonly path: string,
    options: VideoFileSourceOptions = {},
  ) {
    this.ffmpegPath = options.ffmpegPath ?? 'ffmpeg';
    this.ffprobePath = options.ffprobePath ?? 'ffprobe';
  }

  frames(): AsyncIterable<Frame> {
    if (this.started) {
      throw new Error('frames() can only be called once');
    }
    this.started = true;
    return this.generate();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.abort.abort();
    await this.probing.catch(() => undefined);
    await this.runner?.stop();
  }

  private async *generate(): AsyncGenerator<Frame> {
    if (this.closed) {
      return;
    }
    const probing = this.probe();
    this.probing = probing;
    let probe: VideoProbe;
    try {
      probe = await probing;
    } catch (error) {
      if (this.closed) {
        return;
      }
      throw error;
    }
    if (this.closed) {
      return;
    }
    const { width, height, ptsTimes } = probe;
    const runner = new FfmpegFrames({
      ffmpegPath: this.ffmpegPath,
      inputArgs: ['-i', this.path],
      width,
      height,
      startClock: () => (index) => {
        const pts = ptsTimes[index];
        if (pts === undefined) {
          throw new Error(`ffmpeg decoded more frames than ffprobe reported (${ptsTimes.length}) in ${this.path}`);
        }
        return pts * 1000;
      },
    });
    this.runner = runner;
    try {
      yield* runner.frames();
    } catch (error) {
      if (error instanceof Error && error.message.includes(this.path)) {
        throw error;
      }
      throw new Error(`Cannot read video ${this.path}: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  }

  private async probe(): Promise<VideoProbe> {
    const result = await captureOutput(
      'ffprobe',
      this.ffprobePath,
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height:frame=pts_time',
        '-of', 'json',
        this.path,
      ],
      this.abort.signal,
    );
    if (result.code !== 0) {
      throw new Error(`Cannot read video ${this.path}: ${result.stderr.trim()}`);
    }
    return parseProbe(this.path, result.stdout);
  }
}

function parseProbe(path: string, output: string): VideoProbe {
  const parsed = JSON.parse(output) as {
    streams?: { width?: unknown; height?: unknown }[];
    frames?: { pts_time?: unknown }[];
  };
  const stream = parsed.streams?.[0];
  const width = stream?.width;
  const height = stream?.height;
  if (!isPositiveInteger(width) || !isPositiveInteger(height)) {
    throw new Error(`No video stream in ${path}`);
  }
  const ptsTimes = (parsed.frames ?? []).map((frame) => {
    const value = frame.pts_time;
    const pts = typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    if (!Number.isFinite(pts)) {
      throw new Error(`Invalid frame pts_time in ${path}: ${String(value)}`);
    }
    return pts;
  });
  return { width, height, ptsTimes };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
