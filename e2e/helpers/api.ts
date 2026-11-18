import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type {
  AbandonMatchRequest,
  CreateMatchRequest,
  CreatePlayerRequest,
  FrequentHitsResponse,
  Hit,
  HitEvent,
  LoginRequest,
  LoginResponse,
  MatchSnapshot,
  Player,
  StartFixtureResult,
  TournamentView,
  CreateTournamentRequest,
  WithdrawPlayerRequest,
} from '@autoscore/schema';
import { PASSWORD } from '../env';

// T20 ×3, Miss ×3, potem T20, T11, D14: zaczynający zamyka leg 301, kimkolwiek jest.
export const FINISHING_DARTS: readonly Hit[] = [
  { segment: 20, multiplier: 3 },
  { segment: 20, multiplier: 3 },
  { segment: 20, multiplier: 3 },
  { segment: 0, multiplier: 0 },
  { segment: 0, multiplier: 0 },
  { segment: 0, multiplier: 0 },
  { segment: 20, multiplier: 3 },
  { segment: 11, multiplier: 3 },
  { segment: 14, multiplier: 2 },
];

export const MISS: Hit = { segment: 0, multiplier: 0 };

const T20: Hit = { segment: 20, multiplier: 3 };

// Zaczynający pudłuje, więc drugi gracz zamyka leg 301: 180, potem T20, T11, D14.
const SECOND_PLAYER_FINISHES: readonly Hit[] = [
  MISS,
  MISS,
  MISS,
  T20,
  T20,
  T20,
  MISS,
  MISS,
  MISS,
  T20,
  { segment: 11, multiplier: 3 },
  { segment: 14, multiplier: 2 },
];

function authorization(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function loginByApi(request: APIRequestContext): Promise<string> {
  const body: LoginRequest = { password: PASSWORD };
  const response = await request.post('/auth/login', { data: body });
  await expect(response).toBeOK();
  return ((await response.json()) as LoginResponse).token;
}

export async function createPlayerByApi(request: APIRequestContext, token: string, name: string): Promise<Player> {
  const body: CreatePlayerRequest = { name, guest: false };
  const response = await request.post('/players', { headers: authorization(token), data: body });
  await expect(response).toBeOK();
  return (await response.json()) as Player;
}

export async function createMatchByApi(
  request: APIRequestContext,
  token: string,
  playerIds: readonly [string, string],
): Promise<MatchSnapshot> {
  const body: CreateMatchRequest = { type: 'match', playerIds: [...playerIds], startingScore: 301, bestOf: 1 };
  const response = await request.post('/matches', { headers: authorization(token), data: body });
  await expect(response).toBeOK();
  return (await response.json()) as MatchSnapshot;
}

export async function createCasualByApi(request: APIRequestContext, token: string, playerIds: readonly string[]): Promise<MatchSnapshot> {
  const body: CreateMatchRequest = { type: 'casual', playerIds: [...playerIds], startingScore: 301 };
  const response = await request.post('/matches', { headers: authorization(token), data: body });
  await expect(response).toBeOK();
  return (await response.json()) as MatchSnapshot;
}

export async function createPracticeByApi(
  request: APIRequestContext,
  token: string,
  playerId: string,
  mode: { practiceMode: 'checkouts'; checkoutRange: '2-50' } | { practiceMode: 'solo_501' | 'free_run' },
): Promise<MatchSnapshot> {
  const body: CreateMatchRequest = { type: 'practice', playerIds: [playerId], ...mode };
  const response = await request.post('/matches', { headers: authorization(token), data: body });
  await expect(response).toBeOK();
  return (await response.json()) as MatchSnapshot;
}

export async function frequentHitsByApi(
  request: APIRequestContext,
  token: string,
  playerId: string,
): Promise<FrequentHitsResponse['hits']> {
  const response = await request.get(`/players/${encodeURIComponent(playerId)}/frequent-hits`, { headers: authorization(token) });
  await expect(response).toBeOK();
  return ((await response.json()) as FrequentHitsResponse).hits;
}

export async function abandonMatchByApi(request: APIRequestContext, token: string, matchId: string, playerId: string): Promise<void> {
  const body: AbandonMatchRequest = { playerId };
  const response = await request.post(`/matches/${matchId}/abandon`, { headers: authorization(token), data: body });
  await expect(response).toBeOK();
}

// Rzutki trafiają do bieżącego rzucającego, po kolei, każda z własnym eventId.
export async function postThrowsByApi(request: APIRequestContext, token: string, matchId: string, hits: readonly Hit[]): Promise<void> {
  for (const [sequence, hit] of hits.entries()) {
    const body: HitEvent = {
      eventId: randomUUID(),
      matchId,
      source: 'e2e',
      sequence,
      segment: hit.segment,
      multiplier: hit.multiplier,
      confidence: 1,
      detectedAt: new Date().toISOString(),
    };
    const response = await request.post(`/matches/${matchId}/throws`, { headers: authorization(token), data: body });
    await expect(response).toBeOK();
  }
}

// Domyślnie liga do jednego wygranego lega, więc FINISHING_DARTS kończy każdy mecz 1:0. Typ to wynik parsowania, więc idą wszystkie pola.
export async function createTournamentByApi(
  request: APIRequestContext,
  token: string,
  name: string,
  playerIds: readonly string[],
  overrides: Partial<CreateTournamentRequest> = {},
): Promise<TournamentView> {
  const body: CreateTournamentRequest = {
    name,
    format: 'league',
    playerIds: [...playerIds],
    startingScore: 301,
    thirdPlaceMatch: false,
    consolation: false,
    legsToWin: { group: 1, r16: 3, qf: 3, sf: 3, final: 4, thirdPlace: 2, consolation: 2 },
    sharing: false,
    ...overrides,
  };
  const response = await request.post('/tournaments', { headers: authorization(token), data: body });
  await expect(response).toBeOK();
  return (await response.json()) as TournamentView;
}

export async function getTournamentByApi(request: APIRequestContext, token: string, tournamentId: string): Promise<TournamentView> {
  const response = await request.get(`/tournaments/${encodeURIComponent(tournamentId)}`, { headers: authorization(token) });
  await expect(response).toBeOK();
  return (await response.json()) as TournamentView;
}

// Ponowny start trwającego meczu zwraca ten sam matchId.
export async function startFixtureByApi(
  request: APIRequestContext,
  token: string,
  tournamentId: string,
  fixtureId: string,
): Promise<StartFixtureResult> {
  const path = `/tournaments/${encodeURIComponent(tournamentId)}/fixtures/${encodeURIComponent(fixtureId)}/start`;
  const response = await request.post(path, { headers: authorization(token) });
  await expect(response).toBeOK();
  return (await response.json()) as StartFixtureResult;
}

// Serwer archiwizuje tylko zakończony turniej.
export async function archiveTournamentByApi(request: APIRequestContext, token: string, tournamentId: string): Promise<TournamentView> {
  const response = await request.post(`/tournaments/${encodeURIComponent(tournamentId)}/archive`, { headers: authorization(token) });
  await expect(response).toBeOK();
  return (await response.json()) as TournamentView;
}

export async function getMatchByApi(request: APIRequestContext, token: string, matchId: string): Promise<MatchSnapshot> {
  const response = await request.get(`/matches/${encodeURIComponent(matchId)}`, { headers: authorization(token) });
  await expect(response).toBeOK();
  return (await response.json()) as MatchSnapshot;
}

// Mecz 301 do jednego lega bez rzutek. Zaczynającego losuje serwer, więc rzutki zależą od tego, czy to zwycięzca.
export async function winMatchByApi(request: APIRequestContext, token: string, matchId: string, winnerId: string): Promise<void> {
  const { currentPlayerId } = await getMatchByApi(request, token, matchId);
  await postThrowsByApi(request, token, matchId, currentPlayerId === winnerId ? FINISHING_DARTS : SECOND_PLAYER_FINISHES);
  const match = await getMatchByApi(request, token, matchId);
  expect(match.finished, `match ${matchId} finished`).toBe(true);
  expect(match.winnerId, `winner of match ${matchId}`).toBe(winnerId);
}

export async function withdrawPlayerByApi(
  request: APIRequestContext,
  token: string,
  tournamentId: string,
  playerId: string,
): Promise<APIResponse> {
  const body: WithdrawPlayerRequest = { playerId };
  return request.post(`/tournaments/${encodeURIComponent(tournamentId)}/withdrawals`, { headers: authorization(token), data: body });
}

// Bez tokenu, jak przeglądarka z publicznym linkiem.
export async function getPublicTournamentByApi(request: APIRequestContext, tournamentId: string): Promise<APIResponse> {
  return request.get(`/public/tournaments/${encodeURIComponent(tournamentId)}`);
}

// Specy dzielą jedną bazę. Trwający turniej dałby tournament_active przy następnym POST /tournaments i przekierował
// #/tournaments w layout.spec.ts, więc każdy spec kończy i archiwizuje swój turniej, także gdy test padnie w połowie.
export async function finishAndArchiveTournamentByApi(request: APIRequestContext, token: string, tournamentId: string): Promise<void> {
  let view = await getTournamentByApi(request, token, tournamentId);
  if (view.archivedAt !== null) {
    return;
  }
  for (const player of view.players.slice(1)) {
    if (view.status !== 'in_progress') {
      break;
    }
    const response = await withdrawPlayerByApi(request, token, tournamentId, player.id);
    expect([201, 409], `withdraw ${player.id}: ${await response.text()}`).toContain(response.status());
    view = await getTournamentByApi(request, token, tournamentId);
  }
  expect(view.status, `tournament ${tournamentId} after withdrawals`).toBe('finished');
  await archiveTournamentByApi(request, token, tournamentId);
}
