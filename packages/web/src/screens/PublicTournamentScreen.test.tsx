import type { Fixture, TournamentView } from '@autoscore/schema';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_POLL_INTERVAL_MS } from '../api/use-public-poll';
import {
  computedView,
  fixture,
  playedResults,
  publicTournamentView,
  tournamentConfig,
  tournamentStats,
  tournamentStatsPlayer,
} from '../test/snapshots';
import { PublicTournamentScreen } from './PublicTournamentScreen';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const NOT_SHARED = 'Ten turniej nie istnieje albo nie jest udostępniony.';
const REFRESH_FAILED = 'Nie udało się odświeżyć wyników. Spróbuję ponownie za chwilę.';

const GROUP_PLAYOFF = tournamentConfig('group_playoff', 6, { advance: 4, name: 'Puchar jesienny' });
const LEAGUE = tournamentConfig('league', 4, { name: 'Liga czwartkowa' });
const CUP = tournamentConfig('cup', 4, { name: 'Puchar zimowy' });

function finishedGroupPlayoff(): TournamentView {
  const view = computedView(GROUP_PLAYOFF, playedResults(GROUP_PLAYOFF));
  // Średnia tylko u Anny, żeby było widać wiersz z nią i bez niej.
  return { ...view, standings: view.standings.map((row) => (row.playerId === 'p1' ? { ...row, average: 47.62 } : row)) };
}

// Liga w trakcie: dwa mecze rozegrane, trzeci trwa, mecz 2 ma wynik poprawiony na 3:2.
function runningLeague(): TournamentView {
  const view = computedView(
    LEAGUE,
    playedResults(LEAGUE, {}, (entry) => entry.number <= 2),
  );
  const fixtures = view.fixtures.map((entry): Fixture => {
    if (entry.number === 2 && entry.result) {
      return { ...entry, result: { ...entry.result, legs: [3, 2], corrected: true } };
    }
    if (entry.number === 3) {
      return { ...entry, status: 'in_progress', matchId: 'm-live' };
    }
    return entry;
  });
  return { ...view, fixtures, liveFixtureId: fixtures.find((entry) => entry.number === 3)?.id ?? null };
}

function statsFor(view: TournamentView) {
  const played = view.fixtures.find((entry) => entry.status === 'finished' && entry.matchId !== null);
  return tournamentStats({
    tournamentId: view.id,
    players: view.players.map((entry) => tournamentStatsPlayer(entry.id)),
    records: {
      highestMatchAverage: null,
      highestCheckout: played ? { playerId: 'p1', fixtureId: played.id, matchId: played.matchId ?? '', value: 121, legIndex: 0 } : null,
      shortestLeg: null,
      highestTurn: null,
    },
  });
}

interface Request {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

let requests: Request[];
let sockets: number;
let tournamentReply: () => Response;
let statsReply: () => Response;

beforeEach(() => {
  requests = [];
  sockets = 0;
  const view = finishedGroupPlayoff();
  tournamentReply = () => json(200, publicTournamentView(view));
  statsReply = () => json(200, statsFor(view));
  // Zapisany token organizatora nie może pójść do publicznego API.
  localStorage.setItem('autoscore.token', 'organizer-token');
  vi.stubGlobal(
    'WebSocket',
    class extends EventTarget {
      constructor() {
        super();
        sockets += 1;
      }
    },
  );
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url === '/api/public/tournaments/t1') {
        return Promise.resolve(tournamentReply());
      }
      if (url === '/api/public/tournaments/t1/stats') {
        return Promise.resolve(statsReply());
      }
      return Promise.resolve(json(404, { error: 'not_found', message: 'Not found' }));
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function wideScreen(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => Object.assign(new EventTarget(), { matches: true })),
  );
}

async function renderScreen(view?: TournamentView): Promise<void> {
  if (view) {
    tournamentReply = () => json(200, publicTournamentView(view));
    statsReply = () => json(200, statsFor(view));
  }
  render(<PublicTournamentScreen tournamentId="t1" />);
  await screen.findByRole('heading', { level: 1 });
}

// findBy czeka na podrobionym setTimeout, więc przy podrobionym zegarze ekran sprawdza vi.waitFor.
async function renderWithFakeTimers(): Promise<void> {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  render(<PublicTournamentScreen tournamentId="t1" />);
  await vi.waitFor(() => screen.getByRole('heading', { level: 1 }));
}

function tabNames(): string[] {
  return within(screen.getByRole('tablist', { name: 'Widok turnieju' }))
    .getAllByRole('tab')
    .map((tab) => tab.textContent ?? '');
}

function openTab(name: string): void {
  fireEvent.click(screen.getByRole('tab', { name }));
}

function matchList(): HTMLElement {
  return screen.getByRole('region', { name: 'Mecze · dotknij, by zobaczyć mecz' });
}

function links(): HTMLAnchorElement[] {
  return Array.from(document.querySelectorAll('a'));
}

describe('PublicTournamentScreen: header and tabs', () => {
  it('shows the preview mark, the name, the meta line and Wyniki first', async () => {
    await renderScreen();
    expect(screen.getByText('podgląd publiczny')).toBeTruthy();
    expect(screen.getByText('AUTO Score')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Puchar jesienny' })).toBeTruthy();
    expect(screen.getByText('Zakończony · Grupa + play-off · 6 graczy · 501')).toBeTruthy();
    expect(tabNames()).toEqual(['Wyniki', 'Grupa', 'Play-off', 'Statystyki']);
    expect(screen.getByRole('tab', { name: 'Wyniki' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('uses the league and the cup tabs and the running status', async () => {
    await renderScreen(runningLeague());
    expect(screen.getByText('W toku · Liga · 4 gracze · 501')).toBeTruthy();
    expect(tabNames()).toEqual(['Wyniki', 'Tabela', 'Statystyki']);
  });

  it('shows Drabinka in a cup', async () => {
    await renderScreen(computedView(CUP));
    expect(tabNames()).toEqual(['Wyniki', 'Drabinka', 'Statystyki']);
  });

  it('has no button other than the tabs on the results, table and bracket tabs', async () => {
    await renderScreen();
    for (const tab of ['Wyniki', 'Grupa', 'Play-off']) {
      openTab(tab);
      expect(screen.queryAllByRole('button')).toEqual([]);
      expect(tabNames()).toEqual(['Wyniki', 'Grupa', 'Play-off', 'Statystyki']);
    }
  });

  it('has no write action and no private link on any tab', async () => {
    wideScreen();
    await renderScreen(runningLeague());
    for (const tab of ['Wyniki', 'Tabela', 'Statystyki']) {
      openTab(tab);
      await screen.findByRole('tab', { name: tab, selected: true });
      for (const name of [/Zagraj/, /Losuj ponownie/, /Popraw wynik/, /Wycofaj gracza/, /Udostępnij/]) {
        expect(screen.queryByRole('button', { name })).toBeNull();
        expect(screen.queryByRole('link', { name })).toBeNull();
      }
      expect(links().filter((link) => !(link.getAttribute('href') ?? '').startsWith('#/t/'))).toEqual([]);
    }
  });
});

describe('PublicTournamentScreen: data sources', () => {
  it('fetches only the public API, without the stored token and without a socket', async () => {
    await renderScreen();
    openTab('Statystyki');
    await screen.findByRole('heading', { name: 'Gracze w turnieju' });
    expect(requests.map((request) => request.url)).toEqual(['/api/public/tournaments/t1', '/api/public/tournaments/t1/stats']);
    expect(requests.every((request) => request.url.startsWith('/api/public/tournaments/'))).toBe(true);
    expect(requests.map((request) => new Headers(request.init?.headers).get('authorization'))).toEqual([null, null]);
    expect(sockets).toBe(0);
  });

  it('polls the view every 10 s and fetches the stats again for every polled view', async () => {
    await renderWithFakeTimers();
    openTab('Statystyki');
    await vi.waitFor(() => expect(requests.filter((request) => request.url.endsWith('/stats'))).toHaveLength(1));
    const views = () => requests.filter((request) => request.url === '/api/public/tournaments/t1');
    expect(views()).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUBLIC_POLL_INTERVAL_MS);
    });
    expect(views()).toHaveLength(2);
    await vi.waitFor(() => expect(requests.filter((request) => request.url.endsWith('/stats'))).toHaveLength(2));
  });
});

describe('PublicTournamentScreen: results', () => {
  it('shows the podium with places as text, shared places twice and the group average', async () => {
    const view = finishedGroupPlayoff();
    await renderScreen(view);
    const podium = screen.getByRole('region', { name: 'Podium' });
    const rows = within(podium).getAllByRole('listitem');
    const expected = view.placements.filter((entry) => entry.place <= 3);
    expect(rows).toHaveLength(expected.length);
    expect(rows.map((row) => row.textContent?.match(/^\d+\./)?.[0])).toEqual(expected.map((entry) => `${entry.place}.`));
    const anna = rows.find((row) => row.textContent?.includes('Anna'));
    expect(anna?.textContent).toContain('śr. 47,62');
    expect(rows.filter((row) => row.textContent?.includes('śr.'))).toHaveLength(anna ? 1 : 0);
  });

  it('has no podium while the tournament runs', async () => {
    await renderScreen(runningLeague());
    expect(screen.queryByRole('region', { name: 'Podium' })).toBeNull();
  });

  it('lists the started matches from the last one, with legs, the live tag, the corrected mark and the winner', async () => {
    const view = runningLeague();
    await renderScreen(view);
    const items = within(matchList()).getAllByRole('listitem');
    const started = view.fixtures.filter((entry) => entry.matchId !== null).sort((first, second) => second.number - first.number);
    expect(items).toHaveLength(started.length);
    const hrefs = items.map((item) => within(item).getByRole('link').getAttribute('href'));
    expect(hrefs).toEqual(started.map((entry) => `#/t/t1/matches/${entry.matchId ?? ''}`));

    const live = items[0];
    expect(live?.textContent).toContain('Liga, mecz 3');
    expect(live?.textContent).toContain('na żywo');
    expect(live?.textContent).not.toContain('zwycięzca');

    const corrected = items[1];
    expect(corrected?.textContent).toContain('Liga, mecz 2');
    expect(corrected?.textContent).toContain('wynik poprawiony');
    expect(
      within(corrected as HTMLElement)
        .getByText('popr.')
        .getAttribute('aria-hidden'),
    ).toBe('true');
    expect(within(corrected as HTMLElement).getByText('3')).toBeTruthy();
    expect(within(corrected as HTMLElement).getByText('2')).toBeTruthy();
    const winner = within(corrected as HTMLElement).getByText('zwycięzca', { exact: false });
    const correctedFixture = view.fixtures.find((entry) => entry.number === 2);
    const winnerName = view.players.find((entry) => entry.id === correctedFixture?.result?.winnerId)?.name ?? '';
    expect(winner.parentElement?.textContent).toBe(`${winnerName} zwycięzca`);
  });

  it('leaves walkovers out and says when no match has started', async () => {
    // Walkower z meczem przerwanym przez wycofanie gracza też ma matchId, a i tak nie trafia na listę.
    const walkover = fixture({ status: 'walkover', matchId: 'm-wo', result: { legs: [3, 0], winnerId: 'p1', corrected: false } });
    await renderScreen({ ...computedView(LEAGUE), fixtures: [walkover, fixture({ id: 'g-2', number: 2 })] });
    expect(within(matchList()).queryAllByRole('listitem')).toEqual([]);
    expect(within(matchList()).getByText('Żaden mecz jeszcze się nie zaczął.')).toBeTruthy();
  });

  it('shows the short group table on the results tab even on a wide screen', async () => {
    wideScreen();
    await renderScreen();
    const table = screen.getByRole('table', { name: 'Faza grupowa' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toHaveLength(5);
  });

  it('has no table on the results tab of a cup', async () => {
    await renderScreen(computedView(CUP));
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('PublicTournamentScreen: match links', () => {
  it('points every match link on every tab to the public match page', async () => {
    wideScreen();
    const view = finishedGroupPlayoff();
    await renderScreen(view);
    const perTab: Record<string, string[]> = {};
    for (const tab of ['Wyniki', 'Grupa', 'Play-off', 'Statystyki']) {
      openTab(tab);
      if (tab === 'Statystyki') {
        await screen.findByRole('heading', { name: 'Gracze w turnieju' });
      }
      perTab[tab] = links().map((link) => link.getAttribute('href') ?? '');
    }
    for (const [tab, hrefs] of Object.entries(perTab)) {
      expect(hrefs.length, tab).toBeGreaterThan(0);
      expect(
        hrefs.every((href) => href.startsWith('#/t/t1/matches/')),
        tab,
      ).toBe(true);
    }
    // Komórka tabeli krzyżowej i rekord też prowadzą do publicznej strony meczu.
    const groupMatch = view.fixtures.find((entry) => entry.phase === 'group' && entry.status === 'finished');
    expect(perTab.Grupa).toContain(`#/t/t1/matches/${groupMatch?.matchId ?? ''}`);
    expect(perTab.Statystyki).toContain(`#/t/t1/matches/${statsFor(view).records.highestCheckout?.matchId ?? ''}`);
  });

  it('puts the cross table in its own scrollable frame from sm', async () => {
    wideScreen();
    await renderScreen();
    openTab('Grupa');
    const frame = screen.getByRole('region', { name: 'Faza grupowa' });
    expect(frame.getAttribute('tabindex')).toBe('0');
    expect(within(frame).getByRole('table', { name: 'Faza grupowa' })).toBeTruthy();
  });

  it('shows the bracket and the final placements on the play-off tab', async () => {
    await renderScreen();
    openTab('Play-off');
    expect(screen.getByRole('heading', { name: 'Drabinka' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Klasyfikacja końcowa' })).toBeTruthy();
  });
});

describe('PublicTournamentScreen: states', () => {
  it('shows the loading text first', () => {
    render(<PublicTournamentScreen tournamentId="t1" />);
    expect(screen.getByText('Ładowanie…')).toBeTruthy();
  });

  it('shows only the not shared notice on 404', async () => {
    tournamentReply = () => json(404, { error: 'not_found', message: 'Not found' });
    render(<PublicTournamentScreen tournamentId="t1" />);
    expect((await screen.findByRole('alert')).textContent).toBe(NOT_SHARED);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('main').textContent).toBe(NOT_SHARED);
  });

  it('shows the load error when the first request fails', async () => {
    tournamentReply = () => json(429, { error: 'too_many_requests', message: 'Too many requests' });
    render(<PublicTournamentScreen tournamentId="t1" />);
    expect((await screen.findByRole('alert')).textContent).toBe('Nie udało się pobrać turnieju');
  });

  it('keeps the last data under a soft notice after a failed refresh', async () => {
    await renderWithFakeTimers();
    tournamentReply = () => json(429, { error: 'too_many_requests', message: 'Too many requests' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUBLIC_POLL_INTERVAL_MS);
    });
    const notice = await vi.waitFor(() => screen.getByText(REFRESH_FAILED));
    const heading = screen.getByRole('heading', { level: 1, name: 'Puchar jesienny' });
    expect(notice.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
