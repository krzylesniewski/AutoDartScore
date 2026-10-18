import { render, screen } from '@testing-library/react';
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
      if (url === '/api/players') {
        return json(200, [
          { id: 'p1', name: 'Anna', avatar: null, guest: false, createdAt },
          { id: 'p 2', name: 'Bartek', avatar: null, guest: false, createdAt },
        ]);
      }
      if (url === '/api/matches?status=unfinished') {
        return json(200, []);
      }
      if (url.startsWith('/api/stats/rankings')) {
        return json(200, { filter: 'all', games: 0, legs: 0, players: [], bestLegAverage: [], highestCheckout: [], shortestLeg: [], scores180: [] });
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
