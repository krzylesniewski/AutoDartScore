import { CreateMatchRequest, type MatchListItem } from '@autoscore/schema';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pl } from '../i18n/pl';
import { player, snapshot, tournamentView } from '../test/snapshots';
import { HomeScreen } from './HomeScreen';

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

let calls: Call[];
let games: MatchListItem[];
let respond: (call: Call) => Promise<Response> | null;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const createdAt = '2026-10-15T18:30:00.000Z';
// Bartek nie jest pierwszy na liście, a jego kolor 7 różni się od numeru pozycji.
const colors = [1, 7, 3, 4, 5];
const players = ['Anna', 'Bartek', 'Celina', 'Darek', 'Ela'].map((name, index) => ({
  id: `p${index + 1}`,
  name,
  avatar: index === 1 ? '🎯' : null,
  color: colors[index],
  guest: false,
  archivedAt: null,
  createdAt,
}));

function item(overrides: Partial<MatchListItem>): MatchListItem {
  return {
    id: 'm1',
    type: 'match',
    practiceMode: null,
    startingScore: 501,
    legsToWin: 2,
    createdAt: '2026-10-18T10:00:00.000Z',
    status: 'in_progress',
    abandonment: null,
    currentPlayerId: 'p1',
    legIndex: 0,
    players: [player('p1', 'Anna', { remaining: 321, legsWon: 0 }), player('p2', 'Bartek', { remaining: 140, legsWon: 0 })],
    freeRun: null,
    checkouts: null,
    winnerId: null,
    placements: [],
    endedAt: null,
    tournament: null,
    updatedAt: '2026-10-18T10:05:00.000Z',
    ...overrides,
  };
}

const firstLeg = item({ id: 'm_first' });
const secondLeg = item({
  id: 'm_second',
  legIndex: 1,
  currentPlayerId: 'p3',
  players: [player('p3', 'Celina', { remaining: 99, legsWon: 1 }), player('p4', 'Darek', { remaining: 260, legsWon: 0 })],
});
const abandoned = item({
  id: 'm_paused',
  type: 'casual',
  legsToWin: null,
  status: 'abandoned',
  abandonment: { playerId: 'p2', reason: null, at: '2026-10-18T09:30:00.000Z' },
  players: [
    player('p1', 'Anna', { remaining: 0, place: 1 }),
    player('p2', 'Bartek', { remaining: 77 }),
    player('p5', 'Ela', { remaining: 201 }),
  ],
  updatedAt: '2026-10-18T09:30:00.000Z',
});

beforeEach(() => {
  calls = [];
  games = [firstLeg, secondLeg, abandoned];
  respond = () => null;
  window.location.hash = '#/';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const call = { url, method, body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined };
      calls.push(call);
      const custom = respond(call);
      if (custom) {
        return custom;
      }
      if (url === '/api/players' && method === 'GET') {
        return json(200, players);
      }
      if (url === '/api/players') {
        const body = call.body as { name: string; avatar?: string; color?: number; guest: boolean };
        return json(201, {
          id: 'p_new',
          name: body.name,
          avatar: body.avatar ?? null,
          color: body.color ?? 2,
          guest: body.guest,
          archivedAt: null,
          createdAt,
        });
      }
      if (url === '/api/matches?status=unfinished') {
        return json(200, games);
      }
      return json(201, snapshot({ id: 'm_7' }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function button(name: string | RegExp): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name });
}

function pressed(name: string | RegExp): string | null {
  return button(name).getAttribute('aria-pressed');
}

function summary(): HTMLElement {
  return screen.getByRole('region', { name: 'Podsumowanie' });
}

function summaryRows(): [string, string][] {
  const values = within(summary()).queryAllByRole('definition');
  return within(summary())
    .queryAllByRole('term')
    .map((term, index) => [term.textContent ?? '', values[index]?.textContent ?? '']);
}

function unfinished(): HTMLElement {
  return screen.getByRole('region', { name: /^Gry do dokończenia/ });
}

function startBar(): HTMLElement {
  return screen.getByRole('region', { name: 'Rozpoczęcie gry' });
}

// Imiona na kaflach graczy w kolejności na ekranie. Avatar jest pierwszym dzieckiem kafla.
function chipNames(selected?: boolean): (string | null | undefined)[] {
  return within(screen.getByRole('group', { name: /^Gracze/ }))
    .getAllByRole('button', { name: /^[A-ZŁŻ][a-ząćęłńóśźż]+$/, ...(selected === undefined ? {} : { pressed: selected }) })
    .filter((chip) => chip.hasAttribute('aria-pressed') && chip.firstElementChild?.getAttribute('aria-hidden') === 'true')
    .map((chip) => chip.lastChild?.textContent);
}

async function chips(): Promise<void> {
  await screen.findByRole('button', { name: 'Anna' });
}

describe('HomeScreen: new game form', () => {
  it('shows the navigation with the start screen as the current page', async () => {
    render(<HomeScreen />);
    const nav = screen.getByRole('navigation', { name: 'Główna nawigacja' });
    expect(within(nav).getByRole('link', { name: 'Nowa gra' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Statystyki' }).getAttribute('href')).toBe('#/stats');
    expect(within(nav).getByRole('link', { name: 'Ustawienia' }).getAttribute('href')).toBe('#/settings');
    expect(screen.getByText('Kamera: brak')).toBeTruthy();
    expect(screen.getByText('Głos: włączony')).toBeTruthy();
    await chips();
  });

  it('lists the players in server order with their count', async () => {
    render(<HomeScreen />);
    await chips();
    expect(screen.getByText('Gracze (5)')).toBeTruthy();
    expect(chipNames()).toEqual(['Anna', 'Bartek', 'Celina', 'Darek', 'Ela']);
  });

  it('drives the options by the game type', async () => {
    render(<HomeScreen />);
    await chips();
    expect(pressed('Mecz 1v1')).toBe('true');
    expect(pressed('301')).toBe('true');
    expect(pressed('Best of 1')).toBe('true');
    expect(pressed('501')).toBe('false');
    expect(pressed('Best of 3')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Free run' })).toBeNull();

    fireEvent.click(button('Zabawa'));
    expect(pressed('301')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Best of 3' })).toBeNull();

    fireEvent.click(button('Trening'));
    expect(screen.queryByRole('button', { name: '501' })).toBeNull();
    expect(pressed('Free run')).toBe('true');
    fireEvent.click(button('Solo 501'));
    expect(pressed('Solo 501')).toBe('true');
  });

  it('describes each game type on its tile', async () => {
    render(<HomeScreen />);
    await chips();
    expect(screen.getByRole('button', { name: 'Mecz 1v1', description: 'Dwóch graczy, best of N legów' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zabawa', description: '3-4 graczy, walka o miejsca' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trening', description: 'Solo: Free run, 501, końcówki' })).toBeTruthy();
  });

  it('groups the options as named segmented controls', async () => {
    render(<HomeScreen />);
    await chips();
    expect(within(screen.getByRole('group', { name: 'Punkty startowe' })).getAllByRole('button')).toHaveLength(3);
    expect(within(screen.getByRole('group', { name: 'Liczba legów' })).getAllByRole('button')).toHaveLength(3);
    fireEvent.click(button('Trening'));
    expect(
      within(screen.getByRole('group', { name: 'Tryb treningu' }))
        .getAllByRole('button')
        .map((segment) => segment.textContent),
    ).toEqual(['Free run', 'Solo 501', 'Końcówki']);
  });

  it('shows the checkout range group only for Końcówki, with 2-50 preselected', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Trening'));
    expect(screen.queryByRole('group', { name: 'Przedział końcówek' })).toBeNull();
    fireEvent.click(button('Końcówki'));
    const range = screen.getByRole('group', { name: 'Przedział końcówek', description: '2-50 albo 51-100' });
    expect(
      within(range)
        .getAllByRole('button')
        .map((segment) => segment.textContent),
    ).toEqual(['2-50', '51-100']);
    expect(pressed('2-50')).toBe('true');
    expect(pressed('51-100')).toBe('false');
    fireEvent.click(button('Solo 501'));
    expect(screen.queryByRole('group', { name: 'Przedział końcówek' })).toBeNull();
  });

  it('limits a 1v1 to 2 players and disables the other chips', async () => {
    render(<HomeScreen />);
    await chips();
    expect(screen.getByText('Wybierz 2 graczy.')).toBeTruthy();
    fireEvent.click(button('Anna'));
    expect(screen.getByText('Wybrano 1 z 2 graczy.')).toBeTruthy();
    expect(button('Start gry').disabled).toBe(true);
    fireEvent.click(button('Bartek'));
    expect(screen.getByText('Wybrano 2 z 2 graczy. Kto zaczyna pierwszy leg, rozstrzyga losowanie.')).toBeTruthy();
    expect(button('Celina').disabled).toBe(true);
    expect(button('Anna').disabled).toBe(false);
    expect(button('Start gry').disabled).toBe(false);

    fireEvent.click(button('Anna'));
    expect(pressed('Anna')).toBe('false');
    expect(button('Celina').disabled).toBe(false);
  });

  it('allows 2 to 4 players in Zabawa', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Zabawa'));
    expect(screen.getByText('Wybierz od 2 do 4 graczy.')).toBeTruthy();
    fireEvent.click(button('Anna'));
    expect(screen.getByText('Wybrano 1 z 4 graczy.')).toBeTruthy();
    for (const name of ['Bartek', 'Celina', 'Darek']) {
      fireEvent.click(button(name));
    }
    expect(screen.getByText('Wybrano 4 z 4 graczy. Kto zaczyna pierwszy leg, rozstrzyga losowanie.')).toBeTruthy();
    expect(button('Ela').disabled).toBe(true);
  });

  it('replaces the selection when Trening allows 1 player', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Trening'));
    expect(screen.getByText('Wybierz 1 gracza.')).toBeTruthy();
    fireEvent.click(button('Anna'));
    fireEvent.click(button('Bartek'));
    expect(pressed('Anna')).toBe('false');
    expect(pressed('Bartek')).toBe('true');
    expect(button('Celina').disabled).toBe(false);
    expect(screen.getByText('Wybrano 1 z 1 gracza.')).toBeTruthy();
  });

  it('trims the selection to the new limit and keeps the earliest picks', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Zabawa'));
    for (const name of ['Celina', 'Anna', 'Darek']) {
      fireEvent.click(button(name));
    }
    fireEvent.click(button('Mecz 1v1'));
    expect(['Celina', 'Anna', 'Darek'].map((name) => pressed(name))).toEqual(['true', 'true', 'false']);
    fireEvent.click(button('Trening'));
    expect(['Celina', 'Anna'].map((name) => pressed(name))).toEqual(['true', 'false']);
  });

  it('summarises a 1v1 in pick order', async () => {
    render(<HomeScreen />);
    await chips();
    expect(within(summary()).getByText('Nie wybrano graczy')).toBeTruthy();
    fireEvent.click(button('Bartek'));
    fireEvent.click(button('Anna'));
    expect(summary().textContent).toMatch(/Bartek.*vs.*Anna/);
    expect(summaryRows()).toEqual([
      ['Typ', 'Mecz 1v1'],
      ['Punkty', '301'],
      ['Format', 'Best of 1 (do 1 wygranego lega)'],
      ['Zasady', 'Straight-in, double-out'],
      ['Zaczyna', 'Losowanie przy starcie'],
    ]);
    fireEvent.click(button('Best of 3'));
    expect(summaryRows()[2]).toEqual(['Format', 'Best of 3 (do 2 wygranych legów)']);
    fireEvent.click(button('Best of 5'));
    expect(summaryRows()[2]).toEqual(['Format', 'Best of 5 (do 3 wygranych legów)']);
  });

  it('summarises Zabawa and Trening', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Zabawa'));
    fireEvent.click(button('701'));
    expect(summaryRows()).toEqual([
      ['Typ', 'Zabawa'],
      ['Punkty', '701'],
      ['Format', 'Jeden leg, ranking miejsc'],
      ['Zasady', 'Straight-in, double-out'],
      ['Zaczyna', 'Losowanie przy starcie'],
    ]);
    fireEvent.click(button('Trening'));
    expect(summaryRows()).toEqual([
      ['Typ', 'Trening'],
      ['Tryb', 'Free run'],
      ['Zasady', 'Bez zasad, tylko notuje rzuty'],
    ]);
    fireEvent.click(button('Solo 501'));
    expect(summaryRows()).toEqual([
      ['Typ', 'Trening'],
      ['Tryb', 'Solo 501'],
      ['Zasady', 'Straight-in, double-out'],
    ]);
    fireEvent.click(button('Końcówki'));
    fireEvent.click(button('51-100'));
    expect(summaryRows()).toEqual([
      ['Typ', 'Trening'],
      ['Tryb', 'Końcówki'],
      ['Przedział', '51-100'],
      ['Zasady', 'Po pudle ta sama końcówka, nowa po trafieniu albo pominięciu'],
    ]);
  });

  it('shows the vs header for 2 players in Zabawa', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Zabawa'));
    fireEvent.click(button('Anna'));
    fireEvent.click(button('Bartek'));
    expect(summary().textContent).toMatch(/Anna.*vs.*Bartek/);
  });

  it('keeps the only Start button in the bar with the setup line', async () => {
    render(<HomeScreen />);
    await chips();
    expect(within(startBar()).getByRole('button', { name: 'Start gry' })).toBeTruthy();
    expect(within(startBar()).getByText('Nie wybrano graczy')).toBeTruthy();
    fireEvent.click(button('Anna'));
    fireEvent.click(button('Bartek'));
    expect(within(startBar()).getByText('301 · Best of 1 · Straight-in, double-out · Losowanie przy starcie')).toBeTruthy();
    expect(startBar().textContent).toMatch(/Anna.*vs.*Bartek/);
  });

  it("shows each player's own avatar color in the start bar", async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Anna'));
    fireEvent.click(button('Bartek'));
    // Stały kolor awatara gracza widać tylko w klasie tokenu. Bartek stoi drugi, ale ma kolor 7.
    expect(within(startBar()).getByText('🎯').className).toContain('bg-(--color-avatar-7)');
  });

  it('counts 3 players in the bar for Zabawa', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Zabawa'));
    for (const name of ['Anna', 'Bartek', 'Celina']) {
      fireEvent.click(button(name));
    }
    expect(within(startBar()).getByText('3 graczy')).toBeTruthy();
  });

  it('posts a valid request in pick order and opens the game', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Bartek'));
    fireEvent.click(button('Anna'));
    fireEvent.click(button('701'));
    fireEvent.click(button('Start gry'));

    await vi.waitFor(() => expect(window.location.hash).toBe('#/matches/m_7'));
    const request = calls.find((call) => call.url === '/api/matches');
    expect(request?.method).toBe('POST');
    expect(CreateMatchRequest.safeParse(request?.body).success).toBe(true);
    expect(request?.body).toEqual({ type: 'match', playerIds: ['p2', 'p1'], startingScore: 701, bestOf: 1 });
  });

  it('posts checkout practice with the chosen range', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Trening'));
    fireEvent.click(button('Końcówki'));
    fireEvent.click(button('51-100'));
    fireEvent.click(button('Anna'));
    expect(within(startBar()).getByText('Końcówki · 51-100 · Po pudle ta sama końcówka, nowa po trafieniu albo pominięciu')).toBeTruthy();
    fireEvent.click(button('Start gry'));

    await vi.waitFor(() => expect(window.location.hash).toBe('#/matches/m_7'));
    const request = calls.find((call) => call.url === '/api/matches');
    expect(request?.method).toBe('POST');
    expect(request?.body).toEqual({ type: 'practice', playerIds: ['p1'], practiceMode: 'checkouts', checkoutRange: '51-100' });
  });

  it('shows a Polish text instead of the server message when the game cannot start', async () => {
    respond = (call) =>
      call.url === '/api/matches' ? Promise.resolve(json(400, { error: 'unknown_player', message: 'Unknown player p2' })) : null;
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Anna'));
    fireEvent.click(button('Bartek'));
    fireEvent.click(button('Start gry'));
    expect((await within(startBar()).findByRole('alert')).textContent).toBe(pl.unknownPlayer);
    expect(screen.queryByText('Unknown player p2')).toBeNull();
    expect(window.location.hash).toBe('#/');
  });
});

describe('HomeScreen: option groups and navigation', () => {
  it('describes the starting score and legs groups', async () => {
    render(<HomeScreen />);
    await chips();
    expect(screen.getByRole('group', { name: 'Punkty startowe', description: '301, 501 lub 701' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Liczba legów', description: 'ile legów do wygranej' })).toBeTruthy();
  });

  it('describes the practice mode group', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Trening'));
    expect(
      screen.getByRole('group', { name: 'Tryb treningu', description: 'swobodne rzucanie, zejście z 501 albo losowe końcówki' }),
    ).toBeTruthy();
  });

  it('offers no exit or entry rule groups in any game type', async () => {
    render(<HomeScreen />);
    await chips();
    for (const type of ['Mecz 1v1', 'Zabawa', 'Trening']) {
      fireEvent.click(button(type));
      expect(screen.queryByRole('group', { name: 'Zasada wyjścia' })).toBeNull();
      expect(screen.queryByRole('group', { name: 'Wejście do gry' })).toBeNull();
    }
  });

  it('keeps the navigation link names', async () => {
    render(<HomeScreen />);
    const nav = screen.getByRole('navigation', { name: 'Główna nawigacja' });
    for (const name of ['Nowa gra', 'Statystyki', 'Historia']) {
      expect(within(nav).getByRole('link', { name })).toBeTruthy();
    }
    await chips();
  });
});

describe('HomeScreen: new player dialog', () => {
  function dialog(): HTMLElement {
    return screen.getByRole('dialog', { name: 'Nowy gracz' });
  }

  it('has a name, an emoji and a color, and closes on Escape', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('+ Nowy gracz'));
    expect((dialog() as HTMLDialogElement).open).toBe(true);
    expect(within(dialog()).getByLabelText('Imię')).toBeTruthy();
    expect(within(dialog()).getByRole('group', { name: 'Avatar (emoji)' })).toBeTruthy();
    expect(within(dialog()).getByRole('group', { name: 'Kolor' })).toBeTruthy();
    expect(within(dialog()).queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('Gość')).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves the player, puts it first and selects it', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Anna'));
    fireEvent.click(button('+ Nowy gracz'));
    fireEvent.change(within(dialog()).getByLabelText('Imię'), { target: { value: ' Gosia ' } });
    fireEvent.change(within(dialog()).getByRole('textbox', { name: 'Inne emoji' }), { target: { value: '🦊' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Dodaj' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.find((call) => call.url === '/api/players' && call.method === 'POST')?.body).toEqual({
      name: 'Gosia',
      guest: false,
      avatar: '🦊',
    });
    expect(pressed('Gosia')).toBe('true');
    expect(screen.getByText('Gracze (6)')).toBeTruthy();
    expect(chipNames()[0]).toBe('Gosia');
    expect(chipNames(true)).toEqual(['Gosia', 'Anna']);
    expect(within(summary()).getByText('🦊')).toBeTruthy();
    expect(button('Start gry').disabled).toBe(false);
  });

  it('offers 16 colors by Polish name with none checked', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('+ Nowy gracz'));
    const radios = within(within(dialog()).getByRole('group', { name: 'Kolor' })).getAllByRole<HTMLInputElement>('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual([
      'Bursztynowy',
      'Niebieski',
      'Fioletowy',
      'Koralowy',
      'Zielony',
      'Turkusowy',
      'Różowy',
      'Żółty',
      'Limonkowy',
      'Pomarańczowy',
      'Liliowy',
      'Błękitny',
      'Piaskowy',
      'Srebrny',
      'Oliwkowy',
      'Łososiowy',
    ]);
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
    expect(radios.filter((radio) => radio.checked)).toEqual([]);
    expect(within(dialog()).getByText('Bez wyboru kolor zostanie dobrany automatycznie.')).toBeTruthy();
  });

  it('sends the chosen color', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('+ Nowy gracz'));
    fireEvent.change(within(dialog()).getByLabelText('Imię'), { target: { value: 'Gosia' } });
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Turkusowy' }));
    expect(within(dialog()).getByRole<HTMLInputElement>('radio', { name: 'Turkusowy' }).checked).toBe(true);
    expect(within(dialog()).queryByText('Bez wyboru kolor zostanie dobrany automatycznie.')).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Dodaj' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.find((call) => call.url === '/api/players' && call.method === 'POST')?.body).toEqual({
      name: 'Gosia',
      guest: false,
      color: 6,
    });
    expect(button('Gosia')).toBeTruthy();
  });

  it('sends no color when none is chosen', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('+ Nowy gracz'));
    fireEvent.change(within(dialog()).getByLabelText('Imię'), { target: { value: 'Gosia' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Dodaj' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.find((call) => call.url === '/api/players' && call.method === 'POST')?.body).not.toHaveProperty('color');
  });

  it('replaces the selection in Trening', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Trening'));
    fireEvent.click(button('Anna'));
    fireEvent.click(button('+ Nowy gracz'));
    fireEvent.change(within(dialog()).getByLabelText('Imię'), { target: { value: 'Gosia' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Dodaj' }));
    await vi.waitFor(() => expect(pressed('Gosia')).toBe('true'));
    expect(pressed('Anna')).toBe('false');
  });

  it('adds without selecting when the selection is full', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Anna'));
    fireEvent.click(button('Bartek'));
    fireEvent.click(button('+ Nowy gracz'));
    fireEvent.change(within(dialog()).getByLabelText('Imię'), { target: { value: 'Gosia' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Dodaj' }));
    await vi.waitFor(() => expect(button('Gosia').disabled).toBe(true));
    expect(pressed('Gosia')).toBe('false');
  });
});

describe('HomeScreen: games to finish', () => {
  async function row(title: string): Promise<HTMLElement> {
    const found = (await screen.findByRole('button', { name: `Dokończ: ${title}` })).closest('li');
    if (!found) {
      throw new Error(`no row for ${title}`);
    }
    return found;
  }

  it('loads the list once and shows a row per game', async () => {
    render(<HomeScreen />);
    const first = await row('Anna vs Bartek');
    expect(within(unfinished()).getByRole('heading', { name: 'Gry do dokończenia (3)' })).toBeTruthy();
    expect(within(unfinished()).getByText('od najnowszej')).toBeTruthy();
    expect(within(first).getByText('Mecz 1v1 · 501 · leg 1 z 3')).toBeTruthy();
    expect(within(first).getByText('0 : 0')).toBeTruthy();
    expect(first.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-18T10:05:00.000Z');
    expect(calls.filter((call) => call.url === '/api/matches?status=unfinished')).toHaveLength(1);
  });

  it('marks an abandoned game with the Porzucony badge', async () => {
    render(<HomeScreen />);
    const paused = await row('Zabawa, 3 graczy');
    expect(within(paused).getByText('Porzucony')).toBeTruthy();
    expect(within(paused).getByText('501 · prowadzi Bartek (77)')).toBeTruthy();
    expect(within(paused).getByText('2 os.')).toBeTruthy();
    expect(within(await row('Anna vs Bartek')).queryByText('Porzucony')).toBeNull();
  });

  it('offers Porzuć for every game in progress, also in the first leg', async () => {
    render(<HomeScreen />);
    expect(within(await row('Anna vs Bartek')).getByRole('button', { name: 'Porzuć: Anna vs Bartek' })).toBeTruthy();
    expect(within(await row('Celina vs Darek')).getByRole('button', { name: 'Porzuć: Celina vs Darek' })).toBeTruthy();
    expect(button('Porzuć: Celina vs Darek').textContent).toBe('');
    expect(within(await row('Zabawa, 3 graczy')).queryByRole('button', { name: /^Porzuć/ })).toBeNull();
  });

  it('opens a game in progress', async () => {
    render(<HomeScreen />);
    fireEvent.click(within(await row('Anna vs Bartek')).getByRole('button', { name: 'Dokończ: Anna vs Bartek' }));
    expect(window.location.hash).toBe('#/matches/m_first');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('resumes an abandoned game and opens it', async () => {
    render(<HomeScreen />);
    const paused = await row('Zabawa, 3 graczy');
    respond = (call) => (call.url.endsWith('/resume') ? Promise.resolve(json(200, snapshot({ id: 'm_paused', eventSeq: 9 }))) : null);
    fireEvent.click(within(paused).getByRole('button', { name: 'Dokończ: Zabawa, 3 graczy' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/matches/m_paused'));
    expect(calls.at(-1)).toMatchObject({ url: '/api/matches/m_paused/resume', method: 'POST' });
  });

  it('shows a failed resume and stays on the list', async () => {
    render(<HomeScreen />);
    const paused = await row('Zabawa, 3 graczy');
    respond = (call) =>
      call.url.endsWith('/resume') ? Promise.resolve(json(409, { error: 'match_not_abandoned', message: 'Match is not abandoned' })) : null;
    fireEvent.click(within(paused).getByRole('button', { name: 'Dokończ: Zabawa, 3 graczy' }));
    expect(await within(unfinished()).findByText('Nie udało się wznowić meczu')).toBeTruthy();
    expect(window.location.hash).toBe('#/');
  });

  it('abandons a game after the dialog and reloads the list', async () => {
    render(<HomeScreen />);
    const live = await row('Celina vs Darek');
    respond = (call) =>
      call.url.endsWith('/abandon') ? Promise.resolve(json(200, snapshot({ id: 'm_second', status: 'abandoned' }))) : null;
    fireEvent.click(within(live).getByRole('button', { name: 'Porzuć: Celina vs Darek' }));
    const dialog = screen.getByRole('dialog', { name: 'Porzucić mecz?' });
    expect(within(dialog).getByRole<HTMLInputElement>('radio', { name: 'Celina' }).checked).toBe(true);
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Darek' }));
    games = [
      firstLeg,
      { ...secondLeg, status: 'abandoned', abandonment: { playerId: 'p4', reason: null, at: '2026-10-18T11:00:00.000Z' } },
      abandoned,
    ];
    fireEvent.click(within(dialog).getByRole('button', { name: 'Porzuć mecz' }));

    await vi.waitFor(() => expect(within(unfinished()).getAllByText('Porzucony')).toHaveLength(2));
    expect(calls.find((call) => call.url === '/api/matches/m_second/abandon')?.body).toEqual({ playerId: 'p4' });
    expect(calls.filter((call) => call.url === '/api/matches?status=unfinished')).toHaveLength(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a failed abandon', async () => {
    render(<HomeScreen />);
    const live = await row('Celina vs Darek');
    respond = (call) =>
      call.url.endsWith('/abandon') ? Promise.resolve(json(409, { error: 'match_finished', message: 'Match is finished' })) : null;
    fireEvent.click(within(live).getByRole('button', { name: 'Porzuć: Celina vs Darek' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Porzuć mecz' }));
    expect(await within(unfinished()).findByText('Nie udało się porzucić meczu')).toBeTruthy();
  });

  describe('end practice', () => {
    const freeRun = item({
      id: 'm_free',
      type: 'practice',
      practiceMode: 'free_run',
      startingScore: null,
      legsToWin: null,
      players: [player('p1', 'Anna', { remaining: null, dartsThrownInLeg: 5 })],
      freeRun: { dartsThrown: 5, totalPoints: 120, average: 72 },
    });
    const emptySolo = item({
      id: 'm_solo',
      type: 'practice',
      practiceMode: 'solo_501',
      startingScore: 501,
      legsToWin: null,
      players: [player('p2', 'Bartek', { remaining: 501, dartsThrownInLeg: 0 })],
    });

    beforeEach(() => {
      games = [freeRun, emptySolo, firstLeg];
    });

    it('offers Zakończ trening only on a practice row with darts', async () => {
      render(<HomeScreen />);
      expect(within(await row('Trening: Free run')).getByRole('button', { name: 'Zakończ trening: Trening: Free run' })).toBeTruthy();
      expect(within(await row('Trening: Solo 501')).queryByRole('button', { name: /^Zakończ trening/ })).toBeNull();
      expect(within(await row('Anna vs Bartek')).queryByRole('button', { name: /^Zakończ trening/ })).toBeNull();
    });

    it('ends the session after the dialog and reloads the list', async () => {
      render(<HomeScreen />);
      const practice = await row('Trening: Free run');
      respond = (call) =>
        call.url.endsWith('/end')
          ? Promise.resolve(json(200, snapshot({ id: 'm_free', type: 'practice', status: 'ended', endedAt: '2026-10-18T11:00:00.000Z' })))
          : null;
      fireEvent.click(within(practice).getByRole('button', { name: 'Zakończ trening: Trening: Free run' }));
      const dialog = screen.getByRole('dialog', { name: 'Zakończyć trening?' });
      games = [emptySolo, firstLeg];
      fireEvent.click(within(dialog).getByRole('button', { name: 'Zakończ trening' }));

      await vi.waitFor(() => expect(within(unfinished()).queryByText('Trening: Free run')).toBeNull());
      expect(calls.find((call) => call.url === '/api/matches/m_free/end')).toEqual({
        url: '/api/matches/m_free/end',
        method: 'POST',
        body: undefined,
      });
      expect(calls.filter((call) => call.url === '/api/matches?status=unfinished')).toHaveLength(2);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('posts nothing on Anuluj and on Escape', async () => {
      render(<HomeScreen />);
      const practice = await row('Trening: Free run');
      fireEvent.click(within(practice).getByRole('button', { name: 'Zakończ trening: Trening: Free run' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anuluj' }));
      expect(screen.queryByRole('dialog')).toBeNull();

      fireEvent.click(within(practice).getByRole('button', { name: 'Zakończ trening: Trening: Free run' }));
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(calls.some((call) => call.method === 'POST')).toBe(false);
    });

    it('shows a failed end', async () => {
      render(<HomeScreen />);
      const practice = await row('Trening: Free run');
      respond = (call) =>
        call.url.endsWith('/end') ? Promise.resolve(json(409, { error: 'practice_ended', message: 'Match is ended' })) : null;
      fireEvent.click(within(practice).getByRole('button', { name: 'Zakończ trening: Trening: Free run' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Zakończ trening' }));
      expect(await within(unfinished()).findByText('Nie udało się zakończyć treningu')).toBeTruthy();
    });
  });

  it('shows the empty list', async () => {
    games = [];
    render(<HomeScreen />);
    expect(await screen.findByText('Brak gier do dokończenia.')).toBeTruthy();
    expect(within(unfinished()).getByRole('heading', { name: 'Gry do dokończenia (0)' })).toBeTruthy();
    expect(within(unfinished()).queryByRole('listitem')).toBeNull();
  });

  it('shows an error when the list fails to load', async () => {
    respond = (call) =>
      call.url === '/api/matches?status=unfinished'
        ? Promise.resolve(json(500, { error: 'internal_error', message: 'Internal server error' }))
        : null;
    render(<HomeScreen />);
    expect(await screen.findByText('Nie udało się pobrać listy gier')).toBeTruthy();
    expect(screen.queryByText('Brak gier do dokończenia.')).toBeNull();
  });
});

describe('HomeScreen: Scena look', () => {
  // Znaczek wyboru to ukryty span z ikoną. Avatar też jest ukrytym spanem, ale bez ikony.
  function badges(tile: HTMLElement): Element[] {
    return [...tile.querySelectorAll('span[aria-hidden="true"]')].filter((span) => span.querySelector('svg'));
  }

  it('shows the title as an h1', async () => {
    render(<HomeScreen />);
    await chips();
    const title = screen.getByRole('heading', { level: 1, name: 'Nowa gra' });
    expect(title.tagName).toBe('H1');
  });

  it('marks only the selected type tile as pressed with a hidden check badge', async () => {
    render(<HomeScreen />);
    await chips();
    const selected = screen.getByRole('button', { name: 'Mecz 1v1', description: 'Dwóch graczy, best of N legów' });
    const other = screen.getByRole('button', { name: 'Zabawa', description: '3-4 graczy, walka o miejsca' });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(badges(selected)).toHaveLength(1);
    expect(other.getAttribute('aria-pressed')).toBe('false');
    expect(badges(other)).toHaveLength(0);

    fireEvent.click(other);
    expect(other.getAttribute('aria-pressed')).toBe('true');
    expect(badges(other)).toHaveLength(1);
    expect(selected.getAttribute('aria-pressed')).toBe('false');
    expect(badges(selected)).toHaveLength(0);
  });

  it('marks a picked player tile as pressed with a check badge and keeps the name as the button name', async () => {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Bartek'));
    const picked = button('Bartek');
    expect(picked.getAttribute('aria-pressed')).toBe('true');
    expect(badges(picked)).toHaveLength(1);
    expect(within(picked).getByText('🎯').getAttribute('aria-hidden')).toBe('true');
    const unpicked = button('Anna');
    expect(unpicked.getAttribute('aria-pressed')).toBe('false');
    expect(badges(unpicked)).toHaveLength(0);
  });
});

describe('HomeScreen: tournament wizard', () => {
  const sixPlayers = [...players, { ...players[0], id: 'p6', name: 'Franek', color: 6 }];

  function useSixPlayers(): void {
    const previous = respond;
    respond = (call) => (call.url === '/api/players' && call.method === 'GET' ? Promise.resolve(json(200, sixPlayers)) : previous(call));
  }

  function plan(): HTMLElement {
    return screen.getByRole('region', { name: 'Plan turnieju' });
  }

  function planRows(): [string, string][] {
    const values = within(plan()).queryAllByRole('definition');
    return within(plan())
      .queryAllByRole('term')
      .map((term, index) => [term.textContent ?? '', values[index]?.textContent ?? '']);
  }

  function legsRows(): string[] {
    return screen.getAllByRole('button', { name: /^Mniej legów: / }).map((stepper) => (stepper.getAttribute('aria-label') ?? '').slice(13));
  }

  function tournamentPosts(): Call[] {
    return calls.filter((call) => call.url === '/api/tournaments' && call.method === 'POST');
  }

  async function openTournament(): Promise<void> {
    render(<HomeScreen />);
    await chips();
    fireEvent.click(button('Turniej'));
  }

  function pickAll(names: readonly string[]): void {
    for (const name of names) {
      fireEvent.click(button(name));
    }
  }

  it('offers Turniej as the fourth type tile with its description', async () => {
    render(<HomeScreen />);
    await chips();
    const tiles = within(screen.getByRole('group', { name: 'Typ gry' })).getAllByRole('button');
    expect(tiles.map((tile) => tile.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
    expect(screen.getByRole('button', { name: 'Turniej', description: 'Liga, puchar, grupa + play-off' })).toBe(tiles[3]);
  });

  it('opens with Turniej selected from initialKind', async () => {
    render(<HomeScreen initialKind="tournament" />);
    await chips();
    expect(pressed('Turniej')).toBe('true');
    expect(pressed('Mecz 1v1')).toBe('false');
    expect(screen.getByLabelText('Nazwa turnieju')).toBeTruthy();
  });

  it('swaps the form, the summary and the start button for the tournament ones', async () => {
    await openTournament();
    expect(pressed('Turniej')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Start gry' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Rozpoczęcie gry' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Podsumowanie' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Rozpocznij turniej' })).toHaveLength(1);
    expect(plan()).toBeTruthy();
    expect(unfinished()).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Nowa gra' })).toBeTruthy();
  });

  it('prefills the name with the date and shows the tournament defaults', async () => {
    await openTournament();
    const name = screen.getByLabelText<HTMLInputElement>('Nazwa turnieju');
    expect(name.value).toMatch(/^Turniej \d{2}\.\d{2}\.\d{4}$/);
    expect(name.maxLength).toBe(60);
    expect(pressed('Grupa + play-off')).toBe('true');
    expect(pressed('501')).toBe('true');
    expect(
      within(screen.getByRole('group', { name: 'Do play-off' }))
        .getByRole('button', { name: '4' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(pressed('Publiczny link z kodem QR')).toBe('true');
  });

  it('shows Do play-off with the pairing hint only in Grupa + play-off', async () => {
    await openTournament();
    const advance = screen.getByRole('group', { name: 'Do play-off', description: 'pary 1-4 i 2-3' });
    fireEvent.click(within(advance).getByRole('button', { name: '8' }));
    expect(screen.getByRole('group', { name: 'Do play-off', description: 'pary 1-8, 4-5, 2-7 i 3-6' })).toBeTruthy();
    fireEvent.click(within(advance).getByRole('button', { name: '2' }));
    expect(screen.getByRole('group', { name: 'Do play-off', description: 'od razu finał 1-2' })).toBeTruthy();
    fireEvent.click(button('Liga'));
    expect(screen.queryByRole('group', { name: 'Do play-off' })).toBeNull();
    fireEvent.click(button('Puchar'));
    expect(screen.queryByRole('group', { name: 'Do play-off' })).toBeNull();
  });

  it('shows no extras in Liga and Pocieszenie only in Grupa + play-off', async () => {
    await openTournament();
    expect(screen.getByRole('heading', { name: 'Mecze dodatkowe' })).toBeTruthy();
    expect(button('Mecz o 3. miejsce')).toBeTruthy();
    expect(button('Pocieszenie')).toBeTruthy();

    fireEvent.click(button('Liga'));
    expect(screen.queryByRole('heading', { name: 'Mecze dodatkowe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mecz o 3. miejsce' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pocieszenie' })).toBeNull();

    fireEvent.click(button('Puchar'));
    expect(button('Mecz o 3. miejsce')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pocieszenie' })).toBeNull();
  });

  it('disables an extra that the format cannot play and shows the reason', async () => {
    await openTournament();
    fireEvent.click(button('Puchar'));
    pickAll(['Anna', 'Bartek', 'Celina']);
    const third = button('Mecz o 3. miejsce');
    expect(third.disabled).toBe(true);
    expect(third.getAttribute('aria-pressed')).toBe('false');
    expect(third.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Wymaga dwóch półfinałów.')).toBeTruthy();
    fireEvent.click(button('Darek'));
    expect(button('Mecz o 3. miejsce').disabled).toBe(false);
    expect(screen.queryByText('Wymaga dwóch półfinałów.')).toBeNull();
    fireEvent.click(button('Mecz o 3. miejsce'));
    expect(pressed('Mecz o 3. miejsce')).toBe('true');
    expect(within(button('Mecz o 3. miejsce')).getByText('włączony')).toBeTruthy();
  });

  it('shows one stepper row per phase of the format', async () => {
    await openTournament();
    expect(legsRows()).toEqual(['Faza grupowa', 'Półfinały', 'Finał']);
    fireEvent.click(button('Liga'));
    expect(legsRows()).toEqual(['Mecze ligi']);
    fireEvent.click(button('Puchar'));
    expect(legsRows()).toEqual(['Półfinały', 'Finał']);
    pickAll(['Anna', 'Bartek', 'Celina', 'Darek', 'Ela']);
    expect(legsRows()).toEqual(['Ćwierćfinały', 'Półfinały', 'Finał']);
    fireEvent.click(button('Mecz o 3. miejsce'));
    expect(legsRows()).toEqual(['Ćwierćfinały', 'Półfinały', 'Finał', 'Mecz o 3. miejsce']);
  });

  it('disables − at 1 and + at 9', async () => {
    await openTournament();
    const fewer = button('Mniej legów: Faza grupowa');
    const more = button('Więcej legów: Faza grupowa');
    const row = fewer.closest('li') as HTMLElement;
    expect(row.textContent).toContain('3');
    fireEvent.click(fewer);
    fireEvent.click(fewer);
    expect(row.textContent).toContain('1');
    expect(fewer.disabled).toBe(true);
    expect(more.disabled).toBe(false);
    for (let step = 0; step < 8; step += 1) {
      fireEvent.click(more);
    }
    expect(row.textContent).toContain('9');
    expect(more.disabled).toBe(true);
    expect(fewer.disabled).toBe(false);
  });

  it('counts 20 matches for 6 players, advance 4 and both extras', async () => {
    useSixPlayers();
    await openTournament();
    pickAll(['Anna', 'Bartek', 'Celina', 'Darek', 'Ela', 'Franek']);
    fireEvent.click(button('Mecz o 3. miejsce'));
    fireEvent.click(button('Pocieszenie'));
    expect(planRows()).toEqual([
      ['Faza grupowa, każdy z każdym', '15'],
      ['Półfinały', '2'],
      ['Finał', '1'],
      ['Mecz o 3. miejsce', '1'],
      ['Pocieszenie', '1'],
      ['Razem meczów', '20'],
    ]);
    expect(within(plan()).getByText(/^501, double-out\. Kto zaczyna mecz: losowanie/)).toBeTruthy();
  });

  it('explains why the plan is missing and blocks the start', async () => {
    await openTournament();
    expect(within(plan()).getByText('Wybierz od 3 do 10 graczy.')).toBeTruthy();
    expect(button('Rozpocznij turniej').disabled).toBe(true);

    pickAll(['Anna', 'Bartek', 'Celina']);
    fireEvent.click(within(screen.getByRole('group', { name: 'Do play-off' })).getByRole('button', { name: '8' }));
    expect(within(plan()).getByText('Do play-off nie może wyjść więcej graczy, niż gra w turnieju.')).toBeTruthy();
    expect(button('Rozpocznij turniej').disabled).toBe(true);

    fireEvent.click(within(screen.getByRole('group', { name: 'Do play-off' })).getByRole('button', { name: '2' }));
    fireEvent.change(screen.getByLabelText('Nazwa turnieju'), { target: { value: '   ' } });
    expect(screen.getAllByText('Podaj nazwę turnieju.')).toHaveLength(2);
    expect(screen.getByLabelText('Nazwa turnieju').getAttribute('aria-invalid')).toBe('true');
    expect(button('Rozpocznij turniej').disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Nazwa turnieju'), { target: { value: 'Puchar' } });
    expect(button('Rozpocznij turniej').disabled).toBe(false);
    expect(planRows().at(-1)).toEqual(['Razem meczów', '4']);
  });

  it('keeps the selection of each kind while switching tiles', async () => {
    render(<HomeScreen />);
    await chips();
    pickAll(['Anna', 'Bartek']);
    fireEvent.click(button('Turniej'));
    expect(chipNames(false)).toEqual(['Anna', 'Bartek', 'Celina', 'Darek', 'Ela']);
    pickAll(['Celina', 'Darek', 'Ela']);
    fireEvent.click(button('Mecz 1v1'));
    expect(chipNames(true)).toEqual(['Anna', 'Bartek']);
    fireEvent.click(button('Turniej'));
    expect(chipNames(true)).toEqual(['Celina', 'Darek', 'Ela']);
  });

  it('picks a player created in the dialog into the tournament', async () => {
    await openTournament();
    fireEvent.click(button('+ Nowy gracz'));
    const dialog = screen.getByRole('dialog', { name: 'Nowy gracz' });
    fireEvent.change(within(dialog).getByLabelText('Imię'), { target: { value: 'Gosia' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dodaj' }));
    await screen.findByRole('button', { name: 'Gosia', pressed: true });
    expect(chipNames(true)).toEqual(['Gosia']);
    fireEvent.click(button('Mecz 1v1'));
    expect(chipNames(false)).toEqual(['Gosia', 'Anna', 'Bartek', 'Celina', 'Darek', 'Ela']);
  });

  it('posts the tournament once and opens it', async () => {
    useSixPlayers();
    const previous = respond;
    respond = (call) => (call.url === '/api/tournaments' ? Promise.resolve(json(201, tournamentView({ id: 't 7' }))) : previous(call));
    await openTournament();
    const name = screen.getByLabelText<HTMLInputElement>('Nazwa turnieju').value;
    pickAll(['Celina', 'Anna', 'Bartek', 'Darek', 'Ela', 'Franek']);
    fireEvent.click(button('Mecz o 3. miejsce'));
    fireEvent.click(button('Pocieszenie'));
    fireEvent.click(button('Więcej legów: Finał'));
    fireEvent.click(button('701'));
    fireEvent.click(button('Publiczny link z kodem QR'));
    fireEvent.click(button('Rozpocznij turniej'));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/tournaments/t%207'));
    expect(tournamentPosts()).toHaveLength(1);
    expect(tournamentPosts()[0]?.body).toEqual({
      name,
      format: 'group_playoff',
      playerIds: ['p3', 'p1', 'p2', 'p4', 'p5', 'p6'],
      startingScore: 701,
      advance: 4,
      thirdPlaceMatch: true,
      consolation: true,
      legsToWin: { group: 3, r16: 3, qf: 3, sf: 3, final: 5, thirdPlace: 2, consolation: 2 },
      sharing: false,
    });
  });

  it('sends a league without advance and with the extras off', async () => {
    const previous = respond;
    respond = (call) => (call.url === '/api/tournaments' ? Promise.resolve(json(201, tournamentView())) : previous(call));
    await openTournament();
    fireEvent.click(button('Mecz o 3. miejsce'));
    fireEvent.click(button('Liga'));
    fireEvent.change(screen.getByLabelText('Nazwa turnieju'), { target: { value: '  Liga  ' } });
    pickAll(['Anna', 'Bartek', 'Celina']);
    fireEvent.click(button('Rozpocznij turniej'));
    await vi.waitFor(() => expect(tournamentPosts()).toHaveLength(1));
    expect(tournamentPosts()[0]?.body).toEqual({
      name: 'Liga',
      format: 'league',
      playerIds: ['p1', 'p2', 'p3'],
      startingScore: 501,
      thirdPlaceMatch: false,
      consolation: false,
      legsToWin: { group: 3, r16: 3, qf: 3, sf: 3, final: 4, thirdPlace: 2, consolation: 2 },
      sharing: true,
    });
  });

  it('disables the button while the request is in flight', async () => {
    let reply: (response: Response) => void = () => {};
    const previous = respond;
    respond = (call) =>
      call.url === '/api/tournaments'
        ? new Promise<Response>((resolve) => {
            reply = resolve;
          })
        : previous(call);
    await openTournament();
    pickAll(['Anna', 'Bartek', 'Celina', 'Darek']);
    fireEvent.click(button('Rozpocznij turniej'));
    await vi.waitFor(() => expect(tournamentPosts()).toHaveLength(1));
    expect(button('Rozpocznij turniej').disabled).toBe(true);
    fireEvent.click(button('Rozpocznij turniej'));
    expect(tournamentPosts()).toHaveLength(1);
    reply(json(500, { error: 'internal_error', message: 'Internal server error' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(button('Rozpocznij turniej').disabled).toBe(false);
  });

  it('shows the Polish tournament_active text with a link to the tournament', async () => {
    const previous = respond;
    respond = (call) =>
      call.url === '/api/tournaments'
        ? Promise.resolve(json(409, { error: 'tournament_active', message: 'Another tournament is in progress' }))
        : previous(call);
    await openTournament();
    pickAll(['Anna', 'Bartek', 'Celina', 'Darek']);
    fireEvent.click(button('Rozpocznij turniej'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Trwa już inny turniej. Dokończ go, zanim zaczniesz nowy.');
    expect(alert.textContent).not.toContain('Another tournament');
    expect(within(alert).getByRole('link', { name: 'Przejdź do turnieju' }).getAttribute('href')).toBe('#/tournaments');
    expect(button('Rozpocznij turniej').disabled).toBe(false);
    expect(window.location.hash).toBe('#/');
  });

  it('shows no link for other start errors', async () => {
    const previous = respond;
    respond = (call) =>
      call.url === '/api/tournaments'
        ? Promise.resolve(json(400, { error: 'archived_player', message: 'Player p2 is archived' }))
        : previous(call);
    await openTournament();
    pickAll(['Anna', 'Bartek', 'Celina', 'Darek']);
    fireEvent.click(button('Rozpocznij turniej'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(pl.archivedPlayer);
    expect(within(alert).queryByRole('link')).toBeNull();
  });

  it('keeps the start button in the bottom bar below lg and in the plan panel from lg', async () => {
    await openTournament();
    const bar = screen.getByRole('region', { name: 'Rozpoczęcie turnieju' });
    expect(within(bar).getByRole('button', { name: 'Rozpocznij turniej' })).toBeTruthy();
    expect(within(plan()).queryByRole('button', { name: 'Rozpocznij turniej' })).toBeNull();
    cleanup();

    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => Object.assign(new EventTarget(), { matches: true })),
    );
    await openTournament();
    expect(screen.queryByRole('region', { name: 'Rozpoczęcie turnieju' })).toBeNull();
    expect(within(plan()).getByRole('button', { name: 'Rozpocznij turniej' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Rozpocznij turniej' })).toHaveLength(1);
  });
});
