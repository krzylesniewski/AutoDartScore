import type { PlayerStats } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { statLine } from '../test/snapshots';
import { StatsScreen } from './StatsScreen';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const createdAt = '2026-10-15T18:30:00.000Z';
const players = [
  { id: 'p1', name: 'Anna', avatar: null, guest: false, createdAt },
  { id: 'p2', name: 'Bartek', avatar: '🎯', guest: false, createdAt },
];

function stats(playerId: string, overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    ...statLine({
      dartsThrown: 15,
      points: 442,
      average: 88.4,
      first9Average: 100.33,
      scores180: 1,
      scores140: 1,
      scores100: 1,
      scores60: 0,
      highestCheckout: 141,
      doubleAttempts: 3,
      doublesHit: 2,
      doublesPercent: 66.7,
      bestLegDarts: 6,
      legsWon: 1,
    }),
    playerId,
    filter: 'all',
    matchesPlayed: 2,
    matchesWon: 1,
    ...overrides,
  };
}

let urls: string[];
let respondStats: (url: string) => Response;

beforeEach(() => {
  urls = [];
  respondStats = (url) => json(200, stats(/players\/([^/]+)\/stats/.exec(url)?.[1] ?? ''));
  window.location.hash = '#/stats';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url);
      if (url === '/api/players') {
        return json(200, players);
      }
      return respondStats(url);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function card(): HTMLElement {
  const list = document.querySelector('dl');
  if (!list) {
    throw new Error('no stat card');
  }
  return list;
}

function value(term: string): string | null {
  const dt = within(card()).getByText(term, { selector: 'dt' });
  return dt.nextElementSibling?.textContent ?? null;
}

describe('StatsScreen', () => {
  it('shows the first player with the all filter and the card values', async () => {
    render(<StatsScreen playerId={null} />);
    expect(screen.getByRole('heading', { name: 'Statystyki' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nowa gra' }).getAttribute('href')).toBe('#/');
    await vi.waitFor(() => expect(document.querySelector('dl')).not.toBeNull());
    expect(urls).toContain('/api/players/p1/stats?type=all');
    expect(screen.getByRole('button', { name: 'Anna' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Wszystkie' }).getAttribute('aria-pressed')).toBe('true');
    expect(value('Rzutki')).toBe('15');
    expect(value('Średnia (3 rzutki)')).toBe('88.40');
    expect(value('First 9')).toBe('100.33');
    expect(value('180')).toBe('1');
    expect(value('140+')).toBe('1');
    expect(value('100+')).toBe('1');
    expect(value('60+')).toBe('0');
    expect(value('Najwyższe zamknięcie')).toBe('141');
    expect(value('% doubli')).toBe('66.7% (2/3)');
    expect(value('Najlepszy leg')).toBe('6 rzutek');
    expect(value('Wygrane legi')).toBe('1');
    expect(value('Wygrane mecze')).toBe('1/2');
  });

  it('sends the chosen filter as ?type=', async () => {
    render(<StatsScreen playerId="p2" />);
    await vi.waitFor(() => expect(urls).toContain('/api/players/p2/stats?type=all'));
    for (const [label, type] of [
      ['Mecze 1v1', 'match'],
      ['Zabawa', 'casual'],
      ['Trening', 'practice'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
      await vi.waitFor(() => expect(urls).toContain(`/api/players/p2/stats?type=${type}`));
    }
  });

  it('sets the hash when a player is chosen', async () => {
    render(<StatsScreen playerId={null} />);
    fireEvent.click(await screen.findByRole('button', { name: /Bartek/ }));
    expect(window.location.hash).toBe('#/stats/p2');
  });

  it('shows Brak rzutów for a player without throws', async () => {
    respondStats = () => json(200, { ...stats('p1'), ...statLine(), matchesPlayed: 0, matchesWon: 0 });
    render(<StatsScreen playerId="p1" />);
    expect(await screen.findByText('Brak rzutów')).toBeTruthy();
    expect(document.querySelector('dl')).toBeNull();
  });

  it('shows an error for an unknown player in the hash', async () => {
    respondStats = () => json(404, { error: 'not_found', message: 'Player nobody not found' });
    render(<StatsScreen playerId="nobody" />);
    expect(await screen.findByText('Nie znaleziono gracza')).toBeTruthy();
    expect(urls).toContain('/api/players/nobody/stats?type=all');
  });

  it('shows an error when the stats request fails', async () => {
    respondStats = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    render(<StatsScreen playerId="p1" />);
    expect(await screen.findByText('Nie udało się pobrać statystyk')).toBeTruthy();
  });

  it('shows Brak graczy without profiles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        return json(200, []);
      }),
    );
    render(<StatsScreen playerId={null} />);
    expect(await screen.findByText('Brak graczy. Dodaj pierwszego.')).toBeTruthy();
    expect(urls).toEqual(['/api/players']);
  });
});
