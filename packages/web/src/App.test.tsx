import { render, screen } from '@testing-library/react';
import { act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { statLine } from './test/snapshots';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const createdAt = '2026-10-15T18:30:00.000Z';
let urls: string[];

beforeEach(() => {
  urls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url);
      if (url === '/api/players' || url === '/api/players?archived=include') {
        return json(200, [
          { id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, archivedAt: null, createdAt },
          { id: 'p 2', name: 'Bartek', avatar: null, color: 7, guest: false, archivedAt: null, createdAt },
        ]);
      }
      if (url === '/api/matches?status=unfinished' || url === '/api/matches') {
        return json(200, []);
      }
      if (url.startsWith('/api/stats/rankings')) {
        return json(200, { filter: 'all', games: 0, legs: 0, players: [], bestLegAverage: [], highestCheckout: [], shortestLeg: [], highestTurn: [] });
      }
      return json(200, { ...statLine(), playerId: 'p1', filter: 'all', matchesPlayed: 0, matchesWon: 0 });
    }),
  );
});

afterEach(() => {
  window.location.hash = '';
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders the start screen at #/', async () => {
    window.location.hash = '#/';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Nowa gra' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start gry' })).toBeTruthy();
    expect(await screen.findByText('Brak gier do dokończenia.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Statystyki' }).getAttribute('href')).toBe('#/stats');
    expect(screen.getByRole('link', { name: 'Historia' }).getAttribute('href')).toBe('#/history');
  });

  it('opens the match history on #/history', async () => {
    window.location.hash = '#/history';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Historia' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Historia' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Brak gier w historii.')).toBeTruthy();
    expect(urls).toContain('/api/matches');
  });

  it('renders the start screen without a hash', async () => {
    window.location.hash = '';
    render(<App />);
    expect(await screen.findByText('Brak gier do dokończenia.')).toBeTruthy();
  });

  it('redirects #/new to #/', async () => {
    window.location.hash = '#/new';
    render(<App />);
    await vi.waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Nowa gra' })).toBeTruthy();
  });

  it('opens the ranking on #/stats', async () => {
    window.location.hash = '#/stats';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Statystyki' })).toBeTruthy();
    await vi.waitFor(() => expect(urls).toContain('/api/stats/rankings?type=all'));
  });

  it('opens the statistics of the player in #/stats/:playerId', async () => {
    window.location.hash = `#/stats/${encodeURIComponent('p 2')}`;
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Statystyki' })).toBeTruthy();
    await vi.waitFor(() => expect(urls).toContain('/api/players/p%202/stats?type=all'));
    expect((await screen.findByRole('button', { name: 'Bartek' })).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('login', () => {
  interface Request {
    readonly url: string;
    readonly init: RequestInit | undefined;
  }

  class FakeWebSocket extends EventTarget {
    static instances: FakeWebSocket[] = [];

    constructor() {
      super();
      FakeWebSocket.instances.push(this);
    }

    close(): void {}

    send(): void {}
  }

  // jsdom nie odtwarza mediów, a ekran gry tworzy Audio przy montowaniu.
  class FakeAudio {
    currentTime = 0;
    preload = '';

    play(): Promise<void> {
      return Promise.resolve();
    }

    pause(): void {}

    load(): void {}

    addEventListener(): void {}
  }

  let requests: Request[];

  function authorization(request: Request | undefined): string | null {
    return new Headers(request?.init?.headers).get('authorization');
  }

  beforeEach(() => {
    requests = [];
    FakeWebSocket.instances = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const request = { url, init };
        requests.push(request);
        if (url === '/api/auth/login') {
          return json(200, { token: 't1', expiresAt: '2027-04-18T00:00:00.000Z' });
        }
        if (authorization(request) !== 'Bearer t1') {
          return json(401, { error: 'unauthorized', message: 'Missing or invalid token' });
        }
        return json(200, []);
      }),
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  function logIn(password: string): void {
    fireEvent.change(screen.getByLabelText('Hasło'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Zaloguj' }));
  }

  it('shows the login screen on 401 unauthorized', async () => {
    window.location.hash = '#/';
    render(<App />);
    expect(await screen.findByLabelText('Hasło')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zaloguj' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Nowa gra' })).toBeNull();
  });

  it('brings back the same screen after login and sends the token', async () => {
    window.location.hash = '#/';
    render(<App />);
    await screen.findByLabelText('Hasło');
    const before = requests.length;
    logIn('secret');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nowa gra' })).toBeTruthy();
    expect(localStorage.getItem('autoscore.token')).toBe('t1');
    expect(window.location.hash).toBe('#/');
    await vi.waitFor(() => expect(requests.length).toBeGreaterThan(before + 1));
    const after = requests.slice(before + 1);
    expect(after.map((request) => authorization(request))).toEqual(after.map(() => 'Bearer t1'));
  });

  it('posts the typed password without an Authorization header', async () => {
    window.location.hash = '#/';
    render(<App />);
    await screen.findByLabelText('Hasło');
    logIn(' secret ');
    await vi.waitFor(() => expect(requests.some((request) => request.url === '/api/auth/login')).toBe(true));
    const login = requests.find((request) => request.url === '/api/auth/login');
    expect(login?.init?.method).toBe('POST');
    expect(JSON.parse(String(login?.init?.body))).toEqual({ password: ' secret ' });
    expect(authorization(login)).toBeNull();
  });

  it('removes an expired token and shows the login screen', async () => {
    localStorage.setItem('autoscore.token', 'old');
    window.location.hash = '#/';
    render(<App />);
    expect(await screen.findByLabelText('Hasło')).toBeTruthy();
    expect(authorization(requests[0])).toBe('Bearer old');
    expect(localStorage.getItem('autoscore.token')).toBeNull();
  });

  it('shows the login screen when the live socket closes with 4401', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('Audio', FakeAudio);
    window.location.hash = '#/matches/m1';
    render(<App />);
    expect(screen.queryByLabelText('Hasło')).toBeNull();
    act(() => {
      FakeWebSocket.instances.at(-1)?.dispatchEvent(new CloseEvent('close', { code: 4401 }));
    });
    expect(screen.getByLabelText('Hasło')).toBeTruthy();
  });
});
