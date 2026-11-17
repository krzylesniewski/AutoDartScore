import {
  ApiError,
  FrequentHitsResponse,
  HeadToHead,
  LoginResponse,
  MatchListItem,
  MatchSnapshot,
  MatchSummary,
  Player,
  PlayerForm,
  PlayerStats,
  RestMissResult,
  STALE_STATE,
  StaleStateError,
  StatsOverall,
  StartFixtureResult,
  StatsRankings,
  ThrowResult,
  TournamentListItem,
  TournamentView,
  UndoResult,
} from '@autoscore/schema';
import type {
  AbandonMatchRequest,
  CheckoutAttemptRequest,
  CommandRequest,
  CreateMatchRequest,
  CreatePlayerRequest,
  CreateTournamentRequest,
  HitEvent,
  ListPlayersQuery,
  LoginRequest,
  MatchListQuery,
  RestMissRequest,
  StatsFilter,
  StatsPeriod,
  TournamentListQuery,
  UpdatePlayerRequest,
} from '@autoscore/schema';
import { resolveApiBase } from './api-url';
import { handleUnauthorized, readToken } from './session';

// Domyślnie /api przez proxy Vite, więc front i API mają jeden adres.
// VITE_API_URL wskazuje osobny serwer API.
export const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);

// Zawieszone żądanie nie może trzymać ekranu gry w stanie zajętości bez końca.
export const REQUEST_TIMEOUT_MS = 8000;

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

// Serwer odrzucił komendę z nieaktualnym expectedSeq i niczego nie zapisał. state to jego bieżący stan meczu.
export class StaleStateRequestError extends ApiRequestError {
  readonly state: MatchSnapshot;

  constructor(message: string, state: MatchSnapshot) {
    super(409, STALE_STATE, message);
    this.name = 'StaleStateRequestError';
    this.state = state;
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

async function request<T>(path: string, schema: Parser<T>, init: RequestInit = {}): Promise<T> {
  const sentToken = readToken();
  // Przekroczenie czasu nie jest ApiRequestError, więc wywołujący traktują je jak błąd sieci.
  const timed: RequestInit = { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
  const response = await fetch(`${API_BASE}${path}`, sentToken === null ? timed : withToken(timed, sentToken));
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 409) {
      const stale = StaleStateError.safeParse(body);
      if (stale.success) {
        throw new StaleStateRequestError(stale.data.message, stale.data.state);
      }
    }
    const error = ApiError.safeParse(body);
    if (error.success) {
      if (response.status === 401 && error.data.error === 'unauthorized') {
        handleUnauthorized(sentToken);
      }
      throw new ApiRequestError(response.status, error.data.error, error.data.message);
    }
    throw new ApiRequestError(response.status, 'http_error', `HTTP ${response.status}`);
  }
  return schema.parse(body);
}

function postJson(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

// Bez expectedSeq idzie samo POST bez body, tak jak z ekranów list meczów, które nie znają eventSeq.
function postCommand(expectedSeq: number | undefined): RequestInit {
  if (expectedSeq === undefined) {
    return { method: 'POST' };
  }
  const body: CommandRequest = { expectedSeq };
  return postJson(body);
}

function withExpectedSeq(expectedSeq: number | undefined): CommandRequest {
  return expectedSeq === undefined ? {} : { expectedSeq };
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

export function createTournament(body: CreateTournamentRequest): Promise<TournamentView> {
  return request('/tournaments', TournamentView, postJson(body));
}

export function listTournaments(query: TournamentListQuery = {}): Promise<TournamentListItem[]> {
  return request(withQuery('/tournaments', query), TournamentListItem.array());
}

export function getTournament(id: string): Promise<TournamentView> {
  return request(`/tournaments/${encodeURIComponent(id)}`, TournamentView);
}

export function startFixture(tournamentId: string, fixtureId: string, expectedSeq?: number): Promise<StartFixtureResult> {
  return request(
    `/tournaments/${encodeURIComponent(tournamentId)}/fixtures/${encodeURIComponent(fixtureId)}/start`,
    StartFixtureResult,
    postCommand(expectedSeq),
  );
}

export function redrawTournament(tournamentId: string, expectedSeq?: number): Promise<TournamentView> {
  return request(`/tournaments/${encodeURIComponent(tournamentId)}/draw`, TournamentView, postCommand(expectedSeq));
}

export function postThrow(matchId: string, hit: HitEvent): Promise<ThrowResult> {
  return request(`/matches/${encodeURIComponent(matchId)}/throws`, ThrowResult, postJson(hit));
}

export function postRestMiss(matchId: string, body: RestMissRequest): Promise<RestMissResult> {
  return request(`/matches/${encodeURIComponent(matchId)}/rest-miss`, RestMissResult, postJson(body));
}

export function undo(matchId: string, expectedSeq?: number): Promise<UndoResult> {
  return request(`/matches/${encodeURIComponent(matchId)}/undo`, UndoResult, postCommand(expectedSeq));
}

export function getPlayerStats(playerId: string, filter: StatsFilter, period: StatsPeriod): Promise<PlayerStats> {
  return request(withQuery(`/players/${encodeURIComponent(playerId)}/stats`, { type: filter, period }), PlayerStats);
}

export function getHeadToHead(playerId: string, opponentId: string, period: StatsPeriod): Promise<HeadToHead> {
  return request(
    withQuery(`/players/${encodeURIComponent(playerId)}/head-to-head/${encodeURIComponent(opponentId)}`, { period }),
    HeadToHead,
  );
}

export function getPlayerForm(playerId: string, filter: StatsFilter, period: StatsPeriod): Promise<PlayerForm> {
  return request(withQuery(`/players/${encodeURIComponent(playerId)}/form`, { type: filter, period }), PlayerForm);
}

export function getFrequentHits(playerId: string): Promise<FrequentHitsResponse> {
  return request(`/players/${encodeURIComponent(playerId)}/frequent-hits`, FrequentHitsResponse);
}

export function getRankings(filter: StatsFilter, period: StatsPeriod): Promise<StatsRankings> {
  return request(withQuery('/stats/rankings', { type: filter, period }), StatsRankings);
}

export function getOverall(period: StatsPeriod): Promise<StatsOverall> {
  return request(withQuery('/stats/overall', { period }), StatsOverall);
}

export function getMatchSummary(matchId: string): Promise<MatchSummary> {
  return request(`/matches/${encodeURIComponent(matchId)}/summary`, MatchSummary);
}

// Pusty powód (same spacje) nie idzie do serwera.
export function abandonMatch(id: string, playerId: string, reason: string | null, expectedSeq?: number): Promise<MatchSnapshot> {
  const trimmed = reason?.trim();
  const body: AbandonMatchRequest = { playerId, ...(trimmed ? { reason: trimmed } : {}), ...withExpectedSeq(expectedSeq) };
  return request(`/matches/${encodeURIComponent(id)}/abandon`, MatchSnapshot, postJson(body));
}

export function resumeMatch(id: string, expectedSeq?: number): Promise<MatchSnapshot> {
  return request(`/matches/${encodeURIComponent(id)}/resume`, MatchSnapshot, postCommand(expectedSeq));
}

export function endPractice(id: string, expectedSeq?: number): Promise<MatchSnapshot> {
  return request(`/matches/${encodeURIComponent(id)}/end`, MatchSnapshot, postCommand(expectedSeq));
}

export function postCheckoutAttempt(matchId: string, success: boolean, expectedSeq?: number): Promise<MatchSnapshot> {
  const body: CheckoutAttemptRequest = { success, ...withExpectedSeq(expectedSeq) };
  return request(`/matches/${encodeURIComponent(matchId)}/checkout-attempts`, MatchSnapshot, postJson(body));
}

export function postCheckoutSkip(matchId: string, expectedSeq?: number): Promise<MatchSnapshot> {
  return request(`/matches/${encodeURIComponent(matchId)}/checkout-skips`, MatchSnapshot, postCommand(expectedSeq));
}
