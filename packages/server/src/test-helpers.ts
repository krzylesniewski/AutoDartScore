import { randomUUID } from 'node:crypto';
import type { HitEvent, MatchSnapshot, Player } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { expect } from 'vitest';
import { buildApp } from './app.js';
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
export async function setup(options: { random?: () => number; path?: string } = {}): Promise<TestApp> {
  const db = openDatabase(options.path ?? ':memory:');
  await migrateToLatest(db);
  const app = await buildApp({ db, random: options.random ?? (() => 0) });
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

export async function createPlayer(app: FastifyInstance, name: string, extra: { guest?: boolean } = {}): Promise<Player> {
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
  const results = [];
  for (const dart of darts) {
    const response = await postThrow(app, matchId, hitEvent(matchId, dart));
    expect(response.statusCode).toBe(201);
    results.push(response.json());
  }
  return results;
}

export function undo(app: FastifyInstance, matchId: string) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/undo` });
}

export function abandon(app: FastifyInstance, matchId: string, payload: object) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/abandon`, payload });
}

export function resume(app: FastifyInstance, matchId: string) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/resume` });
}

export function endPractice(app: FastifyInstance, matchId: string) {
  return app.inject({ method: 'POST', url: `/matches/${matchId}/end` });
}

export function listMatches(app: FastifyInstance, query = '') {
  return app.inject({ method: 'GET', url: `/matches${query}` });
}

export async function getMatch(app: FastifyInstance, matchId: string): Promise<MatchSnapshot> {
  const response = await app.inject({ method: 'GET', url: `/matches/${matchId}` });
  expect(response.statusCode).toBe(200);
  return response.json();
}

export async function countRows(db: Kysely<Database>, table: 'throws' | 'match_events'): Promise<number> {
  const row = await db.selectFrom(table).select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
  return Number(row.count);
}

export async function logEntries(db: Kysely<Database>, matchId: string) {
  return db.selectFrom('match_events').select(['seq', 'type', 'throw_id', 'player_id', 'reason']).where('match_id', '=', matchId).orderBy('seq').execute();
}

export function remaining(state: MatchSnapshot): (number | null)[] {
  return state.players.map((player) => player.remaining);
}
