import type { HeadToHead, MatchListItem, Player, PlayerFormPoint, PlayerStats, RankingEntry, StatsRankings } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, player, statLine } from '../test/snapshots';
import { StatsScreen } from './StatsScreen';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const createdAt = '2026-10-15T18:30:00.000Z';
const players: Player[] = [
  { id: 'p1', name: 'Anna', avatar: null, guest: false, archivedAt: null, createdAt },
  { id: 'p2', name: 'Bartek', avatar: '🎯', guest: false, archivedAt: null, createdAt },
];

const emptyHeadToHead: HeadToHead = {
  playerId: 'p1',
  opponentId: 'p2',
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
  highestTurn: [entry('p2', 'Bartek', 1, 180)],
};

let urls: string[];
let requests: { url: string; method: string; body: unknown }[];
let respondStats: (url: string) => Response;
let rankings: StatsRankings;
let profiles: Player[];
let form: PlayerFormPoint[];
let headToHead: (opponentId: string) => HeadToHead;
let history: MatchListItem[];

beforeEach(() => {
  urls = [];
  requests = [];
  respondStats = (url) => json(200, stats(/players\/([^/]+)\/stats/.exec(url)?.[1] ?? ''));
  rankings = rankingsFixture;
  profiles = players;
  form = [];
  headToHead = (opponentId) => ({ ...emptyHeadToHead, opponentId });
  history = [];
  window.location.hash = '#/stats';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      urls.push(url);
      const method = init.method ?? 'GET';
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      requests.push({ url, method, body });
      if (method === 'PATCH') {
        const id = decodeURIComponent(/players\/([^/]+)$/.exec(url)?.[1] ?? '');
        const changes = body as { name?: string; avatar?: string | null; archived?: boolean };
        profiles = profiles.map((player) =>
          player.id === id
            ? {
                ...player,
                ...(changes.name === undefined ? {} : { name: changes.name }),
                ...(changes.avatar === undefined ? {} : { avatar: changes.avatar }),
                ...(changes.archived === undefined ? {} : { archivedAt: changes.archived ? '2026-10-18T10:00:00.000Z' : null }),
              }
            : player,
        );
        return json(200, profiles.find((player) => player.id === id));
      }
      if (url === '/api/players?archived=include') {
        return json(200, profiles);
      }
      if (url.startsWith('/api/stats/rankings')) {
        return json(200, { ...rankings, filter: new URL(url, 'http://localhost').searchParams.get('type') });
      }
      const formRequest = /^\/api\/players\/([^/]+)\/form\?type=(\w+)$/.exec(url);
      if (formRequest) {
        return json(200, { playerId: formRequest[1], filter: formRequest[2], points: form });
      }
      const headToHeadRequest = /\/head-to-head\/([^/]+)$/.exec(url);
      if (headToHeadRequest) {
        return json(200, headToHead(decodeURIComponent(headToHeadRequest[1] ?? '')));
      }
      if (url.startsWith('/api/matches?')) {
        return json(200, history);
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
    const tiles = ['Rekordowy leg (średnia)', 'Najwyższe zamknięcie', 'Najkrótszy leg', 'Najwyższa tura'];
    expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label')).filter(Boolean)).toEqual(tiles);
    expect(screen.queryByText('% doubli')).toBeNull();
    expect(within(tile('Rekordowy leg (średnia)')).getByText('3 rzutki')).toBeTruthy();
    expect(rows(tile('Rekordowy leg (średnia)'))).toEqual(['1.AAnna98.33', '2.🎯Bartek86.50', '3.CCelina74.20']);
    expect(within(tile('Najwyższe zamknięcie')).getByText('checkout')).toBeTruthy();
    expect(rows(tile('Najwyższe zamknięcie'))).toEqual(['1.🎯Bartek121', '1.CCelina121', '3.AAnna80', '3.DDarek80']);
    expect(within(tile('Najkrótszy leg')).getByText('liczba rzutek')).toBeTruthy();
    expect(within(tile('Najwyższa tura')).getByText('3 lotki, mecze 1v1')).toBeTruthy();
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
    rankings = { ...rankingsFixture, games: 0, legs: 0, players: [], bestLegAverage: [], highestCheckout: [], shortestLeg: [], highestTurn: [] };
    render(<StatsScreen playerId={null} />);
    expect(await screen.findByText('Brak gier w tym filtrze.')).toBeTruthy();
    expect(screen.getByText('Ranking graczy z całej historii · 0 gier, 0 legów')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Najwyższa tura' })).toBeNull();
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
    // Pierwszy jest chip na liście graczy, drugi to wybór rywala w bilansie.
    const [chip] = await screen.findAllByRole('button', { name: /Bartek/ });
    fireEvent.click(chip as HTMLElement);
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
    expect((within(dialog).getByLabelText('Imię') as HTMLInputElement).value).toBe('Anna');
    fireEvent.change(within(dialog).getByLabelText('Imię'), { target: { value: ' Ania ' } });
    fireEvent.change(within(dialog).getByLabelText('Avatar (emoji)'), { target: { value: '🦊' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zapisz' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Ania' })).toBeTruthy();
    expect(requests.filter((request) => request.method === 'PATCH')).toEqual([{ url: '/api/players/p1', method: 'PATCH', body: { name: 'Ania', avatar: '🦊' } }]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ania' }).getAttribute('aria-pressed')).toBe('true');
    expect(urls.filter((url) => url === '/api/players?archived=include')).toHaveLength(2);
  });

  it('keeps the chosen head-to-head opponent after an edit', async () => {
    render(<StatsScreen playerId="p1" />);
    const panel = await screen.findByRole('region', { name: 'Bilans 1v1' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Bartek' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edytuj profil' }));
    fireEvent.change(screen.getByLabelText('Imię'), { target: { value: 'Ania' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Ania' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Bilans 1v1' })).getByRole('button', { name: 'Bartek' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('sends avatar null for an empty avatar, and Escape cancels', async () => {
    profiles = [{ ...players[0], avatar: '🎯' } as Player, players[1] as Player];
    render(<StatsScreen playerId="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edytuj profil' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edytuj profil' }));
    const dialog = screen.getByRole('dialog', { name: 'Edytuj profil' });
    expect((within(dialog).getByLabelText('Avatar (emoji)') as HTMLInputElement).value).toBe('🎯');
    fireEvent.change(within(dialog).getByLabelText('Avatar (emoji)'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zapisz' }));
    await vi.waitFor(() => expect(requests.find((request) => request.method === 'PATCH')?.body).toEqual({ name: 'Anna', avatar: null }));
  });

  it('shows an API error in the edit dialog', async () => {
    render(<StatsScreen playerId="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edytuj profil' }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(400, { error: 'invalid_request', message: 'Invalid request: name: Too big' })),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await within(screen.getByRole('dialog')).findByText('Invalid request: name: Too big')).toBeTruthy();
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
    expect(urls).toContain('/api/players/p1/form?type=all');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('describes the chart and lists the values for screen readers', async () => {
    form = [
      { matchId: 'm1', type: 'match', createdAt: '2026-10-15T18:30:00.000Z', average: 45.5, legs: 2 },
      { matchId: 'm2', type: 'practice', createdAt: '2026-10-16T18:30:00.000Z', average: 60.25, legs: 1 },
    ];
    render(<StatsScreen playerId="p1" />);
    const chart = await screen.findByRole('img', { name: 'Wykres formy: 2 gry, ostatnia średnia 60.25' });
    expect(chart.querySelectorAll('circle')).toHaveLength(2);
    expect(chart.querySelector('path')).not.toBeNull();
    const values = chart.parentElement?.querySelector('ol.sr-only');
    expect([...(values?.querySelectorAll('li') ?? [])].map((item) => item.textContent)).toEqual(['Gra 1: 45.50', 'Gra 2: 60.25']);
    expect(chart.parentElement?.textContent).toContain('60.25');
  });

  it('draws one dot for a single game and follows the filter', async () => {
    form = [{ matchId: 'm1', type: 'match', createdAt: '2026-10-15T18:30:00.000Z', average: 45.5, legs: 1 }];
    render(<StatsScreen playerId="p1" />);
    const chart = await screen.findByRole('img', { name: 'Wykres formy: 1 gra, ostatnia średnia 45.50' });
    expect(chart.querySelectorAll('circle')).toHaveLength(1);
    expect(chart.querySelector('path')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mecze 1v1' }));
    await vi.waitFor(() => expect(urls).toContain('/api/players/p1/form?type=match'));
  });
});

describe('StatsScreen: head-to-head', () => {
  function panel(): HTMLElement {
    return screen.getByRole('region', { name: 'Bilans 1v1' });
  }

  it('shows matches, legs and both averages against the chosen opponent', async () => {
    headToHead = (opponentId) => ({ ...emptyHeadToHead, opponentId, matchesPlayed: 4, matchesWon: 3, opponentMatchesWon: 1, legsWon: 7, opponentLegsWon: 4, average: 61.5, opponentAverage: 55.25 });
    render(<StatsScreen playerId="p1" />);
    await screen.findByRole('region', { name: 'Bilans 1v1' });
    expect(within(panel()).getByText('Wybierz rywala.')).toBeTruthy();
    expect(within(panel()).queryByRole('button', { name: 'Anna' })).toBeNull();
    const bartek = within(panel()).getByRole('button', { name: 'Bartek' });
    fireEvent.click(bartek);
    expect(bartek.getAttribute('aria-pressed')).toBe('true');
    expect(await within(panel()).findByText('3 : 1')).toBeTruthy();
    expect(urls).toContain('/api/players/p1/head-to-head/p2');
    const values = [...panel().querySelectorAll('dt')].map((term) => `${term.textContent}=${term.nextElementSibling?.textContent}`);
    expect(values).toEqual(['Mecze=3 : 1', 'Legi=7 : 4', 'Średnia: Anna=61.50', 'Średnia: Bartek=55.25']);
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
    history = [listItem({ id: 'm9', status: 'finished', winnerId: 'p1', players: [player('p1', 'Anna', { legsWon: 2 }), player('p2', 'Bartek', { legsWon: 1 })] })];
    render(<StatsScreen playerId="p1" />);
    const section = await screen.findByRole('region', { name: 'Historia gier' });
    expect(await within(section).findByText('Anna 2 : 1 Bartek')).toBeTruthy();
    expect(urls).toContain('/api/matches?playerId=p1');
    expect(within(section).getByText('Wygrywa Anna')).toBeTruthy();
    expect(within(section).getByRole('link', { name: 'Szczegóły: Anna 2 : 1 Bartek' }).getAttribute('href')).toBe('#/matches/m9');
  });
});
