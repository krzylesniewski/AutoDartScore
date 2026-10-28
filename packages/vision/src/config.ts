import path from 'node:path';
import { AvFoundationSource } from './av-foundation-source.js';
import type { CameraSource } from './camera-source.js';
import { VideoFileSource } from './video-file-source.js';

export type CameraConfig =
  | { readonly kind: 'video'; readonly path: string }
  | { readonly kind: 'avfoundation'; readonly name: string };

export interface VisionConfig {
  readonly camera: CameraConfig;
}

// Nazwa z ffmpeg -f avfoundation -list_devices true -i "". Sufiks :none wyłącza dźwięk.
const DEFAULT_CAMERA_NAME = 'HD Pro Webcam C920:none';

export function loadConfig(env: NodeJS.ProcessEnv): VisionConfig {
  return { camera: parseCamera(env.AUTOSCORE_CAMERA_VIDEO, env.AUTOSCORE_CAMERA_NAME) };
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
