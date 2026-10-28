import { ApiError, CameraCalibration, FrequentHitsResponse, HeadToHead, LoginResponse, MatchListItem, MatchSnapshot, MatchSummary, Player, PlayerForm, PlayerStats, StatsRankings, ThrowResult, UndoResult } from '@autoscore/schema';
import type {
  AbandonMatchRequest,
  CheckoutAttemptRequest,
  CreateMatchRequest,
  CreatePlayerRequest,
  HitEvent,
  ListPlayersQuery,
  LoginRequest,
  MatchListQuery,
  StatsFilter,
  UpdatePlayerRequest,
} from '@autoscore/schema';
import { resolveApiBase } from './api-url';
import { handleUnauthorized, readToken } from './session';

// Domyślnie /api przez proxy Vite, więc front i API mają jeden adres.
// VITE_API_URL wskazuje osobny serwer API.
export const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

interface Parser<T> {
  parse(value: unknown): T;
}

function withToken(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  return { ...init, headers };
}

async function send(path: string, init: RequestInit): Promise<{ response: Response; sentToken: string | null }> {
  const sentToken = readToken();
  const response = await fetch(`${API_BASE}${path}`, sentToken === null ? init : withToken(init, sentToken));
  return { response, sentToken };
}

function toRequestError(response: Response, body: unknown, sentToken: string | null): ApiRequestError {
  const error = ApiError.safeParse(body);
  if (error.success) {
    if (response.status === 401 && error.data.error === 'unauthorized') {
      handleUnauthorized(sentToken);
    }
    return new ApiRequestError(response.status, error.data.error, error.data.message);
  }
  return new ApiRequestError(response.status, 'http_error', `HTTP ${response.status}`);
}

async function request<T>(path: string, schema: Parser<T>, init: RequestInit = {}): Promise<T> {
  const { response, sentToken } = await send(path, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw toRequestError(response, body, sentToken);
  }
  return schema.parse(body);
}

// Odpowiedź binarna: JSON czytamy tylko z błędu.
async function requestBlob(path: string): Promise<Blob> {
  const { response, sentToken } = await send(path, {});
  if (!response.ok) {
    throw toRequestError(response, await response.json().catch(() => null), sentToken);
  }
  return response.blob();
}

// 404 to brak zasobu, a nie błąd. Pozostałe błędy przechodzą dalej.
async function orNull<T>(pending: Promise<T>): Promise<T | null> {
  try {
    return await pending;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function postJson(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

// Tylko podane klucze, bez pustego "?", gdy nie ma żadnego.
function withQuery(path: string, query: Readonly<Record<string, string | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, value);
    }
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function login(body: LoginRequest): Promise<LoginResponse> {
  return request('/auth/login', LoginResponse, postJson(body));
}

export function listPlayers(query: ListPlayersQuery = {}): Promise<Player[]> {
  return request(withQuery('/players', query), Player.array());
}

export function updatePlayer(id: string, body: UpdatePlayerRequest): Promise<Player> {
  return request(`/players/${encodeURIComponent(id)}`, Player, { ...postJson(body), method: 'PATCH' });
}

export function createPlayer(body: CreatePlayerRequest): Promise<Player> {
  return request('/players', Player, postJson(body));
}

export function createMatch(body: CreateMatchRequest): Promise<MatchSnapshot> {
  return request('/matches', MatchSnapshot, postJson(body));
}

export function listMatches(query: MatchListQuery = {}): Promise<MatchListItem[]> {
  return request(withQuery('/matches', query), MatchListItem.array());
}

export function getMatch(id: string): Promise<MatchSnapshot> {
  return request(`/matches/${encodeURIComponent(id)}`, MatchSnapshot);
}

export function postThrow(matchId: string, hit: HitEvent): Promise<ThrowResult> {
  return request(`/matches/${encodeURIComponent(matchId)}/throws`, ThrowResult, postJson(hit));
}

export function undo(matchId: string): Promise<UndoResult> {
  return request(`/matches/${encodeURIComponent(matchId)}/undo`, UndoResult, { method: 'POST' });
}

export function getPlayerStats(playerId: string, filter: StatsFilter): Promise<PlayerStats> {
  return request(`/players/${encodeURIComponent(playerId)}/stats?type=${filter}`, PlayerStats);
}

export function getHeadToHead(playerId: string, opponentId: string): Promise<HeadToHead> {
  return request(`/players/${encodeURIComponent(playerId)}/head-to-head/${encodeURIComponent(opponentId)}`, HeadToHead);
}

export function getPlayerForm(playerId: string, filter: StatsFilter): Promise<PlayerForm> {
  return request(`/players/${encodeURIComponent(playerId)}/form?type=${filter}`, PlayerForm);
}

export function getFrequentHits(playerId: string): Promise<FrequentHitsResponse> {
  return request(`/players/${encodeURIComponent(playerId)}/frequent-hits`, FrequentHitsResponse);
}

export function getRankings(filter: StatsFilter): Promise<StatsRankings> {
  return request(`/stats/rankings?type=${filter}`, StatsRankings);
}

export function getMatchSummary(matchId: string): Promise<MatchSummary> {
  return request(`/matches/${encodeURIComponent(matchId)}/summary`, MatchSummary);
}

// Pusty powód (same spacje) nie idzie do serwera.
export function abandonMatch(id: string, playerId: string, reason: string | null): Promise<MatchSnapshot> {
  const trimmed = reason?.trim();
  const body: AbandonMatchRequest = { playerId, ...(trimmed ? { reason: trimmed } : {}) };
  return request(`/matches/${encodeURIComponent(id)}/abandon`, MatchSnapshot, postJson(body));
}

export function resumeMatch(id: string): Promise<MatchSnapshot> {
  return request(`/matches/${encodeURIComponent(id)}/resume`, MatchSnapshot, { method: 'POST' });
}

export function endPractice(id: string): Promise<MatchSnapshot> {
  return request(`/matches/${encodeURIComponent(id)}/end`, MatchSnapshot, { method: 'POST' });
}

export function postCheckoutAttempt(matchId: string, success: boolean): Promise<MatchSnapshot> {
  const body: CheckoutAttemptRequest = { success };
  return request(`/matches/${encodeURIComponent(matchId)}/checkout-attempts`, MatchSnapshot, postJson(body));
}

export function postCheckoutSkip(matchId: string): Promise<MatchSnapshot> {
  return request(`/matches/${encodeURIComponent(matchId)}/checkout-skips`, MatchSnapshot, { method: 'POST' });
}

function cameraPath(cameraId: string, resource: 'snapshot' | 'calibration'): string {
  return `/cameras/${encodeURIComponent(cameraId)}/${resource}`;
}

export function getCameraSnapshot(cameraId: string): Promise<Blob | null> {
  return orNull(requestBlob(cameraPath(cameraId, 'snapshot')));
}

export function getCameraCalibration(cameraId: string): Promise<CameraCalibration | null> {
  return orNull(request(cameraPath(cameraId, 'calibration'), CameraCalibration));
}

export function saveCameraCalibration(cameraId: string, calibration: CameraCalibration): Promise<CameraCalibration> {
  return request(cameraPath(cameraId, 'calibration'), CameraCalibration, { ...postJson(calibration), method: 'PUT' });
}
