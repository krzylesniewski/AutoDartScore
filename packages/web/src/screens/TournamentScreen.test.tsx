import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture, tournamentView } from '../test/snapshots';
import { TournamentScreen } from './TournamentScreen';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

let urls: string[];
let reply: () => Response;

beforeEach(() => {
  urls = [];
  reply = () => json(200, tournamentView());
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      urls.push(url);
      return Promise.resolve(reply());
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function rows(): string[] {
  return within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((row) => row.textContent ?? '');
}

describe('TournamentScreen', () => {
  it('shows the name, the format and the starting score', async () => {
    render(<TournamentScreen tournamentId="t 1" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Liga czwartkowa' })).toBeTruthy();
    expect(screen.getByText('Liga · 501')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Turniej' }).getAttribute('aria-current')).toBe('page');
    expect(urls).toEqual(['/api/tournaments/t%201']);
  });

  it('lists the fixtures by number with their sides, result and status', async () => {
    reply = () =>
      json(
        200,
        tournamentView({
          format: 'cup',
          fixtures: [
            fixture({
              id: 'p-f',
              number: 3,
              phase: 'playoff',
              bracketRound: 'final',
              slots: [
                { kind: 'player', playerId: 'p1', seed: 1 },
                { kind: 'winner_of', fixtureId: 'p-sf-2' },
              ],
              status: 'waiting',
            }),
            fixture({
              id: 'p-sf-1',
              number: 1,
              phase: 'playoff',
              bracketRound: 'sf',
              slots: [{ kind: 'player', playerId: 'p1', seed: 1 }, { kind: 'bye' }],
              status: 'bye',
            }),
            fixture({
              id: 'p-sf-2',
              number: 2,
              phase: 'playoff',
              bracketRound: 'sf',
              slots: [
                { kind: 'player', playerId: 'p2', seed: 2 },
                { kind: 'player', playerId: 'p3', seed: 3 },
              ],
              status: 'finished',
              result: { legs: [1, 3], winnerId: 'p3', corrected: false },
            }),
          ],
        }),
      );
    render(<TournamentScreen tournamentId="t1" />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Puchar · 501')).toBeTruthy();
    expect(rows()).toEqual([
      'Mecz 1Anna vs Wolny losWolny los',
      'Mecz 2Bartek vs Celina1 : 3Rozegrany',
      'Mecz 3Anna vs Do ustaleniaCzeka na rywali',
    ]);
  });

  it.each([
    ['ready', 'Do rozegrania'],
    ['in_progress', 'W trakcie'],
  ] as const)('maps the %s status to Polish', async (status, text) => {
    reply = () => json(200, tournamentView({ fixtures: [fixture({ status, matchId: status === 'ready' ? null : 'm1' })] }));
    render(<TournamentScreen tournamentId="t1" />);
    await screen.findByRole('heading', { level: 1 });
    expect(rows()).toEqual([`Mecz 1Anna vs Bartek${text}`]);
  });

  it('shows a walkover with its legs', async () => {
    reply = () =>
      json(
        200,
        tournamentView({
          fixtures: [
            fixture({ status: 'walkover', result: { legs: [3, 0], winnerId: 'p1', corrected: false } }),
            fixture({
              id: 'g-2',
              number: 2,
              slots: [
                { kind: 'standing', place: 1 },
                { kind: 'loser_of', fixtureId: 'g-1' },
              ],
              status: 'waiting',
            }),
          ],
        }),
      );
    render(<TournamentScreen tournamentId="t1" />);
    await screen.findByRole('heading', { level: 1 });
    expect(rows()).toEqual(['Mecz 1Anna vs Bartek3 : 0Walkower', 'Mecz 2Do ustalenia vs Do ustaleniaCzeka na rywali']);
  });

  it('shows the not found text with a link to the tournaments on 404', async () => {
    reply = () => json(404, { error: 'not_found', message: 'Tournament not found' });
    render(<TournamentScreen tournamentId="t0" />);
    expect(await screen.findByText('Nie znaleziono turnieju.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Wróć do turniejów' }).getAttribute('href')).toBe('#/tournaments');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows a generic error for other failures', async () => {
    reply = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    render(<TournamentScreen tournamentId="t1" />);
    expect(await screen.findByText('Nie udało się pobrać turnieju')).toBeTruthy();
    expect(screen.queryByText('Nie znaleziono turnieju.')).toBeNull();
  });
});
