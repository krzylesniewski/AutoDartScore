import type { MatchListItem } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { player, snapshot } from '../test/snapshots';
import { HomeScreen } from './HomeScreen';

interface Call {
  readonly url: string;
  readonly method: string;
}

let calls: Call[];
let respond: (call: Call) => Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function item(overrides: Partial<MatchListItem>): MatchListItem {
  return {
    id: 'm1',
    type: 'match',
    practiceMode: null,
    startingScore: 501,
    legsToWin: 2,
    createdAt: '2026-10-18T10:00:00.000Z',
    status: 'in_progress',
    abandonment: null,
    currentPlayerId: 'p1',
    legIndex: 0,
    players: [player('p1', 'Anna', { remaining: 321, legsWon: 1 }), player('p2', 'Bartek', { remaining: 140, legsWon: 0 })],
    freeRun: null,
    updatedAt: '2026-10-18T10:05:00.000Z',
    ...overrides,
  };
}

const inProgress = item({ id: 'm_live' });
const abandoned = item({
  id: 'm_paused',
  type: 'casual',
  legsToWin: null,
  status: 'abandoned',
  abandonment: { playerId: 'p2', reason: null, at: '2026-10-18T09:30:00.000Z' },
  players: [player('p1', 'Celina', { remaining: 0, place: 1 }), player('p2', 'Darek', { remaining: 77 }), player('p3', 'Ela', { remaining: 201 })],
  updatedAt: '2026-10-18T09:30:00.000Z',
});
const freeRun = item({
  id: 'm_free',
  type: 'practice',
  practiceMode: 'free_run',
  startingScore: null,
  legsToWin: null,
  players: [player('p1', 'Anna', { remaining: null })],
  freeRun: { dartsThrown: 9, totalPoints: 300, average: 100 },
});

beforeEach(() => {
  calls = [];
  window.location.hash = '#/';
  respond = async () => json(200, [inProgress, abandoned]);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call = { url, method: init.method ?? 'GET' };
      calls.push(call);
      return respond(call);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function row(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name);
  const found = cell.closest('section > ul > li');
  if (!(found instanceof HTMLElement)) {
    throw new Error(`no row for ${name}`);
  }
  return found;
}

describe('HomeScreen', () => {
  it('loads the unfinished games once and links to the wizard', async () => {
    render(<HomeScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'AUTO Score' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nowa gra' }).getAttribute('href')).toBe('#/new');
    expect(screen.getByText('Ładowanie…')).toBeTruthy();
    await screen.findByText('Bartek');
    expect(calls).toEqual([{ url: '/api/matches?status=unfinished', method: 'GET' }]);
  });

  it('shows a game in progress with W trakcie and Kontynuuj', async () => {
    render(<HomeScreen />);
    const live = await row('Bartek');
    expect(within(live).getByText('Mecz 1v1')).toBeTruthy();
    expect(within(live).getByText('501')).toBeTruthy();
    expect(within(live).getByText('W trakcie')).toBeTruthy();
    expect(within(live).getByText('140')).toBeTruthy();
    expect(within(live).getByRole('link', { name: 'Kontynuuj' }).getAttribute('href')).toBe('#/matches/m_live');
    expect(within(live).queryByRole('button', { name: 'Wznów' })).toBeNull();
    // Sformatowany czas zależy od strefy czasowej, więc sprawdzamy tylko atrybut.
    expect(live.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-18T10:05:00.000Z');
  });

  it('shows an abandoned game with Porzucony, places, Wznów and Podgląd', async () => {
    render(<HomeScreen />);
    const paused = await row('Darek');
    expect(within(paused).getByText('Zabawa')).toBeTruthy();
    expect(within(paused).getByText('Porzucony')).toBeTruthy();
    expect(within(paused).getByText('1. miejsce')).toBeTruthy();
    expect(within(paused).getByText('77')).toBeTruthy();
    expect(within(paused).getByRole('link', { name: 'Podgląd' }).getAttribute('href')).toBe('#/matches/m_paused');
    expect(within(paused).queryByRole('link', { name: 'Kontynuuj' })).toBeNull();
  });

  it('shows Free run without remaining scores', async () => {
    respond = async () => json(200, [freeRun]);
    render(<HomeScreen />);
    const free = await row('Free run');
    expect(within(free).getByText('Anna')).toBeTruthy();
    expect(within(free).getByText('W trakcie')).toBeTruthy();
    expect(within(free).queryByText(/^\d+$/)).toBeNull();
  });

  it('resumes an abandoned game and opens it', async () => {
    render(<HomeScreen />);
    const paused = await row('Darek');
    respond = async () => json(200, snapshot({ id: 'm_paused', eventSeq: 9 }));
    fireEvent.click(within(paused).getByRole('button', { name: 'Wznów' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/matches/m_paused'));
    expect(calls.at(-1)).toEqual({ url: '/api/matches/m_paused/resume', method: 'POST' });
  });

  it('shows a failed resume and stays on the list', async () => {
    render(<HomeScreen />);
    const paused = await row('Darek');
    respond = async () => json(409, { error: 'match_not_abandoned', message: 'Match is not abandoned' });
    fireEvent.click(within(paused).getByRole('button', { name: 'Wznów' }));
    expect(await screen.findByText('Nie udało się wznowić meczu')).toBeTruthy();
    expect(window.location.hash).toBe('#/');
  });

  it('shows the empty state', async () => {
    respond = async () => json(200, []);
    render(<HomeScreen />);
    expect(await screen.findByText('Brak nieskończonych gier.')).toBeTruthy();
  });

  it('shows an error when the list fails to load', async () => {
    respond = async () => json(500, { error: 'internal_error', message: 'Internal server error' });
    render(<HomeScreen />);
    expect(await screen.findByText('Nie udało się pobrać listy gier')).toBeTruthy();
    expect(screen.queryByText('Brak nieskończonych gier.')).toBeNull();
  });
});
