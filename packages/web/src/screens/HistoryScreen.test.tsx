import type { MatchListItem } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, player } from '../test/snapshots';
import { HistoryScreen } from './HistoryScreen';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const finishedMatch = listItem({
  id: 'm_match',
  startingScore: 301,
  status: 'finished',
  currentPlayerId: null,
  winnerId: 'p1',
  players: [player('p1', 'Anna', { legsWon: 2 }), player('p2', 'Bartek', { legsWon: 1 })],
});
const finishedCasual = listItem({
  id: 'm_casual',
  type: 'casual',
  legsToWin: null,
  status: 'finished',
  players: [player('p1', 'Anna'), player('p2', 'Bartek'), player('p3', 'Celina')],
  placements: [
    { playerId: 'p3', place: 1 },
    { playerId: 'p1', place: 2 },
    { playerId: 'p2', place: 3 },
  ],
});
const finishedSolo = listItem({ id: 'm_solo', type: 'practice', practiceMode: 'solo_501', legsToWin: null, status: 'finished', winnerId: 'p1', players: [player('p1', 'Anna')] });
const abandoned = listItem({ id: 'm_paused', status: 'abandoned', abandonment: { playerId: 'p1', reason: null, at: '2026-10-18T10:05:00.000Z' } });
const inProgress = listItem({ id: 'm_open' });
const ended = listItem({
  id: 'm_ended',
  type: 'practice',
  practiceMode: 'free_run',
  startingScore: null,
  legsToWin: null,
  status: 'ended',
  players: [player('p1', 'Anna', { remaining: null })],
  freeRun: { dartsThrown: 6, totalPoints: 120, average: 60 },
  endedAt: '2026-10-18T10:05:00.000Z',
});

let urls: string[];
let games: MatchListItem[];
let failing: boolean;

beforeEach(() => {
  urls = [];
  games = [finishedMatch, finishedCasual, finishedSolo, abandoned, inProgress, ended];
  failing = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url);
      return failing ? json(500, { error: 'internal_error', message: 'Internal server error' }) : json(200, games);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function rows(): HTMLElement[] {
  return screen.getAllByRole('listitem');
}

function row(text: string): HTMLElement {
  const found = rows().find((item) => item.textContent?.includes(text));
  if (!found) {
    throw new Error(`no row with ${text}`);
  }
  return found;
}

describe('HistoryScreen', () => {
  it('lists every game with its type, result and a link to the details', async () => {
    render(<HistoryScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Historia' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Historia' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Anna 2 : 1 Bartek')).toBeTruthy();
    expect(urls).toEqual(['/api/matches']);
    expect(rows()).toHaveLength(6);
    expect(within(row('Anna 2 : 1 Bartek')).getByText('Mecz 1v1 · 301')).toBeTruthy();
    expect(within(row('1. Celina')).getByText('1. Celina · 2. Anna · 3. Bartek')).toBeTruthy();
    expect(within(row('Free run')).getByText('Anna · 6 rzutek · średnia 60.00')).toBeTruthy();
    expect(within(row('Anna 2 : 1 Bartek')).getByRole('link', { name: 'Szczegóły: Anna 2 : 1 Bartek' }).getAttribute('href')).toBe('#/matches/m_match');
    expect(screen.getAllByRole('link', { name: /^Szczegóły/ }).map((link) => link.getAttribute('href'))).toEqual([
      '#/matches/m_match',
      '#/matches/m_casual',
      '#/matches/m_solo',
      '#/matches/m_paused',
      '#/matches/m_open',
      '#/matches/m_ended',
    ]);
  });

  it('gives every status badge an icon and a text', async () => {
    render(<HistoryScreen />);
    await screen.findByText('Anna 2 : 1 Bartek');
    const badges = rows().map((item) => {
      const icon = item.querySelector('svg');
      const badge = icon?.parentElement;
      return { text: badge?.textContent ?? '', hidden: icon?.getAttribute('aria-hidden') };
    });
    expect(badges).toEqual([
      { text: 'Wygrywa Anna', hidden: 'true' },
      { text: 'Wygrywa Celina', hidden: 'true' },
      { text: 'Ukończony', hidden: 'true' },
      { text: 'Porzucony', hidden: 'true' },
      { text: 'W trakcie', hidden: 'true' },
      { text: 'Zakończony', hidden: 'true' },
    ]);
  });

  it('sends the type filter in the request URL', async () => {
    render(<HistoryScreen />);
    await vi.waitFor(() => expect(urls).toContain('/api/matches'));
    expect(screen.getByRole('button', { name: 'Wszystkie' }).getAttribute('aria-pressed')).toBe('true');
    for (const [label, type] of [
      ['Mecze 1v1', 'match'],
      ['Zabawa', 'casual'],
      ['Trening', 'practice'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
      await vi.waitFor(() => expect(urls.at(-1)).toBe(`/api/matches?type=${type}`));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Wszystkie' }));
    await vi.waitFor(() => expect(urls.at(-1)).toBe('/api/matches'));
  });

  it('shows an empty state', async () => {
    games = [];
    render(<HistoryScreen />);
    expect(await screen.findByText('Brak gier w historii.')).toBeTruthy();
  });

  it('shows an error when the list fails to load', async () => {
    failing = true;
    render(<HistoryScreen />);
    expect(await screen.findByText('Nie udało się pobrać listy gier')).toBeTruthy();
  });
});
