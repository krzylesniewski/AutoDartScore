import type { TournamentLiveMessage, TournamentView } from '@autoscore/schema';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture, tournamentView } from '../test/snapshots';
import { RECONNECT_DELAY_MS } from './use-match';
import { useTournament } from './use-tournament';

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  closed = false;
  sent: string[] = [];

  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  serverOpen(): void {
    act(() => {
      this.dispatchEvent(new Event('open'));
    });
  }

  serverSend(message: TournamentLiveMessage | { type: string }): void {
    act(() => {
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
    });
  }

  serverClose(code: number): void {
    act(() => {
      this.dispatchEvent(new CloseEvent('close', { code }));
    });
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function updated(view: TournamentView): TournamentLiveMessage {
  return { type: 'tournament_updated', tournamentId: view.id, eventSeq: view.eventSeq, tournament: view };
}

function socket(): FakeWebSocket {
  const last = FakeWebSocket.instances.at(-1);
  if (!last) {
    throw new Error('No socket');
  }
  return last;
}

let urls: string[];
let reply: () => Response;

beforeEach(() => {
  urls = [];
  FakeWebSocket.instances = [];
  reply = () => json(200, tournamentView({ eventSeq: 5 }));
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      urls.push(url);
      return Promise.resolve(reply());
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('useTournament', () => {
  it('loads the view and then follows the socket', async () => {
    localStorage.setItem('autoscore.token', 'secret');
    const { result } = renderHook(() => useTournament('t 1'));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(urls).toEqual(['/api/tournaments/t%201']);
    expect(socket().url).toMatch(/\/api\/tournaments\/t%201\/live$/);

    socket().serverOpen();
    expect(socket().sent.map((data) => JSON.parse(data) as unknown)).toEqual([{ type: 'auth', token: 'secret' }]);
    expect(result.current.connection).toBe('open');

    socket().serverSend(updated(tournamentView({ eventSeq: 6, name: 'Liga piątkowa' })));
    expect(result.current.view?.name).toBe('Liga piątkowa');
  });

  it('ignores an older eventSeq and applies an equal one', async () => {
    const { result } = renderHook(() => useTournament('t1'));
    await waitFor(() => expect(result.current.view?.eventSeq).toBe(5));

    socket().serverSend(updated(tournamentView({ eventSeq: 4, name: 'Starsza' })));
    expect(result.current.view?.name).toBe('Liga czwartkowa');

    const legChange = fixture({ status: 'in_progress', matchId: 'm1' });
    socket().serverSend(updated(tournamentView({ eventSeq: 5, fixtures: [legChange], liveFixtureId: 'g-1', nextFixtureId: null })));
    expect(result.current.view?.fixtures[0]?.status).toBe('in_progress');

    act(() => {
      result.current.accept(tournamentView({ eventSeq: 3, name: 'Odpowiedź komendy' }));
    });
    expect(result.current.view?.liveFixtureId).toBe('g-1');
  });

  it('drops messages that do not parse', async () => {
    const { result } = renderHook(() => useTournament('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    socket().serverSend({ type: 'state_updated' });
    act(() => {
      socket().dispatchEvent(new MessageEvent('message', { data: 'not json' }));
    });
    expect(result.current.view?.eventSeq).toBe(5);
  });

  it('gives not_found on a 404 and on the 4404 close code', async () => {
    reply = () => json(404, { error: 'not_found', message: 'Tournament not found' });
    const first = renderHook(() => useTournament('t0'));
    await waitFor(() => expect(first.result.current.status).toBe('not_found'));
    first.unmount();

    reply = () => json(200, tournamentView());
    const second = renderHook(() => useTournament('t1'));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    socket().serverClose(4404);
    expect(second.result.current.status).toBe('not_found');
  });

  it('gives error on other load failures', async () => {
    reply = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    const { result } = renderHook(() => useTournament('t1'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.view).toBeNull();
  });

  it('runs the GET again on reload', async () => {
    const { result } = renderHook(() => useTournament('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    reply = () => json(200, tournamentView({ eventSeq: 9, canRedraw: false }));
    act(() => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.view?.eventSeq).toBe(9));
    expect(urls).toEqual(['/api/tournaments/t1', '/api/tournaments/t1']);
  });

  it('reconnects after RECONNECT_DELAY_MS once the socket closes', async () => {
    const { result } = renderHook(() => useTournament('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    vi.useFakeTimers();
    socket().serverOpen();
    socket().serverClose(1006);
    expect(result.current.connection).toBe('closed');
    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(RECONNECT_DELAY_MS - 1);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(result.current.connection).toBe('connecting');
  });

  it('closes the socket and stops reconnecting on unmount', async () => {
    const { result, unmount } = renderHook(() => useTournament('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    vi.useFakeTimers();
    const first = socket();
    first.serverClose(1006);
    unmount();
    act(() => {
      vi.advanceTimersByTime(RECONNECT_DELAY_MS);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(first.closed).toBe(true);
  });
});
