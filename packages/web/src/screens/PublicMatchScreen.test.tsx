import type { Fixture, PublicTournamentMatch, TournamentView } from '@autoscore/schema';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_POLL_INTERVAL_MS } from '../api/use-public-poll';
import {
  fixture,
  matchLeg,
  matchLegs,
  player,
  publicMatch,
  publicTournamentMatch,
  publicTournamentView,
  snapshot,
  summary,
  summaryPlayer,
  tournamentView,
} from '../test/snapshots';
import { PublicMatchScreen } from './PublicMatchScreen';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const notFound = () => json(404, { error: 'not_found', message: 'Not found' });

const MATCH_ID = 'm-f';
const TOURNAMENT_URL = '/api/public/tournaments/t1';
const MATCH_URL = `/api/public/tournaments/t1/matches/${MATCH_ID}`;

function finalFixture(overrides: Partial<Fixture> = {}): Fixture {
  return fixture({
    id: 'p-f',
    number: 20,
    phase: 'playoff',
    round: 1,
    bracketRound: 'final',
    legsToWin: 4,
    slots: [
      { kind: 'player', playerId: 'p1', seed: 1 },
      { kind: 'player', playerId: 'p2', seed: 2 },
    ],
    status: 'finished',
    matchId: MATCH_ID,
    result: { legs: [4, 2], winnerId: 'p1', corrected: false },
    ...overrides,
  });
}

function cupView(final: Fixture = finalFixture()): TournamentView {
  return tournamentView({ name: 'Puchar jesienny', format: 'cup', fixtures: [final], nextFixtureId: null, standings: [] });
}

// Finał rozegrany 4:2 dla Anny.
function finalMatch(overrides: Partial<PublicTournamentMatch> = {}): PublicTournamentMatch {
  const legs = [0, 1, 2, 3, 4, 5].map((legIndex) =>
    matchLeg({
      legIndex,
      starterId: legIndex % 2 === 0 ? 'p1' : 'p2',
      winnerId: [1, 4].includes(legIndex) ? 'p2' : 'p1',
      checkout: 40,
      dartsThrown: 18,
    }),
  );
  return publicTournamentMatch({
    fixtureId: 'p-f',
    label: 'Finał',
    match: publicMatch(
      snapshot({
        id: MATCH_ID,
        status: 'finished',
        finished: true,
        legsToWin: 4,
        startedAt: '2026-11-16T20:14:00.000Z',
        finishedAt: '2026-11-16T20:52:00.000Z',
        currentPlayerId: null,
        players: [player('p1', 'Anna', { legsWon: 4 }), player('p2', 'Bartek', { legsWon: 2 })],
        winnerId: 'p1',
      }),
    ),
    summary: summary({
      matchId: MATCH_ID,
      finished: true,
      players: [summaryPlayer('p1', { legsWon: 4, average: 49.73 }), summaryPlayer('p2', { legsWon: 2, average: 44.88 })],
    }),
    legs: matchLegs(legs, { matchId: MATCH_ID, finished: true, legsToWin: 4 }),
    ...overrides,
  });
}

interface Request {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

let requests: Request[];
let sockets: number;
let tournamentReply: () => Response;
let matchReply: () => Response;

beforeEach(() => {
  requests = [];
  sockets = 0;
  tournamentReply = () => json(200, publicTournamentView(cupView()));
  matchReply = () => json(200, finalMatch());
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
      if (url === TOURNAMENT_URL) {
        return Promise.resolve(tournamentReply());
      }
      return Promise.resolve(url === MATCH_URL ? matchReply() : notFound());
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function renderPage(): Promise<void> {
  render(<PublicMatchScreen tournamentId="t1" matchId={MATCH_ID} />);
  await screen.findByRole('heading', { level: 1 });
}

describe('PublicMatchScreen', () => {
  it('shows the header, the stats and the leg history of the played match', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Finał · Mecz #20' })).toBeTruthy();
    expect(screen.getByText('do 4 wygranych legów · 501')).toBeTruthy();
    expect(screen.getByText('4 : 2')).toBeTruthy();
    expect(screen.queryByText(/^rozegrano/)).toBeNull();
    expect(screen.getByRole('table', { name: 'Statystyki meczu' })).toBeTruthy();
    const legTabs = within(screen.getByRole('tablist', { name: 'Legi' })).getAllByRole('tab');
    expect(legTabs).toHaveLength(6);
    expect(screen.getByText('podgląd publiczny')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('links back to the public tournament with the tournament name', async () => {
    await renderPage();
    const back = screen.getByRole('link', { name: 'Wróć do turnieju Puchar jesienny' });
    expect(back.getAttribute('href')).toBe('#/t/t1');
    const hrefs = Array.from(document.querySelectorAll('a')).map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.every((href) => href.startsWith('#/t/'))).toBe(true);
  });

  it('shows the corrected score from the public view with popr. and the played score', async () => {
    tournamentReply = () =>
      json(200, publicTournamentView(cupView(finalFixture({ result: { legs: [3, 4], winnerId: 'p2', corrected: true } }))));
    await renderPage();
    expect(screen.getByText('3 : 4')).toBeTruthy();
    expect(screen.getByText('popr.').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('wynik poprawiony')).toBeTruthy();
    expect(screen.getByText('rozegrano 4:2')).toBeTruthy();
    expect(screen.getByText('zwycięzca').parentElement?.textContent).toBe('Bartekzwycięzca');
    // Statystyki zostają z rozegranego meczu.
    const table = screen.getByRole('table', { name: 'Statystyki meczu' });
    const legsRow = within(table).getByRole('rowheader', { name: 'Wygrane legi' }).closest('tr');
    expect(legsRow?.textContent).toContain('4');
    expect(legsRow?.textContent).toContain('2');
  });

  it('shows wo for a walkover that kept the match', async () => {
    tournamentReply = () =>
      json(
        200,
        publicTournamentView(cupView(finalFixture({ status: 'walkover', result: { legs: [4, 0], winnerId: 'p1', corrected: false } }))),
      );
    matchReply = () =>
      json(
        200,
        finalMatch({
          match: publicMatch(
            snapshot({
              id: MATCH_ID,
              status: 'abandoned',
              legsToWin: 4,
              players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 0 })],
            }),
          ),
        }),
      );
    await renderPage();
    expect(screen.getByText('4 : 0')).toBeTruthy();
    expect(screen.getByText('wo').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('rozegrano 1:0')).toBeTruthy();
  });

  it('shows the live leg of a running match from the number of legs', async () => {
    matchReply = () =>
      json(
        200,
        finalMatch({
          match: publicMatch(
            snapshot({
              id: MATCH_ID,
              legsToWin: 4,
              players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 0 })],
            }),
          ),
          legs: matchLegs([matchLeg({ legIndex: 0, winnerId: 'p1', checkout: 40, dartsThrown: 18 }), matchLeg({ legIndex: 1 })], {
            matchId: MATCH_ID,
            legsToWin: 4,
          }),
        }),
      );
    tournamentReply = () => json(200, publicTournamentView(cupView(finalFixture({ status: 'in_progress', result: null }))));
    await renderPage();
    expect(screen.getByText('na żywo, leg 2')).toBeTruthy();
  });

  it('fetches only the public API, without the stored token and without a socket', async () => {
    await renderPage();
    expect(requests.map((request) => request.url).sort()).toEqual([TOURNAMENT_URL, MATCH_URL]);
    expect(requests.map((request) => new Headers(request.init?.headers).get('authorization'))).toEqual([null, null]);
    expect(sockets).toBe(0);
  });

  it('polls the tournament and the match every 10 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(<PublicMatchScreen tournamentId="t1" matchId={MATCH_ID} />);
    await vi.waitFor(() => screen.getByRole('heading', { level: 1 }));
    expect(requests).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PUBLIC_POLL_INTERVAL_MS);
    });
    expect(requests.filter((request) => request.url === TOURNAMENT_URL)).toHaveLength(2);
    expect(requests.filter((request) => request.url === MATCH_URL)).toHaveLength(2);
  });

  it('shows the not shared notice when the tournament answers 404', async () => {
    tournamentReply = notFound;
    render(<PublicMatchScreen tournamentId="t1" matchId={MATCH_ID} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Ten turniej nie istnieje albo nie jest udostępniony.');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows the match not found text with a link to the public tournament when the match answers 404', async () => {
    matchReply = notFound;
    render(<PublicMatchScreen tournamentId="t1" matchId={MATCH_ID} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Nie znaleziono meczu w tym turnieju.');
    expect(screen.getByRole('link', { name: 'Wróć do turnieju' }).getAttribute('href')).toBe('#/t/t1');
  });

  it('shows the loading text first', () => {
    render(<PublicMatchScreen tournamentId="t1" matchId={MATCH_ID} />);
    expect(screen.getByText('Ładowanie…')).toBeTruthy();
  });
});
