import type { TournamentListItem } from '@autoscore/schema';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tournamentListItem, tournamentPlayer } from '../test/snapshots';
import { TournamentsScreen } from './TournamentsScreen';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

let urls: string[];
let reply: () => Response;

function stubList(items: TournamentListItem[]): void {
  reply = () => json(200, items);
}

beforeEach(() => {
  urls = [];
  reply = () => json(200, []);
  window.location.hash = '#/tournaments';
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      urls.push(url);
      return Promise.resolve(reply());
    }),
  );
});

afterEach(() => {
  window.location.hash = '';
  vi.unstubAllGlobals();
});

function finished(id: string, name: string, createdAt: string, overrides: Partial<TournamentListItem> = {}): TournamentListItem {
  return tournamentListItem({ id, name, status: 'finished', createdAt, finishedAt: createdAt, ...overrides });
}

describe('TournamentsScreen', () => {
  it('shows the title, the current nav entry and the new tournament link', async () => {
    render(<TournamentsScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Turnieje' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Turniej' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Nowy turniej' }).getAttribute('href')).toBe('#/tournaments/new');
    expect(await screen.findByText('Brak zakończonych turniejów.')).toBeTruthy();
    expect(urls).toEqual(['/api/tournaments']);
  });

  it('replaces the address with the tournament in progress', async () => {
    stubList([finished('t0', 'Stary', '2026-10-01T18:00:00.000Z'), tournamentListItem({ id: 't 1', status: 'in_progress' })]);
    const before = window.history.length;
    render(<TournamentsScreen />);
    await vi.waitFor(() => expect(window.location.hash).toBe('#/tournaments/t%201'));
    // replace nie dokłada wpisu do historii, więc Wstecz nie wraca na listę, która od razu by przekierowała.
    expect(window.history.length).toBe(before);
    expect(screen.queryByRole('link', { name: /Stary/ })).toBeNull();
  });

  it('lists the finished tournaments with the format, the date and the winner', async () => {
    stubList([
      finished('t2', 'Puchar zimowy', '2026-11-03T19:00:00.000Z', {
        format: 'cup',
        players: [tournamentPlayer('p1', 'Anna'), tournamentPlayer('p2', 'Bartek'), tournamentPlayer('p3', 'Celina')],
        placements: [
          { playerId: 'p2', place: 1 },
          { playerId: 'p1', place: 2 },
        ],
      }),
      finished('t1', 'Liga', '2026-10-07T19:00:00.000Z', { placements: [] }),
    ]);
    render(<TournamentsScreen />);
    const first = await screen.findByRole('link', { name: /Puchar zimowy/ });
    expect(first.getAttribute('href')).toBe('#/tournaments/t2');
    expect(within(first).getByText('Puchar')).toBeTruthy();
    expect(within(first).getByText('03.11.2026')).toBeTruthy();
    expect(within(first).getByText('Zwycięzca: Bartek')).toBeTruthy();
    const second = screen.getByRole('link', { name: /^Liga/ });
    expect(second.getAttribute('href')).toBe('#/tournaments/t1');
    expect(within(second).getByText('07.10.2026')).toBeTruthy();
    expect(within(second).queryByText(/^Zwycięzca/)).toBeNull();
    expect(screen.queryByText('Brak zakończonych turniejów.')).toBeNull();
    expect(window.location.hash).toBe('#/tournaments');
  });

  it('shows an error when the list fails', async () => {
    reply = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    render(<TournamentsScreen />);
    expect(await screen.findByText('Nie udało się pobrać listy turniejów')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nowy turniej' })).toBeTruthy();
  });
});
