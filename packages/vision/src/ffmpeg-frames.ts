import { spawn, type ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';
import { FRAME_BYTES_PER_PIXEL, type Frame } from './frame.js';

const KILL_AFTER_MS = 2000;
const STDERR_TAIL_BYTES = 2048;

export interface FfmpegFramesOptions {
  readonly ffmpegPath: string;
  readonly inputArgs: readonly string[];
  readonly width: number;
  readonly height: number;
  // Wywoływane tuż po uruchomieniu ffmpeg, zwraca znacznik czasu klatki o danym numerze.
  readonly startClock: () => (index: number) => number;
}

export function ffmpegArgs(inputArgs: readonly string[]): string[] {
  // Bez -fps_mode passthrough muxer rawvideo trzyma stałą liczbę klatek na sekundę
  // i powielałby około 5 kl./s z kamery do 30 kl./s.
  return ['-hide_banner', '-v', 'error', ...inputArgs, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'];
}

export function notFoundError(label: string, command: string): Error {
  return new Error(`${label} not found on PATH: ${command}`);
}

// Uruchamia ffmpeg raz i tnie stdout na klatki RGB24 o znanym rozmiarze.
export class FfmpegFrames {
  private process: ChildProcess | null = null;
  private exited: Promise<void> = Promise.resolve();
  private stopRequested = false;
  private stopping: Promise<void> | null = null;

  constructor(private readonly options: FfmpegFramesOptions) {}

  get child(): ChildProcess | null {
    return this.process;
  }

  async *frames(): AsyncGenerator<Frame> {
    if (this.stopRequested) {
      return;
    }
    const { ffmpegPath, inputArgs, width, height } = this.options;
    const child = spawn(ffmpegPath, ffmpegArgs(inputArgs), { stdio: ['ignore', 'pipe', 'pipe'] });
    this.process = child;
    const timestampOf = this.options.startClock();

    const failure: { error: NodeJS.ErrnoException | null } = { error: null };
    child.on('error', (error: NodeJS.ErrnoException) => {
      failure.error ??= error;
    });
    // Gdy uruchomienie się nie uda, Node nie wysyła 'exit', tylko 'error' i 'close'.
    this.exited = new Promise((resolve) => {
      child.once('exit', () => resolve());
      child.once('close', () => resolve());
    });
    const closed = new Promise<number | null>((resolve) => child.once('close', (code) => resolve(code)));
    const stderr = tailCollector(child.stderr as Readable);

    const frameBytes = width * height * FRAME_BYTES_PER_PIXEL;
    let buffer = new Uint8Array(frameBytes);
    let filled = 0;
    let index = 0;
    try {
      for await (const chunk of child.stdout as AsyncIterable<Buffer>) {
        let offset = 0;
        while (offset < chunk.length) {
          const count = Math.min(frameBytes - filled, chunk.length - offset);
          buffer.set(chunk.subarray(offset, offset + count), filled);
          filled += count;
          offset += count;
          if (filled === frameBytes) {
            const frame: Frame = { width, height, data: buffer, timestamp: timestampOf(index) };
            index += 1;
            buffer = new Uint8Array(frameBytes);
            filled = 0;
            yield frame;
            if (this.stopRequested) {
              return;
            }
          }
        }
      }
      if (this.stopRequested) {
        return;
      }
      const code = await closed;
      if (failure.error !== null) {
        throw failure.error.code === 'ENOENT' ? notFoundError('ffmpeg', ffmpegPath) : failure.error;
      }
      if (this.stopRequested) {
        return;
      }
      if (code !== 0) {
        throw new Error(`ffmpeg exited with code ${code}: ${stderr().trim()}`);
      }
      if (filled > 0) {
        throw new Error(`ffmpeg output truncated: ${filled} of ${frameBytes} bytes in the last frame`);
      }
    } catch (error) {
      if (this.stopRequested) {
        return;
      }
      throw error;
    } finally {
      await this.stop();
    }
  }

  stop(): Promise<void> {
    this.stopRequested = true;
    this.stopping ??= this.terminate();
    return this.stopping;
  }

  private async terminate(): Promise<void> {
    const child = this.process;
    if (child === null || child.exitCode !== null || child.signalCode !== null) {
      return this.exited;
    }
    // Sam SIGTERM nie zatrzyma ffmpeg zablokowanego na zapisie do pełnego potoku.
    child.stdout?.destroy();
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), KILL_AFTER_MS);
    try {
      await this.exited;
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface CaptureResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

// Uruchamia krótki proces (ffprobe) i zbiera jego wyjście. Przerwanie przez signal kończy proces i odrzuca wynik.
export function captureOutput(
  label: string,
  command: string,
  args: readonly string[],
  signal: AbortSignal,
): Promise<CaptureResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
    let stdout = '';
    const stderr = tailCollector(child.stderr);
    let failure: Error | null = null;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      failure ??= error.code === 'ENOENT' ? notFoundError(label, command) : error;
    });
    child.on('close', (code) => {
      if (failure !== null) {
        reject(failure);
      } else {
        resolve({ code, stdout, stderr: stderr() });
      }
    });
  });
}

function tailCollector(stream: Readable): () => string {
  let tail = Buffer.alloc(0);
  stream.on('data', (chunk: Buffer) => {
    const joined = Buffer.concat([tail, chunk]);
    tail = joined.subarray(Math.max(0, joined.length - STDERR_TAIL_BYTES));
  });
  return () => tail.toString('utf8');
}
