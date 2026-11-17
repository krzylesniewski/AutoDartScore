import { randomUUID } from 'node:crypto';
import {
  StartFixtureResult,
  TournamentView,
  type Fixture,
  type HitEvent,
  type MatchSnapshot,
  type Player,
  type ThrowResult,
} from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { expect } from 'vitest';
import { buildApp, type AppOptions } from './app.js';
import { migrateToLatest, openDatabase, type Database } from './db/index.js';

export type Dart = readonly [segment: number, multiplier: number];

export const S = (n: number): Dart => [n, 1];
export const D = (n: number): Dart => [n, 2];
export const T = (n: number): Dart => [n, 3];
export const MISS: Dart = [0, 0];

// Gracz pierwszy na liście kończy 301 w drugiej turze (180, potem 121), drugi pudłuje.
export const LEG_301: readonly Dart[] = [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)];

export interface TestApp {
  readonly app: FastifyInstance;
  readonly db: Kysely<Database>;
  close(): Promise<void>;
}

// random 0 losuje pierwszego gracza z listy, więc skrypty rzutów są przewidywalne.
export async function setup(options: Partial<Omit<AppOptions, 'db'>> & { path?: string } = {}): Promise<TestApp> {
  const { path, ...appOptions } = options;
  const db = openDatabase(path ?? ':memory:');
  await migrateToLatest(db);
  const app = await buildApp({ random: () => 0, auth: null, ...appOptions, db });
  await app.ready(); // injectWS, w przeciwieństwie do inject, nie uruchamia aplikacji
  return {
    app,
    db,
    async close() {
      await app.close();
      await db.destroy();
    },
  };
}

export async function createPlayer(app: FastifyInstance, name: string, extra: { guest?: boolean; color?: number } = {}): Promise<Player> {
  const response = await app.inject({ method: 'POST', url: '/players', payload: { name, ...extra } });
  expect(response.statusCode).toBe(201);
  return response.json();
}

export async function createPlayers(app: FastifyInstance, count: number): Promise<string[]> {
  const names = ['Anna', 'Bartek', 'Celina', 'Darek'].slice(0, count);
  const players = [];
  for (const name of names) {
    players.push(await createPlayer(app, name));
  }
  return players.map((player) => player.id);
}

export async function createGame(app: FastifyInstance, payload: object): Promise<MatchSnapshot> {
  const response = await app.inject({ method: 'POST', url: '/matches', payload });
  expect(response.statusCode).toBe(201);
  return response.json();
}

export function hitEvent(matchId: string, [segment, multiplier]: Dart, overrides: Partial<HitEvent> = {}): HitEvent {
  return {
    eventId: randomUUID(),
    matchId,
    source: 'keypad',
    sequence: 0,
    segment,
    multiplier,
    confidence: 1,
    detectedAt: new Date().toISOString(),
    ...overrides,
  } as HitEvent;
}

export function postThrow(app: FastifyInstance, matchId: string, payload: object) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/throws`, payload });
}

export async function throwDarts(app: FastifyInstance, matchId: string, darts: readonly Dart[]) {
  const results: ThrowResult[] = [];
  for (const dart of darts) {
    const response = await postThrow(app, matchId, hitEvent(matchId, dart));
    expect(response.statusCode).toBe(201);
    results.push(response.json<ThrowResult>());
  }
  return results;
}

// Bez payload żądanie idzie bez body, jak dotąd.
export function undo(app: FastifyInstance, matchId: string, payload?: object) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/undo`, ...(payload && { payload }) });
}

export function checkoutAttempt(app: FastifyInstance, matchId: string, success: boolean) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/checkout-attempts`, payload: { success } });
}

export function checkoutSkip(app: FastifyInstance, matchId: string, payload?: object) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/checkout-skips`, ...(payload && { payload }) });
}

export function abandon(app: FastifyInstance, matchId: string, payload: object) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/abandon`, payload });
}

export function resume(app: FastifyInstance, matchId: string, payload?: object) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/resume`, ...(payload && { payload }) });
}

export function endPractice(app: FastifyInstance, matchId: string, payload?: object) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/end`, ...(payload && { payload }) });
}

export function restMiss(app: FastifyInstance, matchId: string, payload: object) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/rest-miss`, payload });
}

export function patchPlayer(app: FastifyInstance, playerId: string, payload: object) {
  return app.inject({ method: 'PATCH', url: `/players/${playerId}`, payload });
}

export function listMatches(app: FastifyInstance, query = '') {
  return app.inject({ method: 'GET', url: `/matches${query}` });
}

export async function getMatch(app: FastifyInstance, matchId: string): Promise<MatchSnapshot> {
  const response = await app.inject({ method: 'GET', url: `/matches/${matchId}` });
  expect(response.statusCode).toBe(200);
  return response.json();
}

// Każda faza do 1 wygranego lega, więc każdy mecz turnieju to jeden LEG_301.
export const ONE_LEG = { group: 1, r16: 1, qf: 1, sf: 1, final: 1, thirdPlace: 1, consolation: 1 };

export function postTournament(app: FastifyInstance, payload: object) {
  return app.inject({ method: 'POST', url: '/tournaments', payload });
}

// Turniej 301 z meczami do 1 lega. payload nadpisuje te wartości.
export async function createTournament(app: FastifyInstance, payload: object): Promise<TournamentView> {
  const response = await postTournament(app, { startingScore: 301, legsToWin: ONE_LEG, ...payload });
  expect(response.statusCode).toBe(201);
  return TournamentView.parse(response.json());
}

export async function getTournament(app: FastifyInstance, tournamentId: string): Promise<TournamentView> {
  const response = await app.inject({ method: 'GET', url: `/tournaments/${tournamentId}` });
  expect(response.statusCode).toBe(200);
  return TournamentView.parse(response.json());
}

// Bez payload żądanie idzie bez body.
export function startFixture(app: FastifyInstance, tournamentId: string, fixtureId: string, payload?: object) {
  return app.inject({ method: 'POST', url: `/tournaments/${tournamentId}/fixtures/${fixtureId}/start`, ...(payload && { payload }) });
}

export function fixtureOf(view: TournamentView, fixtureId: string): Fixture {
  const fixture = view.fixtures.find((candidate) => candidate.id === fixtureId);
  expect(fixture).toBeDefined();
  return fixture as Fixture;
}

// Gracze meczu w kolejności slotów. Z random 0 zaczyna i wygrywa gracz ze slotu 0.
export function slotPlayers(fixture: Fixture): [string, string] {
  const [first, second] = fixture.slots;
  expect(first.kind).toBe('player');
  expect(second.kind).toBe('player');
  return [first.kind === 'player' ? first.playerId : '', second.kind === 'player' ? second.playerId : ''];
}

// Start meczu turnieju i jeden LEG_301. Wymaga random 0 i meczu do 1 lega.
export async function playFixture(
  app: FastifyInstance,
  tournamentId: string,
  fixtureId: string,
): Promise<{ matchId: string; winnerId: string; tournament: TournamentView }> {
  const response = await startFixture(app, tournamentId, fixtureId);
  expect(response.statusCode).toBe(201);
  const { matchId, tournament: started } = StartFixtureResult.parse(response.json());
  const [winnerId] = slotPlayers(fixtureOf(started, fixtureId));
  await throwDarts(app, matchId, LEG_301);
  return { matchId, winnerId, tournament: await getTournament(app, tournamentId) };
}

export async function countRows(
  db: Kysely<Database>,
  table: 'players' | 'throws' | 'match_events' | 'player_changes' | 'matches' | 'tournaments' | 'tournament_events',
): Promise<number> {
  const row = await db
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

// Store zapisuje created_at z zegara ściennego, więc starszą grę da się zrobić tylko po zapisie.
export async function backdateMatch(db: Kysely<Database>, matchId: string, createdAt: number): Promise<void> {
  await db
    .updateTable('matches')
    .set({ created_at: new Date(createdAt).toISOString() })
    .where('id', '=', matchId)
    .execute();
}

export async function logEntries(db: Kysely<Database>, matchId: string) {
  return db
    .selectFrom('match_events')
    .select(['seq', 'type', 'throw_id', 'player_id', 'reason'])
    .where('match_id', '=', matchId)
    .orderBy('seq')
    .execute();
}

export function remaining(state: MatchSnapshot): (number | null)[] {
  return state.players.map((player) => player.remaining);
}
