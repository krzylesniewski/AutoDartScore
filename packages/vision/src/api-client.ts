import { ApiError, CameraCalibration, LoginResponse, MatchListItem, type HitEvent, type LoginRequest } from '@autoscore/schema';
import { z } from 'zod';
import type { ApiConfig } from './config.js';

export const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [250, 500, 1000, 2000, 4000];

export type Transport = (url: string, init: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  readonly api: ApiConfig;
  readonly fetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly retryDelaysMs?: readonly number[];
}

export type SendHitResult =
  | { readonly ok: true; readonly status: number }
  | { readonly ok: false; readonly status: number; readonly error: string | null };

export interface ApiClient {
  getCalibration(cameraId: string): Promise<CameraCalibration | null>;
  listUnfinishedMatches(): Promise<MatchListItem[]>;
  sendHit(hit: HitEvent): Promise<SendHitResult>;
}

// Błąd sieci i 5xx powtarzamy z tym samym ciałem. Serwer rozpoznaje powtórkę rzutki po eventId.
export function createApiClient({
  api,
  fetch: send = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
}: ApiClientOptions): ApiClient {
  const retrying: Transport = async (url, init) => {
    for (let attempt = 0; ; attempt++) {
      let reason: string;
      let cause: unknown;
      try {
        const response = await send(url, init);
        if (response.status < 500) {
          return response;
        }
        reason = await describeError(response);
      } catch (error) {
        reason = networkReason(error);
        cause = error;
      }
      const delay = retryDelaysMs[attempt];
      if (delay === undefined) {
        throw new Error(`Cannot reach the server at ${api.url}: ${reason}`, { cause });
      }
      await sleep(delay);
    }
  };

  let token: string | null = null;
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${api.url}${path}`;
    const { password } = api;
    if (password === null) {
      return retrying(url, init);
    }
    token ??= await login(retrying, api.url, password);
    const response = await retrying(url, withToken(init, token));
    if (response.status !== 401) {
      return response;
    }
    // Token wygasa albo serwer startuje od nowa, więc jedno ponowne logowanie wystarcza.
    token = await login(retrying, api.url, password);
    const repeated = await retrying(url, withToken(init, token));
    if (repeated.status === 401) {
      throw new Error(`Request ${path} rejected after a new login: ${await describeError(repeated)}`);
    }
    return repeated;
  }

  return {
    async getCalibration(cameraId) {
      const response = await request(`/cameras/${encodeURIComponent(cameraId)}/calibration`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Cannot read the calibration of ${cameraId}: ${await describeError(response)}`);
      }
      return CameraCalibration.parse(await response.json());
    },

    async listUnfinishedMatches() {
      const response = await request('/matches?status=unfinished');
      if (!response.ok) {
        throw new Error(`Cannot list unfinished games: ${await describeError(response)}`);
      }
      return z.array(MatchListItem).parse(await response.json());
    },

    async sendHit(hit) {
      const response = await request(`/matches/${encodeURIComponent(hit.matchId)}/throws`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(hit),
      });
      if (response.ok) {
        return { ok: true, status: response.status };
      }
      return { ok: false, status: response.status, error: await errorCode(response) };
    },
  };
}

function withToken(init: RequestInit, token: string): RequestInit {
  return { ...init, headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${token}` } };
}

export async function login(transport: Transport, baseUrl: string, password: string): Promise<string> {
  const body: LoginRequest = { password };
  const response = await transport(`${baseUrl}/auth/login`, {
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

// Jedna próba, bez powtórek.
export async function call(send: typeof fetch, baseUrl: string, url: string, init: RequestInit): Promise<Response> {
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

export async function describeError(response: Response): Promise<string> {
  const code = await errorCode(response);
  return code === null ? `HTTP ${response.status}` : `HTTP ${response.status} ${code}`;
}

async function errorCode(response: Response): Promise<string | null> {
  const parsed = ApiError.safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data.error : null;
}
