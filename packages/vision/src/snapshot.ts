import { ApiError, LoginResponse, type LoginRequest } from '@autoscore/schema';
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
    headers.authorization = `Bearer ${await login(send, api.url, api.password)}`;
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

async function login(send: typeof fetch, baseUrl: string, password: string): Promise<string> {
  const body: LoginRequest = { password };
  const response = await call(send, baseUrl, `${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    throw new Error('Login failed: invalid AUTOSCORE_PASSWORD');
  }
  if (!response.ok) {
    throw new Error(`Login failed: ${await describeError(response)}`);
  }
  return LoginResponse.parse(await response.json()).token;
}

async function call(send: typeof fetch, baseUrl: string, url: string, init: RequestInit): Promise<Response> {
  try {
    return await send(url, init);
  } catch (error) {
    throw new Error(`Cannot reach the server at ${baseUrl}: ${networkReason(error)}`, { cause: error });
  }
}

// fetch zgłasza samo "fetch failed", a przyczyna jest w cause. Dla localhost (IPv4 i IPv6) to AggregateError
// z pustym komunikatem, więc wtedy zostaje kod, np. ECONNREFUSED.
function networkReason(error: unknown): string {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  if (!(cause instanceof Error)) {
    return String(cause);
  }
  if (cause.message !== '') {
    return cause.message;
  }
  return 'code' in cause && typeof cause.code === 'string' ? cause.code : cause.name;
}

async function describeError(response: Response): Promise<string> {
  const parsed = ApiError.safeParse(await response.json().catch(() => null));
  return parsed.success ? `HTTP ${response.status} ${parsed.data.error}` : `HTTP ${response.status}`;
}
