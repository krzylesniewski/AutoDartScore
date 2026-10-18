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
      return json(200, { ...statLine(), playerId: 'p1', filter: 'all', matchesPlayed: 0, matchesWon: 0 });
    }),
  );
});

afterEach(() => {
  window.location.hash = '';
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('opens the new game screen on #/ with a link to the statistics', async () => {
    window.location.hash = '#/';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Nowa gra' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Statystyki' }).getAttribute('href')).toBe('#/stats');
    await vi.waitFor(() => expect(urls).toContain('/api/players'));
  });

  it('opens the statistics screen on #/stats', async () => {
    window.location.hash = '#/stats';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Statystyki' })).toBeTruthy();
    await vi.waitFor(() => expect(urls).toContain('/api/players/p1/stats?type=all'));
  });

  it('opens the statistics of the player in #/stats/:playerId', async () => {
    window.location.hash = `#/stats/${encodeURIComponent('p 2')}`;
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Statystyki' })).toBeTruthy();
    await vi.waitFor(() => expect(urls).toContain('/api/players/p%202/stats?type=all'));
    expect((await screen.findByRole('button', { name: 'Bartek' })).getAttribute('aria-pressed')).toBe('true');
  });
});
