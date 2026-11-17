import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError, PublicTournamentMatch, PublicTournamentStats, PublicTournamentView, TournamentView } from '@autoscore/schema';
import { afterEach, describe, expect, it } from 'vitest';
import { createToken } from '../auth/credentials.js';
import { PUBLIC_REQUESTS_PER_MINUTE } from '../public/rate-limiter.js';
import { PUBLIC_CACHE_TTL_MS } from '../public/response-cache.js';
import {
  LEG_301,
  MISS,
  T,
  countRows,
  createGame,
  createPlayers,
  createTournament,
  patchPlayer,
  playFixture,
  setSharing,
  setup,
  startFixture,
  throwDarts,
  type TestApp,
} from '../test-helpers.js';

const PHOTO = 'https://example.com/photo.jpg';
const auth = { password: 'tajne hasło', tokenSecret: 's'.repeat(32) };
const clock = { now: 0 };

let t: TestApp | null = null;
let dir: string | null = null;
afterEach(async () => {
  await t?.close();
  t = null;
  if (dir !== null) {
    await rm(dir, { recursive: true, force: true });
    dir = null;
  }
});

async function start(options: Parameters<typeof setup>[0] = {}): Promise<TestApp> {
  clock.now = Date.parse('2026-11-17T18:00:00.000Z');
  t = await setup({ now: () => clock.now, ...options });
  return t;
}

type App = TestApp['app'];

function read(app: App, path: string, remoteAddress?: string) {
  return app.inject({ method: 'GET', url: `/public/tournaments/${path}`, ...(remoteAddress === undefined ? {} : { remoteAddress }) });
}

function readAll(app: App, tournamentId: string, matchId: string) {
  return Promise.all([read(app, tournamentId), read(app, `${tournamentId}/stats`), read(app, `${tournamentId}/matches/${matchId}`)]);
}

function archive(app: App, tournamentId: string) {
  return app.inject({ method: 'POST', url: `/tournaments/${tournamentId}/archive` });
}

// Puchar 3 graczy: p-sf-1 to wolny los. p-sf-2 kończy się, finał trwa po jednej turze pierwszego gracza.
async function cupWithMatches(app: App): Promise<{ cup: TournamentView; finishedMatchId: string; liveMatchId: string; players: string[] }> {
  const players = await createPlayers(app, 3);
  const cup = await createTournament(app, { name: 'Puchar testowy', format: 'cup', playerIds: players });
  const { matchId: finishedMatchId } = await playFixture(app, cup.id, 'p-sf-2');
  const started = await startFixture(app, cup.id, 'p-f');
  expect(started.statusCode).toBe(201);
  const liveMatchId = started.json<{ matchId: string }>().matchId;
  await throwDarts(app, liveMatchId, [T(20), T(20), T(20)]);
  return { cup, finishedMatchId, liveMatchId, players };
}

async function finishCup(app: App, cupId: string, liveMatchId: string): Promise<void> {
  await throwDarts(app, liveMatchId, LEG_301.slice(3));
  expect((await app.inject({ method: 'GET', url: `/tournaments/${cupId}` })).json<TournamentView>().status).toBe('finished');
}

describe('public tournament routes with auth on', () => {
  // Dane zapisane bez hasła, potem ta sama baza otwarta z hasłem.
  async function seededWithAuth() {
    dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
    const path = join(dir, 'games.sqlite');
    const seed = await start({ path });
    const seeded = await cupWithMatches(seed.app);
    const [anna, bartek] = seeded.players as [string, string];
    const plain = await createGame(seed.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    await seed.close();
    t = null;
    const app = (await start({ path, auth })).app;
    return { ...seeded, app, plainMatchId: plain.id, authorization: `Bearer ${createToken(auth, clock.now + 60_000)}` };
  }

  it('reads the view, the stats and a match without a token', async () => {
    const { app, cup, liveMatchId } = await seededWithAuth();
    const [view, stats, match] = await readAll(app, cup.id, liveMatchId);
    expect([view.statusCode, stats.statusCode, match.statusCode]).toEqual([200, 200, 200]);
    expect(PublicTournamentView.parse(view.json())).toMatchObject({ id: cup.id, name: 'Puchar testowy', liveFixtureId: 'p-f' });
    expect(PublicTournamentStats.parse(stats.json()).tournamentId).toBe(cup.id);
    expect(PublicTournamentMatch.parse(match.json())).toMatchObject({ tournamentId: cup.id, fixtureId: 'p-f', match: { id: liveMatchId } });
    const head = await app.inject({ method: 'HEAD', url: `/public/tournaments/${cup.id}` });
    expect(head.statusCode).toBe(200);
  });

  it('still needs a token for every other route', async () => {
    const { app, cup, liveMatchId } = await seededWithAuth();
    const responses = await Promise.all([
      app.inject({ method: 'GET', url: `/tournaments/${cup.id}` }),
      app.inject({ method: 'GET', url: `/tournaments/${cup.id}/stats` }),
      app.inject({ method: 'POST', url: `/tournaments/${cup.id}/sharing`, payload: { sharing: false } }),
      app.inject({ method: 'GET', url: `/matches/${liveMatchId}/summary` }),
      app.inject({ method: 'GET', url: `/matches/${liveMatchId}/legs` }),
    ]);
    for (const response of responses) {
      expect(response.statusCode).toBe(401);
      expect(ApiError.parse(response.json()).error).toBe('unauthorized');
    }
  });

  it('accepts no write under /public', async () => {
    const { app, cup, authorization } = await seededWithAuth();
    const before = await countRows(t!.db, 'tournament_events');
    const payload = { sharing: false };
    const anonymous = await app.inject({ method: 'POST', url: `/public/tournaments/${cup.id}`, payload });
    expect(anonymous.statusCode).toBe(401);
    const signedIn = await app.inject({ method: 'POST', url: `/public/tournaments/${cup.id}`, payload, headers: { authorization } });
    expect(signedIn.statusCode).toBe(404);
    expect(ApiError.parse(signedIn.json()).error).toBe('not_found');
    const sharing = await app.inject({ method: 'POST', url: `/public/tournaments/${cup.id}/sharing`, payload, headers: { authorization } });
    expect(sharing.statusCode).toBe(404);
    expect(await countRows(t!.db, 'tournament_events')).toBe(before);
    expect((await read(app, cup.id)).statusCode).toBe(200);
  });

  it('gives the plain match and an unknown match the same 404 as an unknown tournament', async () => {
    const { app, cup, plainMatchId } = await seededWithAuth();
    const unknown = await read(app, 't_nope');
    expect(unknown.statusCode).toBe(404);
    for (const matchId of [plainMatchId, 'm_nope']) {
      const response = await read(app, `${cup.id}/matches/${matchId}`);
      expect(response.statusCode).toBe(404);
      expect(response.body).toBe(unknown.body);
    }
  });
});

describe('same 404 for every hidden tournament', () => {
  it('hides an unknown id, a tournament with sharing off and an archived one the same way', async () => {
    const { app } = await start();
    const { cup, liveMatchId, players } = await cupWithMatches(app);
    await finishCup(app, cup.id, liveMatchId);
    expect((await archive(app, cup.id)).statusCode).toBe(200);
    const league = await createTournament(app, { name: 'Liga testowa', format: 'league', playerIds: players });
    expect((await setSharing(app, league.id, { sharing: false })).statusCode).toBe(200);

    const hidden = [
      await readAll(app, 't_nope', 'm_nope'),
      await readAll(app, league.id, 'm_nope'),
      await readAll(app, cup.id, liveMatchId),
    ].flat();
    const [first] = hidden;
    expect(first?.statusCode).toBe(404);
    expect(ApiError.parse(first?.json())).toEqual({ error: 'not_found', message: 'Not found' });
    for (const response of hidden) {
      expect(response.statusCode).toBe(first?.statusCode);
      expect(response.body).toBe(first?.body);
    }

    expect((await setSharing(app, league.id, { sharing: true })).statusCode).toBe(200);
    const shown = await read(app, league.id);
    expect(shown.statusCode).toBe(200);
    expect(PublicTournamentView.parse(shown.json()).id).toBe(league.id);
  });
});

describe('GET /public/tournaments/:id/matches/:matchId', () => {
  it('returns the summary and legs of an in-progress and a finished match of the tournament', async () => {
    const { app } = await start();
    const { cup, finishedMatchId, liveMatchId } = await cupWithMatches(app);

    const live = PublicTournamentMatch.parse((await read(app, `${cup.id}/matches/${liveMatchId}`)).json());
    expect(live).toMatchObject({ tournamentId: cup.id, fixtureId: 'p-f', label: 'Finał' });
    expect(live.match).toMatchObject({ id: liveMatchId, status: 'in_progress', winnerId: null });
    expect(live.summary).toMatchObject({ matchId: liveMatchId, finished: false, eventSeq: 3 });
    expect(live.legs).toMatchObject({ matchId: liveMatchId, finished: false, eventSeq: 3 });
    expect(live.legs.legs).toHaveLength(1);
    expect(live.legs.legs[0]?.turns).toHaveLength(1);

    const done = PublicTournamentMatch.parse((await read(app, `${cup.id}/matches/${finishedMatchId}`)).json());
    expect(done).toMatchObject({ tournamentId: cup.id, fixtureId: 'p-sf-2' });
    expect(done.match).toMatchObject({ id: finishedMatchId, status: 'finished' });
    expect(done.match.winnerId).not.toBeNull();
    expect(done.summary).toMatchObject({ matchId: finishedMatchId, finished: true });
    expect(done.summary.legs).toHaveLength(1);
    expect(done.legs.legs[0]?.checkout).toBe(121);
  });
});

describe('public redaction', () => {
  it('keeps a stored non-emoji avatar out and passes an emoji through', async () => {
    const { app, db } = await start();
    const { cup, liveMatchId } = await cupWithMatches(app);
    const live = (await app.inject({ method: 'GET', url: `/matches/${liveMatchId}` })).json<{ players: { id: string }[] }>();
    const [first, second] = live.players.map((player) => player.id) as [string, string];
    await db.updateTable('players').set({ avatar: PHOTO }).where('id', '=', first).execute();
    expect((await patchPlayer(app, second, { avatar: '🐙' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/tournaments/${cup.id}` })).body).toContain(PHOTO);

    const view = await read(app, cup.id);
    const match = await read(app, `${cup.id}/matches/${liveMatchId}`);
    for (const response of [view, match]) {
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain(PHOTO);
    }
    const viewPlayers = PublicTournamentView.parse(view.json()).players;
    expect(viewPlayers.find((player) => player.id === first)?.avatar).toBeNull();
    expect(viewPlayers.find((player) => player.id === second)?.avatar).toBe('🐙');
    const matchPlayers = PublicTournamentMatch.parse(match.json()).match.players;
    expect(matchPlayers.find((player) => player.id === first)?.avatar).toBeNull();
    expect(matchPlayers.find((player) => player.id === second)?.avatar).toBe('🐙');
  });

  it('leaves out the private fields of the view, the match and the players', async () => {
    const { app } = await start();
    const { cup, liveMatchId } = await cupWithMatches(app);
    const view = (await read(app, cup.id)).json<Record<string, unknown> & { config: object; players: object[] }>();
    for (const key of ['sharing', 'canRedraw', 'eventSeq', 'archivedAt']) {
      expect(view).not.toHaveProperty(key);
    }
    expect(view.config).toHaveProperty('sharing', true);

    const body = (await read(app, `${cup.id}/matches/${liveMatchId}`)).json<{
      match: Record<string, unknown> & { players: object[] };
      summary: object;
      legs: object;
    }>();
    for (const key of ['eventSeq', 'abandonment', 'tournament']) {
      expect(body.match).not.toHaveProperty(key);
    }
    expect(body.summary).toHaveProperty('eventSeq');
    expect(body.legs).toHaveProperty('eventSeq');

    for (const player of [...view.players, ...body.match.players]) {
      expect(player).not.toHaveProperty('guest');
    }
  });
});

describe('public request limit', () => {
  it('counts 404s, refuses one client over the limit, serves another and recovers after a minute', async () => {
    const { app } = await start();
    const { cup } = await cupWithMatches(app);
    const client = '10.0.0.1';
    for (let i = 0; i < PUBLIC_REQUESTS_PER_MINUTE; i++) {
      const response = await read(app, i % 3 === 0 ? 't_nope' : cup.id, client);
      expect(response.statusCode).toBe(i % 3 === 0 ? 404 : 200);
    }

    const refused = await read(app, cup.id, client);
    expect(refused.statusCode).toBe(429);
    expect(ApiError.parse(refused.json()).error).toBe('too_many_requests');
    expect(refused.headers['retry-after']).toBe('60');

    expect((await read(app, cup.id, '10.0.0.2')).statusCode).toBe(200);

    clock.now += 30_000;
    expect((await read(app, cup.id, client)).headers['retry-after']).toBe('30');
    clock.now += 30_000;
    expect((await read(app, cup.id, client)).statusCode).toBe(200);
  });
});

describe('public response cache', () => {
  it('serves the same body within the TTL and fresh data after it', async () => {
    const { app } = await start();
    const { cup, liveMatchId } = await cupWithMatches(app);
    const url = `${cup.id}/matches/${liveMatchId}`;
    const before = await read(app, url);
    await throwDarts(app, liveMatchId, [MISS]);

    clock.now += PUBLIC_CACHE_TTL_MS - 1;
    expect((await read(app, url)).body).toBe(before.body);

    clock.now += 1;
    const after = PublicTournamentMatch.parse((await read(app, url)).json());
    expect(after.summary.eventSeq).toBe(PublicTournamentMatch.parse(before.json()).summary.eventSeq + 1);
  });

  it('hides all three routes right after sharing is turned off', async () => {
    const { app } = await start();
    const { cup, liveMatchId } = await cupWithMatches(app);
    expect((await readAll(app, cup.id, liveMatchId)).map((response) => response.statusCode)).toEqual([200, 200, 200]);
    expect((await setSharing(app, cup.id, { sharing: false })).statusCode).toBe(200);
    expect((await readAll(app, cup.id, liveMatchId)).map((response) => response.statusCode)).toEqual([404, 404, 404]);
  });

  it('hides the tournament right after it is archived', async () => {
    const { app } = await start();
    const { cup, liveMatchId } = await cupWithMatches(app);
    await finishCup(app, cup.id, liveMatchId);
    expect((await readAll(app, cup.id, liveMatchId)).map((response) => response.statusCode)).toEqual([200, 200, 200]);
    expect((await archive(app, cup.id)).statusCode).toBe(200);
    expect((await readAll(app, cup.id, liveMatchId)).map((response) => response.statusCode)).toEqual([404, 404, 404]);
  });

  it('shows a won leg of a linked match on the next view read', async () => {
    const { app } = await start();
    const { cup, liveMatchId } = await cupWithMatches(app);
    const before = PublicTournamentView.parse((await read(app, cup.id)).json());
    expect(before.fixtures.find((fixture) => fixture.id === 'p-f')?.status).toBe('in_progress');

    await throwDarts(app, liveMatchId, LEG_301.slice(3));
    const after = PublicTournamentView.parse((await read(app, cup.id)).json());
    expect(after.fixtures.find((fixture) => fixture.id === 'p-f')).toMatchObject({ status: 'finished', result: { legs: [1, 0] } });
    expect(after.status).toBe('finished');
  });
});
