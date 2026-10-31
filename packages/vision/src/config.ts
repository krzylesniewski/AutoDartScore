import os from 'node:os';
import path from 'node:path';
import { AvFoundationSource } from './av-foundation-source.js';
import type { CameraSource } from './camera-source.js';
import { DETECTORS } from './detectors.js';
import { DEFAULT_PENDING_CONFIDENCE } from './evaluation.js';
import { VideoFileSource } from './video-file-source.js';

export type CameraConfig =
  | { readonly kind: 'video'; readonly path: string }
  | { readonly kind: 'avfoundation'; readonly name: string };

export interface ApiConfig {
  readonly url: string; // bez końcowego /
  readonly password: string | null;
}

export interface VisionConfig {
  readonly camera: CameraConfig;
  readonly api: ApiConfig;
  readonly detector: string;
  readonly framesDir: string;
  readonly pendingConfidence: number;
}

// Nazwa z ffmpeg -f avfoundation -list_devices true -i "". Sufiks :none wyłącza dźwięk.
const DEFAULT_CAMERA_NAME = 'HD Pro Webcam C920:none';

// Ta sama zmienna i wartość domyślna co w proxy Vite.
const DEFAULT_API_URL = 'http://localhost:3000';

const DEFAULT_DETECTOR = 'baseline';

export function loadConfig(env: NodeJS.ProcessEnv, homeDir: string = os.homedir()): VisionConfig {
  return {
    camera: parseCamera(env.AUTOSCORE_CAMERA_VIDEO, env.AUTOSCORE_CAMERA_NAME),
    // Bez trim, jak na serwerze, bo spacje mogą być częścią hasła.
    api: { url: parseApiUrl(env.AUTOSCORE_API_URL), password: env.AUTOSCORE_PASSWORD || null },
    detector: parseDetector(env.AUTOSCORE_DETECTOR),
    framesDir: parseFramesDir(env.AUTOSCORE_FRAMES_DIR, homeDir),
    pendingConfidence: parsePendingConfidence(env.AUTOSCORE_PENDING_CONFIDENCE),
  };
}

function parseDetector(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') {
    return DEFAULT_DETECTOR;
  }
  if (!Object.hasOwn(DETECTORS, trimmed)) {
    throw new Error(`Invalid AUTOSCORE_DETECTOR: ${JSON.stringify(trimmed)} (available: ${Object.keys(DETECTORS).join(', ')})`);
  }
  return trimmed;
}

// Domyślnie poza repozytorium, żeby klatki nie trafiły przypadkiem do gita.
function parseFramesDir(value: string | undefined, homeDir: string): string {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? path.join(homeDir, '.autoscore', 'frames') : path.resolve(trimmed);
}

// Te same reguły co na serwerze, bo obie strony czytają tę samą zmienną.
function parsePendingConfidence(value: string | undefined): number {
  if (value === undefined || value === '') {
    return DEFAULT_PENDING_CONFIDENCE;
  }
  const threshold = Number(value);
  if (!/^\d+(\.\d+)?$/.test(value) || threshold > 1) {
    throw new Error(`Invalid AUTOSCORE_PENDING_CONFIDENCE: ${value}`);
  }
  return threshold;
}

function parseApiUrl(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') {
    return DEFAULT_API_URL;
  }
  if (!URL.canParse(trimmed) || !['http:', 'https:'].includes(new URL(trimmed).protocol)) {
    throw new Error(`Invalid AUTOSCORE_API_URL: ${JSON.stringify(trimmed)}`);
  }
  return trimmed.replace(/\/+$/, '');
}

// Nagranie zastępuje kamerę, więc wygrywa z AUTOSCORE_CAMERA_NAME.
// Ścieżka względna liczy się od katalogu roboczego, pod pnpm --filter to packages/vision.
function parseCamera(video: string | undefined, name: string | undefined): CameraConfig {
  const videoPath = (video ?? '').trim();
  if (videoPath !== '') {
    return { kind: 'video', path: path.resolve(videoPath) };
  }
  return { kind: 'avfoundation', name: parseCameraName(name) };
}

function parseCameraName(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') {
    return DEFAULT_CAMERA_NAME;
  }
  if (/\p{Cc}/u.test(trimmed)) {
    throw new Error(`Invalid AUTOSCORE_CAMERA_NAME: ${JSON.stringify(trimmed)}`);
  }
  return trimmed;
}

export function createCameraSource(config: VisionConfig, platform: NodeJS.Platform = process.platform): CameraSource {
  const { camera } = config;
  if (camera.kind === 'video') {
    return new VideoFileSource(camera.path);
  }
  if (platform !== 'darwin') {
    throw new Error(
      `AVFoundation camera is macOS only (platform: ${platform}). Set AUTOSCORE_CAMERA_VIDEO to a recording instead.`,
    );
  }
  return new AvFoundationSource(camera.name);
}
