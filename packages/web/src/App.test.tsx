import { render, screen } from '@testing-library/react';
import { act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { UNAUTHORIZED_EVENT } from './api/session';
import { publicMatch, publicTournamentMatch, publicTournamentView, snapshot, statLine, tournamentView } from './test/snapshots';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stageLight(): string | null | undefined {
  return document.querySelector('[data-stage-light]')?.getAttribute('data-stage-light');
}

const createdAt = '2026-10-15T18:30:00.000Z';
let urls: string[];

beforeEach(() => {
  urls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      urls.push(url);
      if (url === '/api/players' || url === '/api/players?archived=include') {
        return Promise.resolve(
          json(200, [
            { id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, archivedAt: null, createdAt },
            { id: 'p 2', name: 'Bartek', avatar: null, color: 7, guest: false, archivedAt: null, createdAt },
          ]),
        );
      }
      if (url === '/api/matches?status=unfinished' || url === '/api/matches' || url === '/api/tournaments') {
        return Promise.resolve(json(200, []));
      }
      if (url === '/api/tournaments/t%201') {
        return Promise.resolve(json(200, tournamentView({ id: 't 1', name: 'Liga klubowa' })));
      }
      if (url.startsWith('/api/stats/rankings')) {
        return Promise.resolve(
          json(200, {
            filter: 'all',
            period: 'all',
            games: 0,
            legs: 0,
            players: [],
            bestLegAverage: [],
            highestCheckout: [],
            shortestLeg: [],
            highestTurn: [],
            winRate: [],
            t20Hits: [],
          }),
        );
      }
      return Promise.resolve(
        json(200, { ...statLine(), playerId: 'p1', filter: 'all', period: 'all', matchesPlayed: 0, matchesWon: 0, winRate: null }),
      );
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
    expect(stageLight()).toBe('game');
  });

  it('opens the settings on #/settings', async () => {
    window.location.hash = '#/settings';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Ustawienia' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Ustawienia' });
    expect(link.getAttribute('href')).toBe('#/settings');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(stageLight()).toBe('game');
  });

  it('opens the match history on #/history', async () => {
    window.location.hash = '#/history';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Historia' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Historia' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Brak gier w historii.')).toBeTruthy();
    expect(urls).toContain('/api/matches');
    expect(stageLight()).toBe('list');
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
    expect(await screen.findByRole('heading', { level: 1, name: 'Statystyki' })).toBeTruthy();
    await vi.waitFor(() => expect(urls).toContain('/api/stats/rankings?type=all&period=all'));
    expect(stageLight()).toBe('list');
  });

  it('opens the tournaments on #/tournaments', async () => {
    window.location.hash = '#/tournaments';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Turnieje' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Turniej' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Brak zakończonych turniejów.')).toBeTruthy();
    expect(urls).toContain('/api/tournaments');
    expect(stageLight()).toBe('list');
  });

  it('opens the wizard with Turniej selected on #/tournaments/new', async () => {
    window.location.hash = '#/tournaments/new';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Nowa gra' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turniej' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Rozpocznij turniej' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start gry' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Nowa gra' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Brak gier do dokończenia.')).toBeTruthy();
    expect(urls.some((url) => url.startsWith('/api/tournaments/'))).toBe(false);
    expect(stageLight()).toBe('game');
  });

  it('starts a fresh wizard when moving between #/ and #/tournaments/new', async () => {
    window.location.hash = '#/tournaments/new';
    render(<App />);
    expect(screen.getByRole('button', { name: 'Turniej' }).getAttribute('aria-pressed')).toBe('true');
    act(() => {
      window.location.hash = '#/';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('button', { name: 'Mecz 1v1' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Start gry' })).toBeTruthy();
    expect(await screen.findByText('Brak gier do dokończenia.')).toBeTruthy();
  });

  it('opens the tournament in #/tournaments/:id', async () => {
    // Ekran turnieju otwiera kanał na żywo, a jsdom nie ma WebSocketa.
    vi.stubGlobal(
      'WebSocket',
      class extends EventTarget {
        close(): void {}

        send(): void {}
      },
    );
    window.location.hash = `#/tournaments/${encodeURIComponent('t 1')}`;
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Liga klubowa' })).toBeTruthy();
    expect(urls).toContain('/api/tournaments/t%201');
    expect(screen.getByRole('link', { name: 'Turniej' }).getAttribute('aria-current')).toBe('page');
    expect(stageLight()).toBe('list');
  });

  it('opens the tournament match page in #/tournaments/:id/matches/:matchId', async () => {
    const sockets: string[] = [];
    vi.stubGlobal(
      'WebSocket',
      class extends EventTarget {
        constructor(url: string) {
          super();
          sockets.push(url);
        }

        close(): void {}

        send(): void {}
      },
    );
    window.location.hash = `#/tournaments/${encodeURIComponent('t 1')}/matches/${encodeURIComponent('m/2')}`;
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Turniej' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Turniej' }).getAttribute('aria-current')).toBe('page');
    await vi.waitFor(() => expect(urls).toContain('/api/tournaments/t%201'));
    expect(sockets.some((url) => url.endsWith('/api/matches/m%2F2/live'))).toBe(true);
    expect(screen.getByText('Ładowanie…')).toBeTruthy();
    expect(stageLight()).toBe('list');
  });

  it('opens the statistics of the player in #/stats/:playerId', async () => {
    window.location.hash = `#/stats/${encodeURIComponent('p 2')}`;
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Statystyki' })).toBeTruthy();
    await vi.waitFor(() => expect(urls).toContain('/api/players/p%202/stats?type=all&period=all'));
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
      vi.fn((url: string, init?: RequestInit) => {
        const request = { url, init };
        requests.push(request);
        if (url === '/api/auth/login') {
          return Promise.resolve(json(200, { token: 't1', expiresAt: '2027-04-18T00:00:00.000Z' }));
        }
        if (authorization(request) !== 'Bearer t1') {
          return Promise.resolve(json(401, { error: 'unauthorized', message: 'Missing or invalid token' }));
        }
        return Promise.resolve(json(200, []));
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
    expect(stageLight()).toBe('center');
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
    expect(JSON.parse(login?.init?.body as string)).toEqual({ password: ' secret ' });
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

describe('public routes', () => {
  let requests: { url: string; init: RequestInit | undefined }[];
  let sockets: number;

  beforeEach(() => {
    requests = [];
    sockets = 0;
    localStorage.clear();
    vi.stubGlobal(
      'WebSocket',
      class extends EventTarget {
        constructor() {
          super();
          sockets += 1;
        }

        close(): void {}

        send(): void {}
      },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        requests.push({ url, init });
        if (url === '/api/public/tournaments/t%201') {
          return Promise.resolve(json(200, publicTournamentView(tournamentView({ id: 't 1', name: 'Liga klubowa' }))));
        }
        if (url === '/api/public/tournaments/t%201/matches/m%2F2') {
          return Promise.resolve(json(200, publicTournamentMatch({ tournamentId: 't 1', match: publicMatch(snapshot({ id: 'm/2' })) })));
        }
        // Każde inne zapytanie wymaga logowania, więc prywatny ekran pokazałby tu logowanie.
        return Promise.resolve(json(401, { error: 'unauthorized', message: 'Missing or invalid token' }));
      }),
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  function expectPublicOnly(): void {
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((request) => request.url.startsWith('/api/public/tournaments/'))).toBe(true);
    expect(requests.map((request) => new Headers(request.init?.headers).get('authorization'))).toEqual(requests.map(() => null));
    expect(sockets).toBe(0);
  }

  it('renders the public tournament on #/t/:id without login and without the app navigation', async () => {
    window.location.hash = `#/t/${encodeURIComponent('t 1')}`;
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Liga klubowa' })).toBeTruthy();
    expect(screen.getByText('podgląd publiczny')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Główna nawigacja' })).toBeNull();
    expect(screen.queryByLabelText('Hasło')).toBeNull();
    expect(stageLight()).toBe('list');
    expectPublicOnly();

    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });
    expect(screen.queryByLabelText('Hasło')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Liga klubowa' })).toBeTruthy();
  });

  it('renders the public match on #/t/:id/matches/:matchId without login and without the app navigation', async () => {
    window.location.hash = `#/t/${encodeURIComponent('t 1')}/matches/${encodeURIComponent('m/2')}`;
    render(<App />);
    const back = await screen.findByRole('link', { name: 'Wróć do turnieju Liga klubowa' });
    expect(back.getAttribute('href')).toBe('#/t/t%201');
    expect(screen.queryByRole('navigation', { name: 'Główna nawigacja' })).toBeNull();
    expect(screen.queryByLabelText('Hasło')).toBeNull();
    expect(stageLight()).toBe('list');
    expectPublicOnly();

    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });
    expect(screen.queryByLabelText('Hasło')).toBeNull();
    expect(screen.getByRole('link', { name: 'Wróć do turnieju Liga klubowa' })).toBe(back);
  });

  it('redirects other #/t/ shapes to #/', async () => {
    window.location.hash = '#/t/t1/stats';
    render(<App />);
    await vi.waitFor(() => expect(window.location.hash).toBe('#/'));
  });
});
