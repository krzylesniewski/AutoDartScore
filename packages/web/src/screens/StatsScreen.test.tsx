import type { PlayerStats, RankingEntry, StatsRankings } from '@autoscore/schema';
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

function entry(playerId: string, name: string, position: number, value: number): RankingEntry {
  return { playerId, name, avatar: playerId === 'p2' ? '🎯' : null, position, value };
}

const rankingsFixture: StatsRankings = {
  filter: 'all',
  games: 23,
  legs: 61,
  players: [
    { playerId: 'p1', name: 'Anna', avatar: null, position: 1, average: 61.5, legs: 25 },
    { playerId: 'p2', name: 'Bartek', avatar: '🎯', position: 2, average: 55.25, legs: 21 },
    { playerId: 'p3', name: 'Celina', avatar: null, position: 3, average: 40, legs: 3 },
    { playerId: 'p4', name: 'Darek', avatar: null, position: null, average: 70, legs: 2 },
  ],
  bestLegAverage: [entry('p1', 'Anna', 1, 98.33), entry('p2', 'Bartek', 2, 86.5), entry('p3', 'Celina', 3, 74.2)],
  highestCheckout: [entry('p2', 'Bartek', 1, 121), entry('p3', 'Celina', 1, 121), entry('p1', 'Anna', 3, 80), entry('p4', 'Darek', 3, 80)],
  shortestLeg: [entry('p1', 'Anna', 1, 15), entry('p2', 'Bartek', 2, 18)],
  scores180: [entry('p2', 'Bartek', 1, 3)],
};

let urls: string[];
let respondStats: (url: string) => Response;
let rankings: StatsRankings;

beforeEach(() => {
  urls = [];
  respondStats = (url) => json(200, stats(/players\/([^/]+)\/stats/.exec(url)?.[1] ?? ''));
  rankings = rankingsFixture;
  window.location.hash = '#/stats';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url);
      if (url === '/api/players') {
        return json(200, players);
      }
      if (url.startsWith('/api/stats/rankings')) {
        return json(200, { ...rankings, filter: new URL(url, 'http://localhost').searchParams.get('type') });
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

function tile(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

function rows(container: HTMLElement): string[] {
  return within(container)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

describe('StatsScreen: ranking', () => {
  it('lists every player by average with legs and positions', async () => {
    render(<StatsScreen playerId={null} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Statystyki' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Statystyki' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów')).toBeTruthy();
    expect(urls).toContain('/api/stats/rankings?type=all');

    const list = tile('Średnia (3 rzutki)');
    expect(rows(list)).toEqual(['1.AAnna25 legów61.50', '2.🎯Bartek21 legów55.25', '3.CCelina3 legi40.00', 'DDarek2 legi70.00']);
    expect(within(list).getByRole('link', { name: /Bartek/ }).getAttribute('href')).toBe('#/stats/p2');
    expect(within(list).getByText('Średnia od 3 ukończonych legów.')).toBeTruthy();
  });

  it('shows exactly 4 top 3 tiles and no doubles tile', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    const tiles = ['Rekordowy leg (średnia)', 'Najwyższe zamknięcie', 'Najkrótszy leg', 'Liczba 180'];
    expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label')).filter(Boolean)).toEqual(tiles);
    expect(screen.queryByText('% doubli')).toBeNull();
    expect(within(tile('Rekordowy leg (średnia)')).getByText('3 rzutki')).toBeTruthy();
    expect(rows(tile('Rekordowy leg (średnia)'))).toEqual(['1.AAnna98.33', '2.🎯Bartek86.50', '3.CCelina74.20']);
    expect(within(tile('Najwyższe zamknięcie')).getByText('checkout')).toBeTruthy();
    expect(rows(tile('Najwyższe zamknięcie'))).toEqual(['1.🎯Bartek121', '1.CCelina121', '3.AAnna80', '3.DDarek80']);
    expect(within(tile('Najkrótszy leg')).getByText('liczba rzutek')).toBeTruthy();
    expect(within(tile('Liczba 180')).getByText('wszystkie gry')).toBeTruthy();
  });

  it('marks the leaders in the list and in the tiles', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    const leaders = (container: HTMLElement) => [...container.querySelectorAll('[data-leader]')].map((row) => row.textContent);
    expect(leaders(tile('Średnia (3 rzutki)'))).toEqual(['1.AAnna25 legów61.50']);
    expect(leaders(tile('Najwyższe zamknięcie'))).toEqual(['1.🎯Bartek121', '1.CCelina121']);
  });

  it('says when a tile has fewer than 3 players', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    expect(within(tile('Najkrótszy leg')).getByText('Za mało graczy w tej kategorii.')).toBeTruthy();
    expect(within(tile('Liczba 180')).getByText('Za mało graczy w tej kategorii.')).toBeTruthy();
    expect(within(tile('Najwyższe zamknięcie')).queryByText('Za mało graczy w tej kategorii.')).toBeNull();
  });

  it('shows one message instead of the list and tiles without games', async () => {
    rankings = { ...rankingsFixture, games: 0, legs: 0, players: [], bestLegAverage: [], highestCheckout: [], shortestLeg: [], scores180: [] };
    render(<StatsScreen playerId={null} />);
    expect(await screen.findByText('Brak gier w tym filtrze.')).toBeTruthy();
    expect(screen.getByText('Ranking graczy z całej historii · 0 gier, 0 legów')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Liczba 180' })).toBeNull();
    expect(screen.queryByText('Średnia (3 rzutki)')).toBeNull();
  });

  it('refetches with ?type= on a filter change', async () => {
    render(<StatsScreen playerId={null} />);
    await vi.waitFor(() => expect(urls).toContain('/api/stats/rankings?type=all'));
    expect(screen.getByRole('button', { name: 'Wszystkie' }).getAttribute('aria-pressed')).toBe('true');
    for (const [label, type] of [
      ['Mecze 1v1', 'match'],
      ['Zabawa', 'casual'],
      ['Trening', 'practice'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
      await vi.waitFor(() => expect(urls).toContain(`/api/stats/rankings?type=${type}`));
    }
  });

  it('shows an error when the ranking fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(500, { error: 'internal_error', message: 'Internal server error' })),
    );
    render(<StatsScreen playerId={null} />);
    expect(await screen.findByText('Nie udało się pobrać statystyk')).toBeTruthy();
  });
});

describe('StatsScreen: player card', () => {
  it('shows the player card with the all filter and a link back to the ranking', async () => {
    render(<StatsScreen playerId="p1" />);
    expect(screen.getByRole('heading', { name: 'Statystyki' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ranking' }).getAttribute('href')).toBe('#/stats');
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
    render(<StatsScreen playerId="p1" />);
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
    render(<StatsScreen playerId="p1" />);
    expect(await screen.findByText('Brak graczy. Dodaj pierwszego.')).toBeTruthy();
    expect(urls).toContain('/api/players');
  });
});
