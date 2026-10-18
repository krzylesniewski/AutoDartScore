import { ApiError, MatchListItem, MatchSnapshot, MatchSummary, Player, PlayerStats, ThrowResult, UndoResult } from '@autoscore/schema';
import type { AbandonMatchRequest, CreateMatchRequest, CreatePlayerRequest, HitEvent, StatsFilter } from '@autoscore/schema';

// Vite przekierowuje /api do serwera, więc front i API mają jeden adres.
export const API_BASE = '/api';

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

async function request<T>(path: string, schema: Parser<T>, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiError.safeParse(body);
    if (error.success) {
      throw new ApiRequestError(response.status, error.data.error, error.data.message);
    }
    throw new ApiRequestError(response.status, 'http_error', `HTTP ${response.status}`);
  }
  return schema.parse(body);
}

function postJson(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

export function listPlayers(): Promise<Player[]> {
  return request('/players', Player.array());
}

export function createPlayer(body: CreatePlayerRequest): Promise<Player> {
  return request('/players', Player, postJson(body));
}

export function createMatch(body: CreateMatchRequest): Promise<MatchSnapshot> {
  return request('/matches', MatchSnapshot, postJson(body));
}

export function listMatches(status?: 'unfinished'): Promise<MatchListItem[]> {
  return request(status ? `/matches?status=${status}` : '/matches', MatchListItem.array());
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

export function getMatchSummary(matchId: string): Promise<MatchSummary> {
  return request(`/matches/${encodeURIComponent(matchId)}/summary`, MatchSummary);
}

export function abandonMatch(id: string, body: AbandonMatchRequest): Promise<MatchSnapshot> {
  return request(`/matches/${encodeURIComponent(id)}/abandon`, MatchSnapshot, postJson(body));
}

export function resumeMatch(id: string): Promise<MatchSnapshot> {
  return request(`/matches/${encodeURIComponent(id)}/resume`, MatchSnapshot, { method: 'POST' });
}
