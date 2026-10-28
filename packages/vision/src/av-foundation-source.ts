import type { CameraSource } from './camera-source.js';
import { ffmpegArgs, FfmpegFrames } from './ffmpeg-frames.js';
import type { Frame } from './frame.js';

const AV_FOUNDATION_WIDTH = 1920;
const AV_FOUNDATION_HEIGHT = 1080;

export interface AvFoundationSourceOptions {
  readonly ffmpegPath?: string;
  readonly now?: () => number;
}

// Kamera wybierana po nazwie, bo indeksy AVFoundation zmieniają się po restarcie.
// Przez USB 2.0 kamera daje 1080p tylko bez kompresji (uyvy422), w praktyce około 5 kl./s.
// Urządzenie przyjmuje tylko ogłaszane tryby, więc -framerate zostaje 30, a nie 5.
function avFoundationInputArgs(name: string): string[] {
  return [
    '-f', 'avfoundation',
    '-framerate', '30.000030',
    '-video_size', `${AV_FOUNDATION_WIDTH}x${AV_FOUNDATION_HEIGHT}`,
    '-pixel_format', 'uyvy422',
    '-i', name,
  ];
}

export function avFoundationArgs(name: string): string[] {
  return ffmpegArgs(avFoundationInputArgs(name));
}

export class AvFoundationSource implements CameraSource {
  private readonly runner: FfmpegFrames;
  private started = false;

  constructor(name: string, options: AvFoundationSourceOptions = {}) {
    const now = options.now ?? (() => performance.now());
    this.runner = new FfmpegFrames({
      ffmpegPath: options.ffmpegPath ?? 'ffmpeg',
      inputArgs: avFoundationInputArgs(name),
      width: AV_FOUNDATION_WIDTH,
      height: AV_FOUNDATION_HEIGHT,
      startClock: () => {
        const start = now();
        return () => now() - start;
      },
    });
  }

  frames(): AsyncIterable<Frame> {
    if (this.started) {
      throw new Error('frames() can only be called once');
    }
    this.started = true;
    return this.runner.frames();
  }

  close(): Promise<void> {
    return this.runner.stop();
  }
}
