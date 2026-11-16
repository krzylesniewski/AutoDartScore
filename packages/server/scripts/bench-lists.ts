import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { migrateToLatest, openDatabase } from '../src/db/index.js';

// Pomiar listy gier i statystyk na bazie w pliku tymczasowym, wypełnionej przez HTTP.
// Używa tylko buildApp, migrateToLatest, openDatabase i HTTP, więc działa też na starszych wersjach serwera.

const MATCHES_1V1 = 160;
const CASUAL_GAMES = 40;
const SOLO_501_GAMES = 40;
const CHECKOUT_SESSIONS = 10;
const MIN_FREE_RUNS = 60;
const MIN_THROWS = 45_000;
// Krótkie sesje Free run, bo każda rzutka odtwarza całą swoją grę.
const FREE_RUN_DARTS = 240;
const RUNS = 5;

type Dart = readonly [segment: number, multiplier: number];

interface ThrowState {
  readonly finished: boolean;
  readonly currentPlayerId: string | null;
  readonly players: readonly { readonly id: string; readonly remaining: number | null }[];
}

// Stałe ziarno, żeby każde uruchomienie miało te same dane.
function prng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = prng(20261115);
const segment = () => 1 + Math.floor(random() * 20);
const SETUP_DARTS: Dart[] = [
  ...Array.from({ length: 20 }, (_, i): Dart => [i + 1, 1]),
  ...Array.from({ length: 20 }, (_, i): Dart => [i + 1, 3]),
  [25, 1],
];

// Prosty gracz: punktuje na T20, ustawia parzystą resztę do 40 i kończy na double.
function aim(remaining: number): Dart {
  if (remaining > 100) {
    return [20, 3];
  }
  if (remaining === 50) {
    return [25, 2];
  }
  if (remaining <= 40 && remaining % 2 === 0) {
    return [remaining / 2, 2];
  }
  for (const leave of [32, 40, 36, 24, 16, 20, 8, 12, 4, 2]) {
    const dart = SETUP_DARTS.find(([s, m]) => s * m === remaining - leave);
    if (dart) {
      return dart;
    }
  }
  return [20, 1];
}

function scatter([s, m]: Dart): Dart {
  const roll = random();
  if (roll < 0.6) {
    return [s, m];
  }
  if (roll < 0.8) {
    return [s, 1];
  }
  return roll < 0.95 ? [segment(), 1] : [0, 0];
}

let throwCount = 0;

async function post(app: FastifyInstance, url: string, payload?: object): Promise<unknown> {
  const response = await app.inject({ method: 'POST', url, ...(payload === undefined ? {} : { payload }) });
  if (response.statusCode >= 300) {
    throw new Error(`POST ${url}: ${response.statusCode} ${response.body}`);
  }
  return response.json();
}

async function throwDart(app: FastifyInstance, matchId: string, [s, m]: Dart): Promise<ThrowState> {
  const hit = {
    eventId: randomUUID(),
    matchId,
    source: 'bench',
    sequence: 0,
    segment: s,
    multiplier: m,
    confidence: 1,
    detectedAt: new Date().toISOString(),
  };
  const result = (await post(app, `/matches/${matchId}/throws`, hit)) as { state: ThrowState };
  throwCount += 1;
  return result.state;
}

async function createGame(app: FastifyInstance, payload: object): Promise<{ id: string; state: ThrowState }> {
  const state = (await post(app, '/matches', payload)) as ThrowState & { id: string };
  return { id: state.id, state };
}

// Gra do końca albo do limitu rzutek. stopAfter zostawia grę w trakcie.
async function playX01(app: FastifyInstance, payload: object, stopAfter = Infinity): Promise<string> {
  const created = await createGame(app, payload);
  const { id } = created;
  let { state } = created;
  for (let dart = 0; dart < Math.min(stopAfter, 900) && !state.finished; dart++) {
    const remaining = state.players.find((player) => player.id === state.currentPlayerId)?.remaining ?? 501;
    state = await throwDart(app, id, scatter(aim(remaining)));
  }
  return id;
}

async function seed(app: FastifyInstance): Promise<{ matches: number; playerId: string }> {
  const players: string[] = [];
  for (const name of ['Anna', 'Bartek', 'Celina', 'Darek', 'Ewa', 'Filip', 'Gosia', 'Henryk']) {
    players.push(((await post(app, '/players', { name })) as { id: string }).id);
  }
  const pick = (offset: number, count: number) =>
    Array.from({ length: count }, (_, i) => players[(offset + i * 3) % players.length] as string);
  let matches = 0;

  for (let i = 0; i < MATCHES_1V1; i++) {
    const payload = { type: 'match', playerIds: pick(i, 2), startingScore: i % 4 === 0 ? 301 : 501, bestOf: i % 3 === 0 ? 1 : 3 };
    if (i % 12 === 5) {
      await playX01(app, payload, 20);
    } else if (i % 15 === 7) {
      const id = await playX01(app, payload, 30);
      await post(app, `/matches/${id}/abandon`, { playerId: payload.playerIds[0] });
    } else {
      await playX01(app, payload);
    }
    matches += 1;
  }
  for (let i = 0; i < CASUAL_GAMES; i++) {
    await playX01(app, { type: 'casual', playerIds: pick(i, 3 + (i % 2)), startingScore: 301 });
    matches += 1;
  }
  for (let i = 0; i < SOLO_501_GAMES; i++) {
    await playX01(app, { type: 'practice', practiceMode: 'solo_501', playerIds: pick(i, 1) });
    matches += 1;
  }
  for (let i = 0; i < CHECKOUT_SESSIONS; i++) {
    const { id } = await createGame(app, { type: 'practice', practiceMode: 'checkouts', playerIds: pick(i, 1), checkoutRange: '2-50' });
    for (let attempt = 0; attempt < 30; attempt++) {
      await (attempt % 7 === 6
        ? post(app, `/matches/${id}/checkout-skips`)
        : post(app, `/matches/${id}/checkout-attempts`, { success: random() < 0.4 }));
    }
    matches += 1;
  }
  for (let i = 0; i < MIN_FREE_RUNS || throwCount < MIN_THROWS; i++) {
    const { id } = await createGame(app, { type: 'practice', practiceMode: 'free_run', playerIds: pick(i, 1) });
    for (let dart = 0; dart < FREE_RUN_DARTS; dart++) {
      await throwDart(app, id, scatter([segment(), 1 + Math.floor(random() * 3)]));
    }
    if (i % 10 !== 0) {
      await post(app, `/matches/${id}/end`);
    }
    matches += 1;
  }
  return { matches, playerId: players[0] as string };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

async function time(app: FastifyInstance, url: string): Promise<number> {
  const start = performance.now();
  const response = await app.inject({ method: 'GET', url });
  const elapsed = performance.now() - start;
  if (response.statusCode !== 200) {
    throw new Error(`GET ${url}: ${response.statusCode} ${response.body}`);
  }
  return elapsed;
}

const dir = await mkdtemp(join(tmpdir(), 'autoscore-bench-'));
const db = openDatabase(join(dir, 'bench.db'));
try {
  await migrateToLatest(db);
  const seeding = performance.now();
  const seeder = await buildApp({ db, auth: null, random: prng(7) });
  const { matches, playerId } = await seed(seeder);
  await seeder.close();
  console.log(`Seed: ${matches} matches, ${throwCount} throws in ${((performance.now() - seeding) / 1000).toFixed(1)} s`);

  const urls = ['/matches', '/matches?status=unfinished', '/stats/rankings', '/stats/overall', `/players/${playerId}/stats`];
  console.log(`| Request | First call (ms) | Median of ${RUNS} after it (ms) |`);
  console.log('|---|---|---|');
  for (const url of urls) {
    // Każdy adres na świeżej aplikacji, żeby pierwsze wywołanie zawsze trafiało na pustą pamięć w procesie.
    const app = await buildApp({ db, auth: null });
    try {
      const first = await time(app, url);
      const runs = [];
      for (let run = 0; run < RUNS; run++) {
        runs.push(await time(app, url));
      }
      console.log(`| GET ${url.replace(playerId, ':id')} | ${first.toFixed(0)} | ${median(runs).toFixed(0)} |`);
    } finally {
      await app.close();
    }
  }
} finally {
  await db.destroy();
  await rm(dir, { recursive: true, force: true });
}
