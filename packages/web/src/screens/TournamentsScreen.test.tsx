import type { TournamentListItem } from '@autoscore/schema';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tournamentListItem, tournamentPlayer, tournamentView } from '../test/snapshots';
import { TournamentsScreen } from './TournamentsScreen';

// Tekst bez ikon, bo są ukryte przed czytnikami ekranu.
function visibleText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return copy.textContent ?? '';
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

let urls: string[];
let posts: { url: string; body: unknown }[];
let reply: () => Response;
let archiveReply: () => Response;

function stubList(items: TournamentListItem[]): void {
  reply = () => json(200, items);
}

beforeEach(() => {
  urls = [];
  posts = [];
  reply = () => json(200, []);
  archiveReply = () =>
    json(200, tournamentView({ status: 'finished', finishedAt: '2026-11-12T21:00:00.000Z', archivedAt: '2026-11-13T10:00:00.000Z' }));
  window.location.hash = '#/tournaments';
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      if (init.method === 'POST') {
        posts.push({ url, body: init.body });
        return Promise.resolve(archiveReply());
      }
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

  it('puts an Archiwizuj button beside each finished link, not inside it', async () => {
    stubList([finished('t2', 'Puchar zimowy', '2026-11-03T19:00:00.000Z'), finished('t1', 'Liga', '2026-10-07T19:00:00.000Z')]);
    render(<TournamentsScreen />);
    const link = await screen.findByRole('link', { name: /Puchar zimowy/ });
    const button = screen.getByRole('button', { name: 'Archiwizuj: Puchar zimowy' });
    expect(link.contains(button)).toBe(false);
    expect(button.closest('li')).toBe(link.closest('li'));
    expect(visibleText(button)).toBe('Archiwizuj');
    expect(screen.getByRole('button', { name: 'Archiwizuj: Liga' })).toBeTruthy();
  });

  it('archives a tournament after the confirmation and removes the row', async () => {
    stubList([finished('t 2', 'Puchar zimowy', '2026-11-03T19:00:00.000Z'), finished('t1', 'Liga', '2026-10-07T19:00:00.000Z')]);
    render(<TournamentsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archiwizuj: Puchar zimowy' }));
    const dialog = screen.getByRole('dialog', { name: 'Zarchiwizować turniej?' });
    expect(
      within(dialog).getByText(
        'Puchar zimowy zniknie z listy zakończonych turniejów, a publiczny link przestanie działać. Wyniki, mecze i statystyki zostają. Archiwizacji nie da się cofnąć.',
      ),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archiwizuj' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(posts).toEqual([{ url: '/api/tournaments/t%202/archive', body: undefined }]);
    expect(screen.queryByRole('link', { name: /Puchar zimowy/ })).toBeNull();
    expect(screen.getByRole('link', { name: /^Liga/ })).toBeTruthy();
    expect(urls).toEqual(['/api/tournaments']);
  });

  it('shows the empty text after archiving the last tournament', async () => {
    stubList([finished('t1', 'Liga', '2026-10-07T19:00:00.000Z')]);
    render(<TournamentsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archiwizuj: Liga' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archiwizuj' }));
    expect(await screen.findByText('Brak zakończonych turniejów.')).toBeTruthy();
  });

  it('sends nothing on Anuluj', async () => {
    stubList([finished('t1', 'Liga', '2026-10-07T19:00:00.000Z')]);
    render(<TournamentsScreen />);
    const button = await screen.findByRole('button', { name: 'Archiwizuj: Liga' });
    button.focus();
    fireEvent.click(button);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anuluj' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posts).toEqual([]);
    expect(screen.getByRole('link', { name: /^Liga/ })).toBeTruthy();
    expect(document.activeElement).toBe(button);
  });

  it('shows the error in the window and keeps the row', async () => {
    stubList([finished('t1', 'Liga', '2026-10-07T19:00:00.000Z')]);
    archiveReply = () => json(409, { error: 'tournament_not_finished', message: 'Tournament is not finished' });
    render(<TournamentsScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archiwizuj: Liga' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archiwizuj' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Zarchiwizować można tylko zakończony turniej.');
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Archiwizuj' }).disabled).toBe(false);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('link', { name: /^Liga/ })).toBeTruthy();
  });

  it('shows an error when the list fails', async () => {
    reply = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    render(<TournamentsScreen />);
    expect(await screen.findByText('Nie udało się pobrać listy turniejów')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nowy turniej' })).toBeTruthy();
  });
});
