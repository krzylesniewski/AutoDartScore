import type {
  HeadToHead,
  MatchListItem,
  Player,
  PlayerFormPoint,
  PlayerStats,
  RankingEntry,
  StatsOverall,
  StatsRankings,
} from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pl } from '../i18n/pl';
import { listItem, player, statLine } from '../test/snapshots';
import { StatsScreen } from './StatsScreen';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const createdAt = '2026-10-15T18:30:00.000Z';
const players: Player[] = [
  { id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, archivedAt: null, createdAt },
  { id: 'p2', name: 'Bartek', avatar: '🎯', color: 7, guest: false, archivedAt: null, createdAt },
];

const emptyHeadToHead: HeadToHead = {
  playerId: 'p1',
  opponentId: 'p2',
  period: 'all',
  matchesPlayed: 0,
  matchesWon: 0,
  opponentMatchesWon: 0,
  legsWon: 0,
  opponentLegsWon: 0,
  average: null,
  opponentAverage: null,
  lastPlayedAt: null,
};

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
    period: 'all',
    matchesPlayed: 2,
    matchesWon: 1,
    winRate: 50,
    ...overrides,
  };
}

function entry(playerId: string, name: string, position: number, value: number): RankingEntry {
  return { playerId, name, avatar: playerId === 'p2' ? '🎯' : null, color: playerId === 'p2' ? 7 : 1, position, value };
}

const rankingsFixture: StatsRankings = {
  filter: 'all',
  period: 'all',
  games: 23,
  legs: 61,
  players: [
    { playerId: 'p1', name: 'Anna', avatar: null, color: 1, position: 1, average: 61.5, legs: 25 },
    { playerId: 'p2', name: 'Bartek', avatar: '🎯', color: 7, position: 2, average: 55.25, legs: 21 },
    { playerId: 'p3', name: 'Celina', avatar: null, color: 3, position: 3, average: 40, legs: 3 },
    { playerId: 'p4', name: 'Darek', avatar: null, color: 16, position: null, average: 70, legs: 2 },
  ],
  bestLegAverage: [entry('p1', 'Anna', 1, 98.33), entry('p2', 'Bartek', 2, 86.5), entry('p3', 'Celina', 3, 74.2)],
  highestCheckout: [entry('p2', 'Bartek', 1, 121), entry('p3', 'Celina', 1, 121), entry('p1', 'Anna', 3, 80), entry('p4', 'Darek', 3, 80)],
  shortestLeg: [entry('p1', 'Anna', 1, 15), entry('p2', 'Bartek', 2, 18)],
  highestTurn: [entry('p2', 'Bartek', 1, 180)],
  winRate: [entry('p1', 'Anna', 1, 66.7), entry('p2', 'Bartek', 2, 33.3)],
  t20Hits: [entry('p2', 'Bartek', 1, 42), entry('p1', 'Anna', 2, 17)],
  t19Hits: [entry('p1', 'Anna', 1, 9)],
  t18Hits: [],
  t5Hits: [entry('p2', 'Bartek', 1, 30), entry('p1', 'Anna', 2, 12)],
  t1Hits: [entry('p2', 'Bartek', 1, 25)],
  doublesPercent: [entry('p1', 'Anna', 1, 41.7), entry('p2', 'Bartek', 2, 20)],
  longestLeg: [entry('p2', 'Bartek', 1, 57), entry('p1', 'Anna', 2, 33)],
};

const overallFixture: StatsOverall = {
  period: 'all',
  games: 23,
  legs: 61,
  darts: 1234,
  average: 75.25,
  players: [
    { playerId: 'p1', name: 'Anna', avatar: null, color: 1, darts: 6, legs: 1, average: 150.5, difference: 75.25 },
    { playerId: 'p2', name: 'Bartek', avatar: '🎯', color: 7, darts: 3, legs: 1, average: 0, difference: -75.25 },
    { playerId: 'p3', name: 'Celina', avatar: null, color: 3, darts: 12, legs: 0, average: null, difference: null },
  ],
};

let urls: string[];
let requests: { url: string; method: string; body: unknown }[];
let respondStats: (url: string) => Response;
let rankings: StatsRankings;
let overall: (period: string) => Response;
let profiles: Player[];
let form: PlayerFormPoint[];
let headToHead: (opponentId: string) => HeadToHead;
let history: MatchListItem[];

beforeEach(() => {
  localStorage.clear();
  urls = [];
  requests = [];
  respondStats = (url) => json(200, stats(/players\/([^/]+)\/stats/.exec(url)?.[1] ?? ''));
  rankings = rankingsFixture;
  overall = (period) => json(200, { ...overallFixture, period });
  profiles = players;
  form = [];
  headToHead = (opponentId) => ({ ...emptyHeadToHead, opponentId });
  history = [];
  window.location.hash = '#/stats';
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      urls.push(url);
      const method = init.method ?? 'GET';
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      requests.push({ url, method, body });
      if (method === 'PATCH') {
        const id = decodeURIComponent(/players\/([^/]+)$/.exec(url)?.[1] ?? '');
        const changes = body as { name?: string; avatar?: string | null; color?: number; archived?: boolean };
        profiles = profiles.map((player) =>
          player.id === id
            ? {
                ...player,
                ...(changes.name === undefined ? {} : { name: changes.name }),
                ...(changes.avatar === undefined ? {} : { avatar: changes.avatar }),
                ...(changes.color === undefined ? {} : { color: changes.color }),
                ...(changes.archived === undefined ? {} : { archivedAt: changes.archived ? '2026-10-18T10:00:00.000Z' : null }),
              }
            : player,
        );
        return Promise.resolve(
          json(
            200,
            profiles.find((player) => player.id === id),
          ),
        );
      }
      if (url === '/api/players?archived=include') {
        return Promise.resolve(json(200, profiles));
      }
      if (url.startsWith('/api/stats/overall')) {
        return Promise.resolve(overall(new URL(url, 'http://localhost').searchParams.get('period') ?? ''));
      }
      if (url.startsWith('/api/stats/rankings')) {
        const query = new URL(url, 'http://localhost').searchParams;
        return Promise.resolve(json(200, { ...rankings, filter: query.get('type'), period: query.get('period') }));
      }
      const formRequest = /^\/api\/players\/([^/]+)\/form\?type=(\w+)&period=(\w+)$/.exec(url);
      if (formRequest) {
        return Promise.resolve(json(200, { playerId: formRequest[1], filter: formRequest[2], period: formRequest[3], points: form }));
      }
      const headToHeadRequest = /\/head-to-head\/([^/?]+)\?period=(\w+)$/.exec(url);
      if (headToHeadRequest) {
        return Promise.resolve(json(200, { ...headToHead(decodeURIComponent(headToHeadRequest[1] ?? '')), period: headToHeadRequest[2] }));
      }
      if (url.startsWith('/api/matches?')) {
        return Promise.resolve(json(200, history));
      }
      return Promise.resolve(respondStats(url));
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
    expect(urls).toContain('/api/stats/rankings?type=all&period=all');

    const list = tile('Średnia (3 rzutki)');
    expect(rows(within(list).getByRole('list', { name: 'Podium średniej' }))).toEqual([
      'AAnna61,50Miejsce 125 legów',
      '🎯Bartek55,25Miejsce 221 legów',
      'CCelina40,00Miejsce 33 legi',
    ]);
    expect(rows(within(list).getByRole('list', { name: 'Dalsze miejsca' }))).toEqual(['DDarek2 legi70,00']);
    for (const [name, id] of [
      ['Anna', 'p1'],
      ['Bartek', 'p2'],
      ['Celina', 'p3'],
      ['Darek', 'p4'],
    ] as const) {
      expect(
        within(list)
          .getByRole('link', { name: new RegExp(name) })
          .getAttribute('href'),
      ).toBe(`#/stats/${id}`);
    }
    expect(within(list).getByText('Średnia od 3 ukończonych legów.')).toBeTruthy();
  });

  it('shows exactly 12 top 5 tiles', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    const tiles = [
      'Win rate',
      'Rekordowy leg (średnia)',
      'Najwyższe zamknięcie',
      'Najkrótszy leg',
      'Najdłuższy wygrany leg',
      'Najwyższa tura',
      'Skuteczność na double',
      'Trafienia T20',
      'Trafienia T19',
      'Trafienia T18',
      'Trafienia T5',
      'Trafienia T1',
    ];
    const records = screen.getByRole('region', { name: 'Rekordy' });
    expect(
      within(records)
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-label')),
    ).toEqual(tiles);
    expect(within(tile('Rekordowy leg (średnia)')).getByText('3 rzutki')).toBeTruthy();
    expect(rows(tile('Rekordowy leg (średnia)'))).toEqual(['1.AAnna98,33', '2.🎯Bartek86,50', '3.CCelina74,20']);
    expect(within(tile('Najwyższe zamknięcie')).getByText('checkout')).toBeTruthy();
    expect(rows(tile('Najwyższe zamknięcie'))).toEqual(['1.🎯Bartek121', '1.CCelina121', '3.AAnna80', '3.DDarek80']);
    expect(within(tile('Najkrótszy leg')).getByText('liczba rzutek')).toBeTruthy();
    expect(within(tile('Najwyższa tura')).getByText('3 lotki, mecze 1v1')).toBeTruthy();
  });

  it('shows the win rate tile in percent with the minimum number of games', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    expect(within(tile('Win rate')).getByText('min. 3 gry')).toBeTruthy();
    expect(rows(tile('Win rate'))).toEqual(['1.AAnna66,7%', '2.🎯Bartek33,3%']);
    expect(within(tile('Win rate')).getByText('Za mało graczy w tej kategorii.')).toBeTruthy();
  });

  it('shows the T20 tile with plain counts', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    expect(within(tile('Trafienia T20')).getByText('rzutki za 60')).toBeTruthy();
    expect(rows(tile('Trafienia T20'))).toEqual(['1.🎯Bartek42', '2.AAnna17']);
  });

  it('shows the T19, T18, T5 and T1 tiles with plain counts', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    expect(within(tile('Trafienia T19')).getByText('rzutki za 57')).toBeTruthy();
    expect(rows(tile('Trafienia T19'))).toEqual(['1.AAnna9']);
    expect(within(tile('Trafienia T18')).getByText('rzutki za 54')).toBeTruthy();
    expect(within(tile('Trafienia T18')).queryAllByRole('listitem')).toEqual([]);
    expect(within(tile('Trafienia T18')).getByText('Za mało graczy w tej kategorii.')).toBeTruthy();
    expect(within(tile('Trafienia T5')).getByText('rzutki za 15')).toBeTruthy();
    expect(rows(tile('Trafienia T5'))).toEqual(['1.🎯Bartek30', '2.AAnna12']);
    expect(within(tile('Trafienia T1')).getByText('rzutki za 3')).toBeTruthy();
    expect(rows(tile('Trafienia T1'))).toEqual(['1.🎯Bartek25']);
  });

  it('shows the doubles tile in percent with the minimum number of attempts', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    expect(within(tile('Skuteczność na double')).getByText('min. 10 prób')).toBeTruthy();
    expect(rows(tile('Skuteczność na double'))).toEqual(['1.AAnna41,7%', '2.🎯Bartek20,0%']);
  });

  it('shows the longest won leg tile with the most darts first', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    expect(within(tile('Najdłuższy wygrany leg')).getByText('liczba rzutek')).toBeTruthy();
    expect(rows(tile('Najdłuższy wygrany leg'))).toEqual(['1.🎯Bartek57', '2.AAnna33']);
  });

  it('says the win rate counts only matches and casual games under the practice filter', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    rankings = { ...rankingsFixture, filter: 'practice', winRate: [] };
    fireEvent.click(screen.getByRole('button', { name: 'Trening' }));
    await vi.waitFor(() => expect(within(tile('Win rate')).getByText('Tylko mecze i zabawa')).toBeTruthy());
    expect(within(tile('Win rate')).queryByText('Za mało graczy w tej kategorii.')).toBeNull();
  });

  it('marks the leaders in the list and in the tiles', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    const leaders = (container: HTMLElement) => [...container.querySelectorAll('[data-leader]')].map((row) => row.textContent);
    expect(leaders(tile('Średnia (3 rzutki)'))).toEqual(['AAnna61,50Miejsce 125 legów']);
    expect(leaders(tile('Najwyższe zamknięcie'))).toEqual(['1.🎯Bartek121', '1.CCelina121']);
  });

  it('says when a tile has fewer than 3 players', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    expect(within(tile('Najkrótszy leg')).getByText('Za mało graczy w tej kategorii.')).toBeTruthy();
    expect(within(tile('Najwyższa tura')).getByText('Za mało graczy w tej kategorii.')).toBeTruthy();
    expect(within(tile('Najwyższe zamknięcie')).queryByText('Za mało graczy w tej kategorii.')).toBeNull();
  });

  it('says the highest turn counts only 1v1 matches under the casual and practice filters', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    for (const [label, filter] of [
      ['Zabawa', 'casual'],
      ['Trening', 'practice'],
    ] as const) {
      rankings = { ...rankingsFixture, filter, highestTurn: [] };
      fireEvent.click(screen.getByRole('button', { name: label }));
      await vi.waitFor(() => expect(within(tile('Najwyższa tura')).getByText('Tylko mecze 1v1')).toBeTruthy());
      expect(within(tile('Najwyższa tura')).queryByText('Za mało graczy w tej kategorii.')).toBeNull();
      expect(within(tile('Najkrótszy leg')).getByText('Za mało graczy w tej kategorii.')).toBeTruthy();
    }
  });

  it('shows one message instead of the list and tiles without games', async () => {
    rankings = {
      ...rankingsFixture,
      games: 0,
      legs: 0,
      players: [],
      bestLegAverage: [],
      highestCheckout: [],
      shortestLeg: [],
      highestTurn: [],
      winRate: [],
      t20Hits: [],
      t19Hits: [],
      t18Hits: [],
      t5Hits: [],
      t1Hits: [],
      doublesPercent: [],
      longestLeg: [],
    };
    render(<StatsScreen playerId={null} />);
    expect(await screen.findByText('Brak gier w tym filtrze.')).toBeTruthy();
    expect(screen.getByText('Ranking graczy z całej historii · 0 gier, 0 legów')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Najwyższa tura' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Rekordy' })).toBeNull();
    expect(screen.queryByText('Średnia (3 rzutki)')).toBeNull();
  });

  it('refetches with ?type= on a filter change', async () => {
    render(<StatsScreen playerId={null} />);
    await vi.waitFor(() => expect(urls).toContain('/api/stats/rankings?type=all&period=all'));
    expect(screen.getByRole('button', { name: 'Wszystkie' }).getAttribute('aria-pressed')).toBe('true');
    for (const [label, type] of [
      ['Mecze 1v1', 'match'],
      ['Turniej', 'tournament'],
      ['Zabawa', 'casual'],
      ['Trening', 'practice'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
      await vi.waitFor(() => expect(urls).toContain(`/api/stats/rankings?type=${type}&period=all`));
    }
  });

  it('shows an error when the ranking fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(500, { error: 'internal_error', message: 'Internal server error' }))),
    );
    render(<StatsScreen playerId={null} />);
    expect(await screen.findByText('Nie udało się pobrać statystyk')).toBeTruthy();
  });
});

describe('StatsScreen: overall', () => {
  const filterLabels = ['Wszystkie', 'Mecze 1v1', 'Turniej', 'Zabawa', 'Trening'];

  function filterButtons(): string[] {
    const bar = screen.getByRole('button', { name: 'Wszystkie' }).parentElement as HTMLElement;
    return within(bar)
      .getAllByRole('button')
      .map((button) => button.textContent ?? '');
  }

  async function openOverall(): Promise<void> {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    fireEvent.click(screen.getByRole('button', { name: 'Overall' }));
  }

  it('puts Overall right after Trening in the ranking filter only', async () => {
    const { unmount } = render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    expect(filterButtons()).toEqual([...filterLabels, 'Overall']);
    unmount();

    render(<StatsScreen playerId="p1" />);
    await screen.findByRole('button', { name: 'Anna' });
    expect(filterButtons()).toEqual(filterLabels);
    expect(screen.queryByRole('button', { name: 'Overall' })).toBeNull();
  });

  it('separates Overall from the filters with a hidden divider in the ranking only', async () => {
    const { unmount } = render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    const training = screen.getByRole('button', { name: 'Trening' });
    const divider = training.nextElementSibling;
    expect(divider?.getAttribute('aria-hidden')).toBe('true');
    expect(divider?.tagName).not.toBe('BUTTON');
    expect(divider?.textContent).toBe('');
    expect(divider?.nextElementSibling).toBe(screen.getByRole('button', { name: 'Overall' }));
    unmount();

    render(<StatsScreen playerId="p1" />);
    await screen.findByRole('button', { name: 'Anna' });
    const bar = screen.getByRole('button', { name: 'Wszystkie' }).parentElement as HTMLElement;
    expect(bar.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Trening' }).nextElementSibling).toBeNull();
  });

  it('shows the totals and the players above and below the overall average', async () => {
    await openOverall();
    expect(await screen.findByText('Wszystkie gry liczone do statystyk razem')).toBeTruthy();
    expect(urls).toContain('/api/stats/overall?period=all');
    expect(window.location.hash).toBe('#/stats');
    expect(screen.getByRole('button', { name: 'Overall' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Wszystkie' }).getAttribute('aria-pressed')).toBe('false');

    expect(value('Lotki łącznie')).toBe('1234');
    expect(value('Średnia ogólna (3 rzutki)')).toBe('75,25');
    expect(value('Gry')).toBe('23');
    expect(value('Legi')).toBe('61');
    expect(within(card()).getAllByRole('term')).toHaveLength(4);

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Typ gry',
      'Okres',
      'Powyżej średniej',
      'Poniżej średniej',
      'Bez ukończonego lega',
    ]);
    expect(rows(screen.getByRole('region', { name: 'Powyżej średniej' }))).toEqual(['AAnna150,50+75,256 lotek']);
    expect(rows(screen.getByRole('region', { name: 'Poniżej średniej' }))).toEqual(['🎯Bartek0,00−75,253 lotki']);
    expect(rows(screen.getByRole('region', { name: 'Bez ukończonego lega' }))).toEqual(['CCelina—12 lotek']);
    expect(screen.queryByRole('region', { name: 'Średnia (3 rzutki)' })).toBeNull();
  });

  it('shows the ranking again after another filter', async () => {
    await openOverall();
    await screen.findByText('Wszystkie gry liczone do statystyk razem');
    fireEvent.click(screen.getByRole('button', { name: 'Zabawa' }));
    expect(await screen.findByRole('region', { name: 'Średnia (3 rzutki)' })).toBeTruthy();
    expect(urls).toContain('/api/stats/rankings?type=casual&period=all');
    expect(screen.queryByText('Powyżej średniej')).toBeNull();
    expect(screen.getByRole('button', { name: 'Overall' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows loading and then the error when the overview fails', async () => {
    overall = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    await openOverall();
    expect(screen.getByText('Ładowanie…')).toBeTruthy();
    expect(await screen.findByText('Nie udało się pobrać statystyk')).toBeTruthy();
  });

  it('shows one message without darts', async () => {
    overall = () => json(200, { period: 'all', games: 0, legs: 0, darts: 0, average: null, players: [] });
    await openOverall();
    expect(await screen.findByText('Brak gier w tym filtrze.')).toBeTruthy();
    expect(screen.getByText('Wszystkie gry liczone do statystyk razem')).toBeTruthy();
    expect(document.querySelector('dl')).toBeNull();
  });
});

describe('StatsScreen: player card', () => {
  it('shows the player card with the all filter and a link back to the ranking', async () => {
    render(<StatsScreen playerId="p1" />);
    expect(screen.getByRole('heading', { name: 'Statystyki' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ranking' }).getAttribute('href')).toBe('#/stats');
    await vi.waitFor(() => expect(document.querySelector('dl')).not.toBeNull());
    expect(urls).toContain('/api/players/p1/stats?type=all&period=all');
    expect(screen.getByRole('button', { name: 'Anna' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Wszystkie' }).getAttribute('aria-pressed')).toBe('true');
    expect(value('Rzutki')).toBe('15');
    expect(value('Średnia (3 rzutki)')).toBe('88,40');
    expect(value('First 9')).toBe('100,33');
    expect(value('180')).toBe('1');
    expect(value('140+')).toBe('1');
    expect(value('100+')).toBe('1');
    expect(value('60+')).toBe('0');
    expect(value('Najwyższe zamknięcie')).toBe('141');
    expect(value('% doubli')).toBe('66,7% (2/3)');
    expect(value('Najlepszy leg')).toBe('6 rzutek');
    expect(value('Wygrane legi')).toBe('1');
    expect(value('Wygrane mecze')).toBe('1/2');
    expect(value('Trafienia T20')).toBe('0');
    expect(value('Win rate')).toBe('50,0%');
  });

  it('shows T20 hits after 60+ and a dash for the win rate without finished games', async () => {
    respondStats = () => json(200, stats('p1', { winRate: null, t20Hits: 7 }));
    render(<StatsScreen playerId="p1" />);
    await vi.waitFor(() => expect(document.querySelector('dl')).not.toBeNull());
    expect(value('Win rate')).toBe('—');
    expect(value('Trafienia T20')).toBe('7');
    const terms = [...card().querySelectorAll('dt')].map((term) => term.textContent);
    expect(terms.indexOf('Trafienia T20')).toBe(terms.indexOf('60+') + 1);
    expect(terms.at(-1)).toBe('Win rate');
  });

  it('sends the chosen filter as ?type=', async () => {
    render(<StatsScreen playerId="p2" />);
    await vi.waitFor(() => expect(urls).toContain('/api/players/p2/stats?type=all&period=all'));
    for (const [label, type] of [
      ['Mecze 1v1', 'match'],
      ['Turniej', 'tournament'],
      ['Zabawa', 'casual'],
      ['Trening', 'practice'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
      await vi.waitFor(() => expect(urls).toContain(`/api/players/p2/stats?type=${type}&period=all`));
    }
  });

  it('sets the hash when a player is chosen', async () => {
    render(<StatsScreen playerId="p1" />);
    // Pierwszy jest chip na liście graczy, drugi to wybór rywala w bilansie.
    const [chip] = await screen.findAllByRole('button', { name: /Bartek/ });
    fireEvent.click(chip as HTMLElement);
    expect(window.location.hash).toBe('#/stats/p2');
  });

  it('shows Brak rzutów for a player without throws', async () => {
    respondStats = () => json(200, { ...stats('p1'), ...statLine(), matchesPlayed: 0, matchesWon: 0, winRate: null });
    render(<StatsScreen playerId="p1" />);
    expect(await screen.findByText('Brak rzutów')).toBeTruthy();
    expect(document.querySelector('dl')).toBeNull();
  });

  it('shows an error for an unknown player in the hash', async () => {
    respondStats = () => json(404, { error: 'not_found', message: 'Player nobody not found' });
    render(<StatsScreen playerId="nobody" />);
    expect(await screen.findByText('Nie znaleziono gracza')).toBeTruthy();
    expect(urls).toContain('/api/players/nobody/stats?type=all&period=all');
  });

  it('shows an error when the stats request fails', async () => {
    respondStats = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    render(<StatsScreen playerId="p1" />);
    expect(await screen.findByText('Nie udało się pobrać statystyk')).toBeTruthy();
  });

  it('shows Brak graczy without profiles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        urls.push(url);
        return Promise.resolve(json(200, []));
      }),
    );
    render(<StatsScreen playerId="p1" />);
    expect(await screen.findByText('Brak graczy. Dodaj pierwszego.')).toBeTruthy();
    expect(urls).toContain('/api/players?archived=include');
  });
});

describe('StatsScreen: player profile', () => {
  function profileSection(): HTMLElement {
    return screen.getByRole('region', { name: 'Anna' });
  }

  it('edits the name and avatar with a PATCH and refreshes the card', async () => {
    render(<StatsScreen playerId="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edytuj profil' }));
    const dialog = screen.getByRole('dialog', { name: 'Edytuj profil' });
    expect(within(dialog).getByLabelText<HTMLInputElement>('Imię').value).toBe('Anna');
    fireEvent.change(within(dialog).getByLabelText('Imię'), { target: { value: ' Ania ' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Inne emoji' }), { target: { value: '🦊' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Ania' })).toBeTruthy();
    expect(requests.filter((request) => request.method === 'PATCH')).toEqual([
      { url: '/api/players/p1', method: 'PATCH', body: { name: 'Ania', avatar: '🦊', color: 1 } },
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ania' }).getAttribute('aria-pressed')).toBe('true');
    expect(urls.filter((url) => url === '/api/players?archived=include')).toHaveLength(2);
  });

  it('checks the current color and sends a newly chosen one', async () => {
    render(<StatsScreen playerId="p2" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edytuj profil' }));
    const dialog = screen.getByRole('dialog', { name: 'Edytuj profil' });
    const checked = within(within(dialog).getByRole('group', { name: 'Kolor' }))
      .getAllByRole<HTMLInputElement>('radio')
      .filter((radio) => radio.checked);
    expect(checked.map((radio) => radio.getAttribute('aria-label'))).toEqual(['Różowy']);
    expect(checked[0]?.closest('label')?.textContent).toBe('✓');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Błękitny' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requests.filter((request) => request.method === 'PATCH')).toEqual([
      { url: '/api/players/p2', method: 'PATCH', body: { name: 'Bartek', color: 12 } },
    ]);
    // Stały kolor awatara gracza widać tylko w klasie tokenu, więc nowy kolor na karcie sprawdza klasa.
    await vi.waitFor(() =>
      expect(within(screen.getByRole('region', { name: 'Bartek' })).getByText('🎯').className).toContain('bg-(--color-avatar-12)'),
    );
  });

  it('keeps the chosen head-to-head opponent after an edit', async () => {
    render(<StatsScreen playerId="p1" />);
    const panel = await screen.findByRole('region', { name: 'Bilans 1v1' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Bartek' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edytuj profil' }));
    fireEvent.change(screen.getByLabelText('Imię'), { target: { value: 'Ania' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Ania' })).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Bilans 1v1' }))
        .getByRole('button', { name: 'Bartek' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('sends avatar null for an empty avatar, and Escape cancels', async () => {
    profiles = [{ ...players[0], avatar: '🎯' } as Player, players[1] as Player];
    render(<StatsScreen playerId="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edytuj profil' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edytuj profil' }));
    const dialog = screen.getByRole('dialog', { name: 'Edytuj profil' });
    expect(within(dialog).getByRole<HTMLInputElement>('radio', { name: '🎯' }).checked).toBe(true);
    fireEvent.click(within(dialog).getByRole('radio', { name: /Bez emoji/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zapisz' }));
    await vi.waitFor(() =>
      expect(requests.find((request) => request.method === 'PATCH')?.body).toEqual({ name: 'Anna', avatar: null, color: 1 }),
    );
  });

  it('shows an API error in the edit dialog', async () => {
    render(<StatsScreen playerId="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edytuj profil' }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(400, { error: 'invalid_request', message: 'Invalid request: name: Too big' }))),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await within(screen.getByRole('dialog')).findByText(pl.invalidRequest)).toBeTruthy();
    expect(screen.queryByText('Invalid request: name: Too big')).toBeNull();
  });

  it('asks before archiving and shows the archived badge after it', async () => {
    render(<StatsScreen playerId="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archiwizuj' }));
    expect(screen.getByRole('dialog', { name: 'Zarchiwizować gracza?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(requests.some((request) => request.method === 'PATCH')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Archiwizuj' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archiwizuj' }));
    expect(await screen.findByRole('button', { name: 'Przywróć' })).toBeTruthy();
    expect(requests.filter((request) => request.method === 'PATCH').map((request) => request.body)).toEqual([{ archived: true }]);
    expect(within(profileSection()).getByText('Zarchiwizowany')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'AnnaZarchiwizowany' })).toBeTruthy();
  });

  it('restores an archived player without a confirmation', async () => {
    profiles = [{ ...players[0], archivedAt: '2026-10-17T10:00:00.000Z' } as Player, players[1] as Player];
    render(<StatsScreen playerId="p1" />);
    expect(await screen.findByRole('button', { name: 'AnnaZarchiwizowany' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Przywróć' }));
    expect(await screen.findByRole('button', { name: 'Archiwizuj' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(requests.filter((request) => request.method === 'PATCH').map((request) => request.body)).toEqual([{ archived: false }]);
    expect(within(profileSection()).queryByText('Zarchiwizowany')).toBeNull();
  });
});

describe('StatsScreen: form chart', () => {
  it('shows an empty state without completed legs', async () => {
    render(<StatsScreen playerId="p1" />);
    expect(await screen.findByText('Brak ukończonych legów.')).toBeTruthy();
    expect(urls).toContain('/api/players/p1/form?type=all&period=all');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('describes the chart and lists the values for screen readers', async () => {
    form = [
      { matchId: 'm1', type: 'match', createdAt: '2026-10-15T18:30:00.000Z', average: 45.5, legs: 2 },
      { matchId: 'm2', type: 'practice', createdAt: '2026-10-16T18:30:00.000Z', average: 60.25, legs: 1 },
    ];
    render(<StatsScreen playerId="p1" />);
    const chart = await screen.findByRole('img', { name: 'Wykres formy: 2 gry, ostatnia średnia 60,25' });
    expect(chart.querySelectorAll('circle')).toHaveLength(2);
    expect(chart.querySelector('path')).not.toBeNull();
    const values = within(chart.parentElement as HTMLElement).getByRole('list');
    expect(
      within(values)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Gra 1: 45,50', 'Gra 2: 60,25']);
    expect(chart.parentElement?.textContent).toContain('60,25');
  });

  it('draws one dot for a single game and follows the filter', async () => {
    form = [{ matchId: 'm1', type: 'match', createdAt: '2026-10-15T18:30:00.000Z', average: 45.5, legs: 1 }];
    render(<StatsScreen playerId="p1" />);
    const chart = await screen.findByRole('img', { name: 'Wykres formy: 1 gra, ostatnia średnia 45,50' });
    expect(chart.querySelectorAll('circle')).toHaveLength(1);
    expect(chart.querySelector('path')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mecze 1v1' }));
    await vi.waitFor(() => expect(urls).toContain('/api/players/p1/form?type=match&period=all'));
  });

  it('sends type=tournament for the Turniej filter', async () => {
    render(<StatsScreen playerId="p1" />);
    await vi.waitFor(() => expect(urls).toContain('/api/players/p1/form?type=all&period=all'));
    // Rola button, bo w nawigacji jest też link „Turniej”.
    fireEvent.click(screen.getByRole('button', { name: 'Turniej' }));
    expect(screen.getByRole('button', { name: 'Turniej' }).getAttribute('aria-pressed')).toBe('true');
    await vi.waitFor(() => expect(urls).toContain('/api/players/p1/form?type=tournament&period=all'));
    expect(urls).toContain('/api/players/p1/stats?type=tournament&period=all');
  });
});

describe('StatsScreen: head-to-head', () => {
  function panel(): HTMLElement {
    return screen.getByRole('region', { name: 'Bilans 1v1' });
  }

  it('shows matches, legs and both averages against the chosen opponent', async () => {
    headToHead = (opponentId) => ({
      ...emptyHeadToHead,
      opponentId,
      matchesPlayed: 4,
      matchesWon: 3,
      opponentMatchesWon: 1,
      legsWon: 7,
      opponentLegsWon: 4,
      average: 61.5,
      opponentAverage: 55.25,
    });
    render(<StatsScreen playerId="p1" />);
    await screen.findByRole('region', { name: 'Bilans 1v1' });
    expect(within(panel()).getByText('Wybierz rywala.')).toBeTruthy();
    expect(within(panel()).queryByRole('button', { name: 'Anna' })).toBeNull();
    const bartek = within(panel()).getByRole('button', { name: 'Bartek' });
    fireEvent.click(bartek);
    expect(bartek.getAttribute('aria-pressed')).toBe('true');
    expect(await within(panel()).findByText('3 : 1')).toBeTruthy();
    expect(urls).toContain('/api/players/p1/head-to-head/p2?period=all');
    const values = [...panel().querySelectorAll('dt')].map((term) => `${term.textContent}=${term.nextElementSibling?.textContent}`);
    expect(values).toEqual(['Mecze=3 : 1', 'Legi=7 : 4', 'Średnia: Anna=61,50', 'Średnia: Bartek=55,25']);
  });

  it('says when there is no finished 1v1 match', async () => {
    render(<StatsScreen playerId="p1" />);
    await screen.findByRole('region', { name: 'Bilans 1v1' });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Bartek' }));
    expect(await within(panel()).findByText('Brak ukończonych meczów 1v1 z tym graczem.')).toBeTruthy();
  });
});

describe('StatsScreen: player history', () => {
  it('lists the games of the player with links to the details', async () => {
    history = [
      listItem({
        id: 'm9',
        status: 'finished',
        winnerId: 'p1',
        players: [player('p1', 'Anna', { legsWon: 2 }), player('p2', 'Bartek', { legsWon: 1 })],
      }),
    ];
    render(<StatsScreen playerId="p1" />);
    const section = await screen.findByRole('region', { name: 'Historia gier' });
    expect(await within(section).findByText('Anna 2 : 1 Bartek')).toBeTruthy();
    expect(urls).toContain('/api/matches?playerId=p1');
    expect(within(section).getByText('Wygrywa Anna')).toBeTruthy();
    expect(within(section).getByRole('link', { name: 'Szczegóły: Anna 2 : 1 Bartek' }).getAttribute('href')).toBe('#/matches/m9');
  });

  it('repeats the game date in the type line of a history row', async () => {
    history = [
      listItem({
        id: 'm9',
        status: 'finished',
        winnerId: 'p1',
        players: [player('p1', 'Anna', { legsWon: 2 }), player('p2', 'Bartek', { legsWon: 1 })],
      }),
    ];
    render(<StatsScreen playerId="p1" />);
    const section = await screen.findByRole('region', { name: 'Historia gier' });
    await within(section).findByText('Anna 2 : 1 Bartek');
    const row = within(section).getAllByRole('listitem')[0] as HTMLElement;
    const times = [...row.querySelectorAll('time')];
    expect(times).toHaveLength(2);
    expect(times[1]?.getAttribute('datetime')).toBe(times[0]?.getAttribute('datetime'));
    expect(
      within(row)
        .getByText(/^Mecz 1v1 · /)
        .contains(times[1] as HTMLElement),
    ).toBe(true);
  });
});

describe('StatsScreen: period', () => {
  function periodButton(name: string): HTMLElement {
    return within(screen.getByRole('region', { name: 'Okres' })).getByRole('button', { name });
  }

  function pressed(name: string): string | null {
    return periodButton(name).getAttribute('aria-pressed');
  }

  it('narrows the ranking to the chosen period', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    expect(
      within(screen.getByRole('region', { name: 'Okres' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['7 dni', '30 dni', 'Cały czas']);
    expect(pressed('Cały czas')).toBe('true');
    expect(urls).toContain('/api/stats/rankings?type=all&period=all');
    for (const [label, period] of [
      ['7 dni', '7d'],
      ['30 dni', '30d'],
    ] as const) {
      fireEvent.click(periodButton(label));
      expect(pressed(label)).toBe('true');
      expect(pressed('Cały czas')).toBe('false');
      await vi.waitFor(() => expect(urls).toContain(`/api/stats/rankings?type=all&period=${period}`));
    }
  });

  it('names the period and gives the counts of the response in the ranking subtitle', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    rankings = { ...rankingsFixture, games: 5, legs: 12 };
    fireEvent.click(periodButton('30 dni'));
    expect(await screen.findByText('Ranking graczy z ostatnich 30 dni · 5 gier, 12 legów')).toBeTruthy();
  });

  it('narrows Overall to the chosen period', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    fireEvent.click(screen.getByRole('button', { name: 'Overall' }));
    await screen.findByText('Wszystkie gry liczone do statystyk razem');
    fireEvent.click(periodButton('30 dni'));
    expect(await screen.findByText('Wszystkie gry z ostatnich 30 dni liczone do statystyk razem')).toBeTruthy();
    expect(urls).toContain('/api/stats/overall?period=30d');
    expect(screen.getByRole('button', { name: 'Overall' }).getAttribute('aria-pressed')).toBe('true');
    expect(pressed('30 dni')).toBe('true');
  });

  it('narrows stats, form and head-to-head on the player card but not the history', async () => {
    render(<StatsScreen playerId="p1" />);
    const panel = await screen.findByRole('region', { name: 'Bilans 1v1' });
    expect(pressed('Cały czas')).toBe('true');
    fireEvent.click(within(panel).getByRole('button', { name: 'Bartek' }));
    await vi.waitFor(() => expect(urls).toContain('/api/players/p1/head-to-head/p2?period=all'));
    await vi.waitFor(() => expect(urls).toContain('/api/matches?playerId=p1'));

    fireEvent.click(periodButton('30 dni'));
    expect(pressed('30 dni')).toBe('true');
    await vi.waitFor(() => {
      expect(urls).toContain('/api/players/p1/stats?type=all&period=30d');
      expect(urls).toContain('/api/players/p1/form?type=all&period=30d');
      expect(urls).toContain('/api/players/p1/head-to-head/p2?period=30d');
    });
    expect(
      within(screen.getByRole('region', { name: 'Bilans 1v1' }))
        .getByRole('button', { name: 'Bartek' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      await within(screen.getByRole('region', { name: 'Bilans 1v1' })).findByText('Brak ukończonych meczów 1v1 z tym graczem.'),
    ).toBeTruthy();
    expect(urls.filter((url) => url.startsWith('/api/matches'))).toEqual(['/api/matches?playerId=p1']);
  });

  it('keeps the choice from the ranking to the player card and back', async () => {
    const { rerender } = render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    const start = urls.length;
    fireEvent.click(periodButton('30 dni'));
    await screen.findByText('Ranking graczy z ostatnich 30 dni · 23 gry, 61 legów');

    rerender(<StatsScreen playerId="p1" />);
    await vi.waitFor(() => expect(urls).toContain('/api/players/p1/stats?type=all&period=30d'));
    expect(urls).toContain('/api/players/p1/form?type=all&period=30d');
    expect(pressed('30 dni')).toBe('true');

    rerender(<StatsScreen playerId={null} />);
    expect(pressed('30 dni')).toBe('true');
    await vi.waitFor(() => expect(urls.filter((url) => url === '/api/stats/rankings?type=all&period=30d')).toHaveLength(2));
    expect(await screen.findByText('Ranking graczy z ostatnich 30 dni · 23 gry, 61 legów')).toBeTruthy();
    expect(urls.slice(start).filter((url) => url.includes('period=all'))).toEqual([]);
  });

  it('keeps the choice after a fresh mount through localStorage', async () => {
    const { unmount } = render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    fireEvent.click(periodButton('30 dni'));
    await screen.findByText('Ranking graczy z ostatnich 30 dni · 23 gry, 61 legów');
    expect(localStorage.getItem('autoscore.statsPeriod')).toBe('30d');
    unmount();

    const start = urls.length;
    render(<StatsScreen playerId={null} />);
    expect(pressed('30 dni')).toBe('true');
    expect(await screen.findByText('Ranking graczy z ostatnich 30 dni · 23 gry, 61 legów')).toBeTruthy();
    expect(urls.slice(start).filter((url) => url.startsWith('/api/stats/'))).toEqual(['/api/stats/rankings?type=all&period=30d']);
  });

  it('shows the empty ranking text for a period without games', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    rankings = {
      ...rankingsFixture,
      games: 0,
      legs: 0,
      players: [],
      bestLegAverage: [],
      highestCheckout: [],
      shortestLeg: [],
      highestTurn: [],
      winRate: [],
      t20Hits: [],
      t19Hits: [],
      t18Hits: [],
      t5Hits: [],
      t1Hits: [],
      doublesPercent: [],
      longestLeg: [],
    };
    fireEvent.click(periodButton('30 dni'));
    expect(await screen.findByText('Brak gier w tym filtrze.')).toBeTruthy();
    expect(screen.getByText('Ranking graczy z ostatnich 30 dni · 0 gier, 0 legów')).toBeTruthy();
    expect(screen.queryByText('Nie udało się pobrać statystyk')).toBeNull();
  });

  it('shows Brak rzutów for a player without throws in the period', async () => {
    respondStats = (url) =>
      url.endsWith('period=30d')
        ? json(200, { ...stats('p1'), ...statLine(), period: '30d', matchesPlayed: 0, matchesWon: 0, winRate: null })
        : json(200, stats('p1'));
    render(<StatsScreen playerId="p1" />);
    await vi.waitFor(() => expect(document.querySelector('dl')).not.toBeNull());
    fireEvent.click(periodButton('30 dni'));
    expect(await screen.findByText('Brak rzutów')).toBeTruthy();
    expect(screen.queryByText('Nie udało się pobrać statystyk')).toBeNull();
    expect(screen.getByText('Brak ukończonych legów.')).toBeTruthy();
  });
});

describe('StatsScreen: keyboard and reading order', () => {
  // Typ gry i okres są grupami przycisków ze stanem, a typ stoi w kolejności czytania przed okresem.
  function expectFilters(typeName: string): void {
    const type = screen.getByRole('region', { name: typeName });
    const period = screen.getByRole('region', { name: 'Okres' });
    expect(type.compareDocumentPosition(period) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const buttons = within(type).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) {
      expect(button.hasAttribute('aria-pressed')).toBe(true);
    }
  }

  it('makes the record tiles one region the keyboard can reach', async () => {
    render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    const records = screen.getByRole('region', { name: 'Rekordy' });
    // Od xl region przewija się sam, więc bez fokusu nie da się go przewinąć z klawiatury.
    expect(records.getAttribute('tabindex')).toBe('0');
    expect(records.contains(tile('Najkrótszy leg'))).toBe(true);
  });

  it('puts the ranking link before the title and hides its arrow from screen readers', async () => {
    render(<StatsScreen playerId="p1" />);
    await screen.findByRole('button', { name: 'Anna' });
    const link = screen.getByRole('link', { name: 'Ranking' });
    expect(link.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.getAttribute('href')).toBe('#/stats');
    expect(within(link).getByText('←').getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the type filter as pressable buttons before the period filter in both views', async () => {
    const { unmount } = render(<StatsScreen playerId={null} />);
    await screen.findByText('Ranking graczy z całej historii · 23 gry, 61 legów');
    expectFilters('Typ gry');
    unmount();

    render(<StatsScreen playerId="p1" />);
    await screen.findByRole('button', { name: 'Anna' });
    expectFilters('Typ gier');
  });
});
