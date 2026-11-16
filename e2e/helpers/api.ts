import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import type { AbandonMatchRequest, CreateMatchRequest, CreatePlayerRequest, FrequentHitsResponse, Hit, HitEvent, LoginRequest, LoginResponse, MatchSnapshot, Player } from '@autoscore/schema';
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

export async function createMatchByApi(request: APIRequestContext, token: string, playerIds: readonly [string, string]): Promise<MatchSnapshot> {
  const body: CreateMatchRequest = { type: 'match', playerIds: [...playerIds], startingScore: 301, bestOf: 1 };
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

export async function frequentHitsByApi(request: APIRequestContext, token: string, playerId: string): Promise<FrequentHitsResponse['hits']> {
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
