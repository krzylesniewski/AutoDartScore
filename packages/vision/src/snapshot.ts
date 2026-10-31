import { call, describeError, login } from './api-client.js';
import type { CameraSource } from './camera-source.js';
import type { ApiConfig } from './config.js';
import type { Frame } from './frame.js';

export interface CaptureOptions {
  readonly settleMs: number;
}

// Kamera na żywo daje najpierw ciemne klatki, zanim dostroi ekspozycję, więc czekamy settleMs od pierwszej klatki.
export async function captureFrame(source: CameraSource, { settleMs }: CaptureOptions): Promise<Frame> {
  try {
    let first: Frame | null = null;
    let last: Frame | null = null;
    for await (const frame of source.frames()) {
      first ??= frame;
      last = frame;
      if (frame.timestamp - first.timestamp >= settleMs) {
        return frame;
      }
    }
    if (last === null) {
      throw new Error('Camera gave no frame');
    }
    return last;
  } finally {
    await source.close();
  }
}

export interface SendSnapshotOptions {
  readonly api: ApiConfig;
  readonly cameraId: string;
  readonly jpeg: Uint8Array;
  readonly fetch?: typeof fetch;
}

export async function sendSnapshot({ api, cameraId, jpeg, fetch: send = fetch }: SendSnapshotOptions): Promise<void> {
  const headers: Record<string, string> = { 'content-type': 'image/jpeg' };
  if (api.password !== null) {
    headers.authorization = `Bearer ${await login((url, init) => call(send, api.url, url, init), api.url, api.password)}`;
  }
  const response = await call(send, api.url, `${api.url}/cameras/${encodeURIComponent(cameraId)}/snapshot`, {
    method: 'PUT',
    headers,
    body: new Blob([jpeg.slice()], { type: 'image/jpeg' }),
  });
  if (!response.ok) {
    throw new Error(`Snapshot upload failed: ${await describeError(response)}`);
  }
}
