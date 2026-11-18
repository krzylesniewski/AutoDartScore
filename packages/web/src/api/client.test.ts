import { CreateTournamentRequest } from '@autoscore/schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  matchLeg,
  matchLegs,
  publicTournamentMatch,
  publicTournamentView,
  scoredTurns,
  snapshot,
  tournamentListItem,
  tournamentStats,
  tournamentStatsPlayer,
  tournamentView,
} from '../test/snapshots';
import {
  ApiRequestError,
  REQUEST_TIMEOUT_MS,
  StaleStateRequestError,
  archiveTournament,
  correctResult,
  createTournament,
  getMatch,
  getMatchLegs,
  getPublicTournament,
  getPublicTournamentMatch,
  getPublicTournamentStats,
  getTournament,
  getTournamentStats,
  listTournaments,
  redrawTournament,
  setTournamentSharing,
  startFixture,
  undo,
  withdrawPlayer,
} from './client';
import { UNAUTHORIZED_EVENT, clearToken, readToken, saveToken } from './session';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('409 replies', () => {
  it('rejects a stale_state body with StaleStateRequestError carrying the parsed state', async () => {
    const state = snapshot({ id: 'm1', eventSeq: 9 });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(409, { error: 'stale_state', message: 'Match state changed', state }))),
    );
    const caught: unknown = await undo('m1', 7).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(StaleStateRequestError);
    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).toMatchObject({
      name: 'StaleStateRequestError',
      status: 409,
      code: 'stale_state',
      message: 'Match state changed',
      state,
    });
  });

  it('rejects a 409 with another code with a plain ApiRequestError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(409, { error: 'nothing_to_undo', message: 'Match has no throw to undo' }))),
    );
    const caught: unknown = await undo('m1', 7).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).not.toBeInstanceOf(StaleStateRequestError);
    expect(caught).toMatchObject({ status: 409, code: 'nothing_to_undo' });
  });
});

describe('undo request', () => {
  function stubUndo() {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(json(200, { undoneThrowId: 't1', state: snapshot({ id: 'm1', eventSeq: 8 }) })),
    );
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('sends no body without expectedSeq', async () => {
    const fetch = stubUndo();
    await undo('m1');
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });

  it('sends expectedSeq as JSON', async () => {
    const fetch = stubUndo();
    await undo('m1', 7);
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ expectedSeq: 7 });
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('tournament requests', () => {
  function stub(body: unknown, status = 200) {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(json(status, body)));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('creates a tournament with a JSON POST', async () => {
    const view = tournamentView({ id: 't9' });
    const fetch = stub(view, 201);
    const body = CreateTournamentRequest.parse({ name: 'Puchar', format: 'cup', playerIds: ['p1', 'p2', 'p3'] });
    expect(await createTournament(body)).toEqual(view);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/tournaments');
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(body);
  });

  it('lists tournaments with and without a query', async () => {
    const fetch = stub([tournamentListItem({ status: 'finished', finishedAt: '2026-11-12T21:00:00.000Z' })]);
    const items = await listTournaments();
    expect(items.map((item) => item.id)).toEqual(['t1']);
    await listTournaments({ status: 'finished', archived: 'include' });
    expect(fetch.mock.calls.map((call) => call[0])).toEqual(['/api/tournaments', '/api/tournaments?status=finished&archived=include']);
  });

  it('gets one tournament by the encoded id', async () => {
    const fetch = stub(tournamentView({ id: 't 1' }));
    expect((await getTournament('t 1')).id).toBe('t 1');
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/tournaments/t%201');
  });

  it('gets the tournament stats by the encoded id and parses them', async () => {
    const stats = tournamentStats({ tournamentId: 't 1', players: [tournamentStatsPlayer('p1', { won: 2, legsFor: 6 })] });
    const fetch = stub(stats);
    expect(await getTournamentStats('t 1')).toEqual(stats);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/tournaments/t%201/stats');
  });

  it('rejects tournament stats that do not match the schema', async () => {
    stub({ ...tournamentStats(), players: [{ playerId: 'p1' }] });
    await expect(getTournamentStats('t1')).rejects.toThrow();
  });

  it('gets the match legs by the encoded id and parses them', async () => {
    const legs = matchLegs([matchLeg({ turns: scoredTurns('p1', [60]) })], { matchId: 'm 1', eventSeq: 3 });
    const fetch = stub(legs);
    expect(await getMatchLegs('m 1')).toEqual(legs);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/matches/m%201/legs');
  });

  it('rejects match legs that do not match the schema', async () => {
    stub({ ...matchLegs(), legs: [{ ...matchLeg(), winnerId: 'p1' }] });
    await expect(getMatchLegs('m1')).rejects.toThrow();
  });

  it('rejects an unknown tournament with a 404 ApiRequestError', async () => {
    stub({ error: 'not_found', message: 'Tournament not found' }, 404);
    const caught: unknown = await getTournament('t0').catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).toMatchObject({ status: 404, code: 'not_found' });
  });

  it('rejects a second tournament with tournament_active', async () => {
    stub({ error: 'tournament_active', message: 'Another tournament is in progress' }, 409);
    const body = CreateTournamentRequest.parse({ name: 'Puchar', format: 'cup', playerIds: ['p1', 'p2', 'p3'] });
    const caught: unknown = await createTournament(body).catch((error: unknown) => error);
    expect(caught).toMatchObject({ status: 409, code: 'tournament_active' });
  });

  it('starts a fixture with encoded path segments and expectedSeq', async () => {
    const view = tournamentView({ id: 't 1' });
    const fetch = stub({ matchId: 'm7', tournament: view }, 201);
    expect(await startFixture('t 1', 'g/1', 12)).toEqual({ matchId: 'm7', tournament: view });
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/tournaments/t%201/fixtures/g%2F1/start');
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ expectedSeq: 12 });
  });

  it('starts a fixture without a body when expectedSeq is missing', async () => {
    const fetch = stub({ matchId: 'm7', tournament: tournamentView() });
    await startFixture('t1', 'g-1');
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/tournaments/t1/fixtures/g-1/start');
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });

  it('redraws a tournament with and without expectedSeq', async () => {
    const view = tournamentView({ id: 't 1', eventSeq: 2 });
    const fetch = stub(view);
    expect(await redrawTournament('t 1', 1)).toEqual(view);
    await redrawTournament('t 1');
    expect(fetch.mock.calls.map((call) => call[0])).toEqual(['/api/tournaments/t%201/draw', '/api/tournaments/t%201/draw']);
    const [first, second] = fetch.mock.calls.map((call) => call[1]);
    expect(first?.method).toBe('POST');
    expect(JSON.parse(first?.body as string)).toEqual({ expectedSeq: 1 });
    expect(second?.method).toBe('POST');
    expect(second?.body).toBeUndefined();
  });

  it('withdraws a player with encoded ids, with and without expectedSeq', async () => {
    const view = tournamentView({ id: 't 1', eventSeq: 3 });
    const fetch = stub(view, 201);
    expect(await withdrawPlayer('t 1', 'p/2', 2)).toEqual(view);
    await withdrawPlayer('t 1', 'p/2');
    expect(fetch.mock.calls.map((call) => call[0])).toEqual(['/api/tournaments/t%201/withdrawals', '/api/tournaments/t%201/withdrawals']);
    const [first, second] = fetch.mock.calls.map((call) => call[1]);
    expect(first?.method).toBe('POST');
    expect(JSON.parse(first?.body as string)).toEqual({ playerId: 'p/2', expectedSeq: 2 });
    expect(second?.method).toBe('POST');
    expect(Object.keys(JSON.parse(second?.body as string) as object)).toEqual(['playerId']);
  });

  it('corrects a result with the legs in slot order, with and without expectedSeq', async () => {
    const view = tournamentView({ id: 't 1', eventSeq: 4 });
    const fetch = stub(view);
    expect(await correctResult('t 1', 'g/7', [1, 3], 3)).toEqual(view);
    await correctResult('t 1', 'g/7', [3, 2]);
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      '/api/tournaments/t%201/fixtures/g%2F7/result',
      '/api/tournaments/t%201/fixtures/g%2F7/result',
    ]);
    const [first, second] = fetch.mock.calls.map((call) => call[1]);
    expect(first?.method).toBe('POST');
    expect(JSON.parse(first?.body as string)).toEqual({ legs: [1, 3], expectedSeq: 3 });
    expect(second?.method).toBe('POST');
    expect(JSON.parse(second?.body as string)).toEqual({ legs: [3, 2] });
  });

  it('archives a tournament with and without expectedSeq', async () => {
    const view = tournamentView({
      id: 't 1',
      status: 'finished',
      finishedAt: '2026-11-12T21:00:00.000Z',
      archivedAt: '2026-11-13T10:00:00.000Z',
    });
    const fetch = stub(view);
    expect(await archiveTournament('t 1', 9)).toEqual(view);
    await archiveTournament('t 1');
    expect(fetch.mock.calls.map((call) => call[0])).toEqual(['/api/tournaments/t%201/archive', '/api/tournaments/t%201/archive']);
    const [first, second] = fetch.mock.calls.map((call) => call[1]);
    expect(first?.method).toBe('POST');
    expect(JSON.parse(first?.body as string)).toEqual({ expectedSeq: 9 });
    expect(second?.method).toBe('POST');
    expect(second?.body).toBeUndefined();
  });

  it('rejects a stale tournament command with a plain stale_state ApiRequestError', async () => {
    stub({ error: 'stale_state', message: 'Tournament state changed', tournament: tournamentView({ eventSeq: 5 }) }, 409);
    const caught: unknown = await redrawTournament('t1', 4).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).not.toBeInstanceOf(StaleStateRequestError);
    expect(caught).toMatchObject({ status: 409, code: 'stale_state' });
  });
});

describe('request time limit', () => {
  it('passes a timeout signal to fetch', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(new Response(JSON.stringify(snapshot({ id: 'm1' })), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetch);
    await getMatch('m1');
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
    expect(signal).toBe(timeout.mock.results[0]?.value);
  });

  it('rejects a timed out request with an error that is not ApiRequestError', async () => {
    const timedOut = new DOMException('timeout', 'TimeoutError');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(timedOut)),
    );
    const caught: unknown = await getMatch('m1').catch((error: unknown) => error);
    expect(caught).toBe(timedOut);
    expect(caught).not.toBeInstanceOf(ApiRequestError);
  });
});

describe('public tournament requests', () => {
  function stubPublic(status = 200) {
    const fetch = vi.fn<typeof globalThis.fetch>((input) => {
      const url = typeof input === 'string' ? input : '';
      if (status !== 200) {
        return Promise.resolve(json(status, { error: status === 401 ? 'unauthorized' : 'not_found', message: 'Nope' }));
      }
      if (url.endsWith('/stats')) {
        return Promise.resolve(json(200, tournamentStats({ tournamentId: 't 1' })));
      }
      if (url.includes('/matches/')) {
        return Promise.resolve(json(200, publicTournamentMatch({ tournamentId: 't 1' })));
      }
      return Promise.resolve(json(200, publicTournamentView(tournamentView({ id: 't 1' }))));
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  afterEach(() => {
    clearToken();
  });

  it('gets the public view, stats and match by encoded ids', async () => {
    const fetch = stubPublic();
    const view = await getPublicTournament('t 1');
    const stats = await getPublicTournamentStats('t 1');
    const match = await getPublicTournamentMatch('t 1', 'm/2');
    expect([view.id, stats.tournamentId, match.tournamentId]).toEqual(['t 1', 't 1', 't 1']);
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      '/api/public/tournaments/t%201',
      '/api/public/tournaments/t%201/stats',
      '/api/public/tournaments/t%201/matches/m%2F2',
    ]);
  });

  it('never sends the stored token', async () => {
    saveToken('t1');
    const fetch = stubPublic();
    await getPublicTournament('t 1');
    await getPublicTournamentStats('t 1');
    await getPublicTournamentMatch('t 1', 'm1');
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const call of fetch.mock.calls) {
      expect(new Headers(call[1]?.headers).get('authorization')).toBeNull();
    }
  });

  it.each([401, 404])('rejects a public %i without the unauthorized event and keeps the token', async (status) => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const listener = vi.fn();
    target.addEventListener(UNAUTHORIZED_EVENT, listener);
    saveToken('t1');
    stubPublic(status);
    const caught: unknown = await getPublicTournament('t1').catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).toMatchObject({ status });
    expect(listener).not.toHaveBeenCalled();
    expect(readToken()).toBe('t1');
  });

  it('switches sharing with an authenticated JSON POST, with and without expectedSeq', async () => {
    saveToken('t1');
    const view = tournamentView({ id: 't 1', sharing: false, eventSeq: 4 });
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(json(200, view)));
    vi.stubGlobal('fetch', fetch);
    expect(await setTournamentSharing('t 1', false, 3)).toEqual(view);
    await setTournamentSharing('t 1', true);
    expect(fetch.mock.calls.map((call) => call[0])).toEqual(['/api/tournaments/t%201/sharing', '/api/tournaments/t%201/sharing']);
    const [first, second] = fetch.mock.calls.map((call) => call[1]);
    expect(first?.method).toBe('POST');
    expect(new Headers(first?.headers).get('authorization')).toBe('Bearer t1');
    expect(JSON.parse(first?.body as string)).toEqual({ sharing: false, expectedSeq: 3 });
    expect(JSON.parse(second?.body as string)).toEqual({ sharing: true });
  });
});
