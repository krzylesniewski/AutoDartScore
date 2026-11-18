import type { Fixture, FixtureSlot, StandingRow, TournamentLiveMessage, TournamentStats, TournamentView } from '@autoscore/schema';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computedView,
  fixture,
  player,
  playedResults,
  snapshot,
  standingRow,
  tournamentConfig,
  tournamentPlayer,
  tournamentStats,
  tournamentStatsPlayer,
  tournamentView,
} from '../test/snapshots';
import { TournamentScreen } from './TournamentScreen';

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  closed = false;

  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  send(): void {}

  serverSend(message: TournamentLiveMessage): void {
    act(() => {
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
    });
  }

  serverClose(code: number): void {
    act(() => {
      this.dispatchEvent(new CloseEvent('close', { code }));
    });
  }
}

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: string | undefined;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const PLAYERS = [
  tournamentPlayer('p1', 'Anna'),
  tournamentPlayer('p2', 'Bartek'),
  tournamentPlayer('p3', 'Celina'),
  tournamentPlayer('p4', 'Darek'),
  tournamentPlayer('p5', 'Ewa'),
  tournamentPlayer('p6', 'Filip'),
];

function pair(first: string, second: string): [FixtureSlot, FixtureSlot] {
  return [
    { kind: 'player', playerId: first, seed: null },
    { kind: 'player', playerId: second, seed: null },
  ];
}

function played(number: number, first: string, second: string, legs: [number, number]): Fixture {
  return fixture({
    id: `g-${number}`,
    number,
    slots: pair(first, second),
    status: 'finished',
    matchId: `m-${number}`,
    result: { legs, winnerId: legs[0] > legs[1] ? first : second, corrected: false },
  });
}

function ready(number: number, first: string, second: string): Fixture {
  return fixture({ id: `g-${number}`, number, slots: pair(first, second), status: 'ready' });
}

// Gotowy mecz rozegrany 3:1 przez gracza ze slotu 0, a rozegrany zostaje bez zmian.
function finishedVersion(entry: Fixture): Fixture {
  const [first, second] = entry.slots;
  if (entry.result || first.kind !== 'player' || second.kind !== 'player') {
    return entry;
  }
  return played(entry.number, first.playerId, second.playerId, [3, 1]);
}

const GROUP_FIXTURES: Fixture[] = [
  played(1, 'p2', 'p5', [3, 2]),
  played(2, 'p1', 'p4', [3, 0]),
  played(3, 'p3', 'p6', [3, 2]),
  played(4, 'p2', 'p4', [3, 2]),
  played(5, 'p1', 'p6', [3, 0]),
  played(6, 'p3', 'p5', [3, 0]),
  played(7, 'p2', 'p6', [3, 0]),
  played(8, 'p1', 'p3', [3, 1]),
  played(9, 'p4', 'p5', [3, 2]),
  ready(10, 'p2', 'p3'),
  ready(11, 'p1', 'p5'),
  ready(12, 'p6', 'p4'),
  ready(13, 'p2', 'p1'),
  ready(14, 'p3', 'p4'),
  ready(15, 'p6', 'p5'),
];

function row(playerId: string, place: number, won: number, lost: number, legsFor: number, legsAgainst: number): StandingRow {
  return standingRow(playerId, place, { won, lost, legsFor, legsAgainst, advances: place <= 4 });
}

const STANDINGS: StandingRow[] = [
  row('p1', 1, 3, 0, 9, 1),
  row('p2', 2, 3, 0, 9, 4),
  row('p3', 3, 2, 1, 7, 5),
  row('p4', 4, 1, 2, 5, 8),
  row('p5', 5, 0, 3, 4, 9),
  row('p6', 6, 0, 3, 2, 9),
];

function groupView(overrides: Partial<TournamentView> = {}): TournamentView {
  return tournamentView({
    name: 'Grupa jesienna',
    format: 'group_playoff',
    config: {
      name: 'Grupa jesienna',
      format: 'group_playoff',
      playerIds: PLAYERS.map((player) => player.id),
      startingScore: 501,
      advance: 4,
      thirdPlaceMatch: false,
      consolation: false,
      legsToWin: { group: 3, r16: 3, qf: 3, sf: 3, final: 4, thirdPlace: 2, consolation: 2 },
      sharing: true,
    },
    players: PLAYERS,
    fixtures: GROUP_FIXTURES,
    standings: STANDINGS,
    nextFixtureId: 'g-10',
    liveFixtureId: null,
    canRedraw: false,
    eventSeq: 12,
    ...overrides,
  });
}

function updated(view: TournamentView): TournamentLiveMessage {
  return { type: 'tournament_updated', tournamentId: view.id, eventSeq: view.eventSeq, tournament: view };
}

let calls: Call[];
let reply: () => Response;
let matchReply: (url: string) => Response;
let statsReply: () => Response;
let commandReply: (call: Call) => Response;

function getReply(url: string): Response {
  if (url.startsWith('/api/matches/')) {
    return matchReply(url);
  }
  return url === '/api/tournaments/t1/stats' ? statsReply() : reply();
}

beforeEach(() => {
  calls = [];
  FakeWebSocket.instances = [];
  reply = () => json(200, groupView());
  statsReply = () => json(200, tournamentStats({ players: PLAYERS.map((entry) => tournamentStatsPlayer(entry.id)) }));
  matchReply = () => json(404, { error: 'not_found', message: 'Match not found' });
  commandReply = () => json(201, { matchId: 'm 42', tournament: groupView({ eventSeq: 13 }) });
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const call = { url, method: init.method ?? 'GET', body: typeof init.body === 'string' ? init.body : undefined };
      calls.push(call);
      return Promise.resolve(call.method === 'GET' ? getReply(url) : commandReply(call));
    }),
  );
});

afterEach(() => {
  window.location.hash = '';
  vi.unstubAllGlobals();
});

function wideScreen(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => Object.assign(new EventTarget(), { matches: true })),
  );
}

function socket(): FakeWebSocket {
  const last = FakeWebSocket.instances.at(-1);
  if (!last) {
    throw new Error('No socket');
  }
  return last;
}

async function renderScreen(id = 't1'): Promise<void> {
  render(<TournamentScreen tournamentId={id} />);
  await screen.findByRole('heading', { level: 1 });
}

function table(): HTMLElement {
  return screen.getByRole('table', { name: 'Faza grupowa' });
}

// Tekst bez avatarów, bo ich inicjały są ukryte przed czytnikami ekranu.
function visibleText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return copy.textContent ?? '';
}

// Komórki td wiersza gracza: miejsce, sześć komórek rywali w kolejności tabeli, potem M, W, P, +/- i PKT.
function rowCells(name: string): HTMLTableCellElement[] {
  const tr = within(table()).getByRole('rowheader', { name }).closest('tr');
  return Array.from(tr?.querySelectorAll('td') ?? []);
}

function crossCellText(rowName: string, columnIndex: number): string {
  return rowCells(rowName)[1 + columnIndex]?.textContent ?? '';
}

function postCalls(): Call[] {
  return calls.filter((call) => call.method === 'POST');
}

describe('TournamentScreen: header', () => {
  it('shows the label, the name, the phase progress and the tabs', async () => {
    await renderScreen();
    expect(screen.getByRole('heading', { level: 1, name: 'Grupa jesienna' })).toBeTruthy();
    expect(screen.getByText('Turniej · Grupa + play-off · 501')).toBeTruthy();
    expect(screen.getByText('Faza grupowa · 9 z 15 meczów')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Turniej' }).getAttribute('aria-current')).toBe('page');
    const tablist = screen.getByRole('tablist', { name: 'Widok turnieju' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Grupa', 'Play-off', 'Statystyki']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(calls.map((call) => call.url)).toEqual(['/api/tournaments/t1']);
    expect(socket().url).toMatch(/\/api\/tournaments\/t1\/live$/);
  });

  it('uses the singular for a single match', async () => {
    reply = () => json(200, tournamentView({ fixtures: [fixture()] }));
    await renderScreen();
    expect(screen.getByText('Liga · 0 z 1 meczu')).toBeTruthy();
    expect(screen.getByText('Turniej · Liga · 501')).toBeTruthy();
  });

  it('shows Turniej zakończony and no actions in a finished tournament', async () => {
    const finished = GROUP_FIXTURES.map(finishedVersion);
    reply = () =>
      json(200, groupView({ status: 'finished', finishedAt: '2026-11-12T21:00:00.000Z', fixtures: finished, nextFixtureId: null }));
    await renderScreen();
    expect(screen.getAllByText('Turniej zakończony')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Zagraj mecz' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Zagraj mecz \d+$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Losuj ponownie' })).toBeNull();
  });

  it('shows the lost connection while the socket is closed', async () => {
    await renderScreen();
    expect(screen.queryByText('Brak połączenia z serwerem. Łączę ponownie…')).toBeNull();
    socket().serverClose(1006);
    expect(screen.getByText('Brak połączenia z serwerem. Łączę ponownie…')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Grupa jesienna' })).toBeTruthy();
  });
});

describe('TournamentScreen: tabs', () => {
  it('moves between the group and the play-off with the arrow keys and renders only the selected panel', async () => {
    await renderScreen();
    const [group, playoff] = screen.getAllByRole('tab');
    if (!group || !playoff) {
      throw new Error('Missing tabs');
    }
    expect(group.tabIndex).toBe(0);
    expect(playoff.tabIndex).toBe(-1);
    expect(group.getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id);
    expect(playoff.hasAttribute('aria-controls')).toBe(false);
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(group.id);

    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(playoff.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(playoff);
    expect(playoff.tabIndex).toBe(0);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(playoff.id);
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.keyDown(playoff, { key: 'ArrowLeft' });
    expect(group.getAttribute('aria-selected')).toBe('true');
    expect(table()).toBeTruthy();
  });

  it('opens the play-off by default once the group is done and keeps the tab on updates', async () => {
    const allPlayed = GROUP_FIXTURES.map(finishedVersion);
    const final = fixture({
      id: 'p-f',
      number: 16,
      phase: 'playoff',
      bracketRound: 'final',
      slots: [
        { kind: 'player', playerId: 'p1', seed: 1 },
        { kind: 'player', playerId: 'p2', seed: 2 },
      ],
    });
    reply = () => json(200, groupView({ fixtures: [...allPlayed, final], nextFixtureId: 'p-f' }));
    await renderScreen();
    expect(screen.getByRole('tab', { name: 'Play-off' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Play-off · 0 z 1 meczu')).toBeTruthy();
    expect(within(screen.getByRole('tabpanel')).getByText('Mecz #16 · do rozegrania')).toBeTruthy();
    expect(within(screen.getByRole('tabpanel')).queryByText('Mecz #1 · zakończony')).toBeNull();

    socket().serverSend(updated(groupView({ eventSeq: 13 })));
    expect(screen.getByRole('tab', { name: 'Play-off' }).getAttribute('aria-selected')).toBe('true');
  });

  it('shows one Tabela tab and the league table without the advance line in a league', async () => {
    wideScreen();
    reply = () =>
      json(
        200,
        tournamentView({
          players: PLAYERS.slice(0, 3),
          standings: [row('p1', 1, 0, 0, 0, 0), row('p2', 2, 0, 0, 0, 0), row('p3', 3, 0, 0, 0, 0)].map((entry) => ({
            ...entry,
            advances: false,
          })),
          fixtures: [ready(1, 'p1', 'p2'), ready(2, 'p2', 'p3'), ready(3, 'p3', 'p1')],
        }),
      );
    await renderScreen();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Tabela', 'Statystyki']);
    expect(screen.getByRole('table', { name: 'Tabela ligi' })).toBeTruthy();
    expect(screen.getByText('do 3 wygranych legów')).toBeTruthy();
    expect(screen.getByText('W komórce: wynik w legach i średnia gracza z tego meczu.')).toBeTruthy();
    expect(screen.queryByText('Strzałka: miejsce dające awans do play-off.')).toBeNull();
    expect(screen.queryByText('awans do play-off')).toBeNull();
  });

  it('shows the Drabinka tab with the bracket in a cup', async () => {
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
              round: 2,
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
              slots: pair('p2', 'p3'),
              status: 'finished',
              matchId: 'm2',
              result: { legs: [1, 3], winnerId: 'p3', corrected: false },
            }),
          ],
          nextFixtureId: null,
        }),
      );
    await renderScreen();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Drabinka', 'Statystyki']);
    const frame = screen.getByRole('region', { name: 'Drabinka' });
    expect(
      within(frame)
        .getAllByRole('heading')
        .map((heading) => heading.textContent),
    ).toEqual(['Półfinały · do 3', 'Finał · do 3']);
    const items = within(frame).getAllByRole('listitem');
    expect(items.map((item) => visibleText(item))).toEqual([
      '1AnnaWolny losAwans bez meczu',
      'Szczegóły meczu #2 Bartek1Celinazwycięzca3Mecz #2 · zakończony',
      '1AnnaZwycięzca półfinału 2Mecz #3 · po półfinałach',
    ]);
    expect(screen.getByText('Play-off · 1 z 2 meczów')).toBeTruthy();
  });
});

describe('TournamentScreen: table', () => {
  it('renders the cross table of the six-player group', async () => {
    wideScreen();
    await renderScreen();
    const rowHeaders = within(table()).getAllByRole('rowheader');
    expect(rowHeaders.map(visibleText)).toEqual(['Anna', 'Bartek', 'Celina', 'Darek', 'Ewa', 'Filip']);
    const anna = rowCells('Anna')
      .slice(7)
      .map((cell) => cell.textContent);
    expect(anna).toEqual(['3', '3', '0', '+8', '6']);
    expect(
      rowCells('Filip')
        .slice(7)
        .map((cell) => cell.textContent),
    ).toEqual(['3', '0', '3', '-7', '0']);
    expect(crossCellText('Anna', 2)).toBe('Szczegóły meczu #8 3–1');
    expect(crossCellText('Celina', 0)).toBe('Szczegóły meczu #8 1–3');
    const bartekCelina = crossCellText('Bartek', 2);
    expect(bartekCelina).toContain('10');
    expect(bartekCelina).toContain('teraz');
    expect(crossCellText('Celina', 1)).toContain('teraz');
    expect(crossCellText('Anna', 4)).toBe('11Mecz 11');
    expect(rowCells('Anna')[1]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('names the player columns and the abbreviations for screen readers', async () => {
    wideScreen();
    await renderScreen();
    const headers = within(table()).getAllByRole('columnheader');
    expect(headers.map((header) => visibleText(header))).toEqual([
      'Miejsce',
      'Gracz',
      'Anna',
      'Bartek',
      'Celina',
      'Darek',
      'Ewa',
      'Filip',
      'Mecze',
      'Wygrane',
      'Przegrane',
      'Bilans legów',
      'Punkty',
    ]);
  });

  it('marks trwa on the live fixture', async () => {
    wideScreen();
    const fixtures = GROUP_FIXTURES.map((entry) =>
      entry.id === 'g-11' ? { ...entry, status: 'in_progress' as const, matchId: 'm11' } : entry,
    );
    reply = () => json(200, groupView({ fixtures, liveFixtureId: 'g-11' }));
    await renderScreen();
    expect(crossCellText('Anna', 4)).toBe('11Mecz 11trwa');
    expect(crossCellText('Bartek', 2)).toBe('10Mecz 10');
  });

  it('shows the group meta, the legend and the advance marker on places 1-4 only', async () => {
    wideScreen();
    await renderScreen();
    expect(screen.getByText('do 3 wygranych legów · 4 najlepszych do play-off')).toBeTruthy();
    expect(screen.getByText('Strzałka: miejsce dające awans do play-off.')).toBeTruthy();
    expect(screen.getByText('Remis w punktach: bilans legów, mecz bezpośredni, średnia.')).toBeTruthy();
    const marked = ['Anna', 'Bartek', 'Celina', 'Darek', 'Ewa', 'Filip'].filter((name) =>
      rowCells(name)[0]?.textContent?.includes('awans do play-off'),
    );
    expect(marked).toEqual(['Anna', 'Bartek', 'Celina', 'Darek']);
  });

  it('uses the singular in the meta line for a group to 1 leg', async () => {
    const view = groupView();
    reply = () => json(200, { ...view, config: { ...view.config, legsToWin: { ...view.config.legsToWin, group: 1 } } });
    await renderScreen();
    expect(screen.getByText('do 1 wygranego lega · 4 najlepszych do play-off')).toBeTruthy();
  });

  it('puts the cross table in a keyboard scrollable region from sm', async () => {
    wideScreen();
    await renderScreen();
    const region = screen.getByRole('region', { name: 'Faza grupowa' });
    expect(region.contains(table())).toBe(true);
    expect(region.tabIndex).toBe(0);
    // Klasa jest tu znaczeniem: tylko ta ramka przewija się w poziomie, a strona nie.
    expect(region.classList.contains('overflow-x-auto')).toBe(true);
  });

  it('shows the short table without player columns on a phone', async () => {
    await renderScreen();
    const headers = within(table()).getAllByRole('columnheader');
    expect(within(table()).getByText('W–P').closest('th')).toBeTruthy();
    expect(headers.map((header) => visibleText(header))).toEqual(['Miejsce', 'Gracz', 'Wygrane i przegrane', 'Bilans legów', 'Punkty']);
    expect(within(table()).queryByRole('columnheader', { name: 'Anna' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Faza grupowa' })).toBeNull();
    expect(rowCells('Anna').map((cell) => visibleText(cell))).toEqual(['1awans do play-off', '3–0', '+8', '6']);
    expect(rowCells('Darek').map((cell) => visibleText(cell))).toEqual(['4awans do play-off', '1–2', '-3', '2']);
    expect(rowCells('Ewa').map((cell) => visibleText(cell))).toEqual(['5', '0–3', '-5', '0']);
  });
});

describe('TournamentScreen: next match and queue', () => {
  it('shows the next match with places, versus and the meta line', async () => {
    await renderScreen();
    const card = screen.getByRole('region', { name: 'Następny mecz' });
    expect(within(card).getByText('#10')).toBeTruthy();
    expect(visibleText(card)).toContain('Bartek2. miejscevsCelina3. miejsce');
    expect(within(card).getByText('Do 3 wygranych legów · 501 · kto zaczyna: losowanie')).toBeTruthy();
  });

  it('lists the other ready fixtures in the queue', async () => {
    await renderScreen();
    const queue = screen.getByRole('region', { name: 'Kolejka' });
    const items = within(queue).getAllByRole('listitem');
    expect(items.map((item) => visibleText(item))).toEqual([
      '#11AnnavsEwaZagraj',
      '#12FilipvsDarekZagraj',
      '#13BartekvsAnnaZagraj',
      '#14CelinavsDarekZagraj',
      '#15FilipvsEwaZagraj',
    ]);
    expect(
      within(queue)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Zagraj mecz 11', 'Zagraj mecz 12', 'Zagraj mecz 13', 'Zagraj mecz 14', 'Zagraj mecz 15']);
  });

  it('leaves the queue out when only the next match is ready', async () => {
    const fixtures = GROUP_FIXTURES.filter((entry) => entry.status !== 'ready' || entry.id === 'g-10');
    reply = () => json(200, groupView({ fixtures }));
    await renderScreen();
    expect(screen.queryByRole('region', { name: 'Kolejka' })).toBeNull();
  });

  it('says that no match is ready when nextFixtureId is null', async () => {
    reply = () => json(200, groupView({ nextFixtureId: null }));
    await renderScreen();
    expect(screen.getByText('Brak meczu gotowego do gry.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zagraj mecz' })).toBeNull();
  });

  it('starts the next match once on a double click and opens it', async () => {
    await renderScreen();
    const play = screen.getByRole<HTMLButtonElement>('button', { name: 'Zagraj mecz' });
    fireEvent.click(play);
    fireEvent.click(play);
    await waitFor(() => expect(window.location.hash).toBe('#/matches/m%2042'));
    expect(postCalls()).toEqual([{ url: '/api/tournaments/t1/fixtures/g-10/start', method: 'POST', body: '{"expectedSeq":12}' }]);
    expect(play.disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Zagraj mecz 11' }).disabled).toBe(true);
  });

  it('starts a match from the queue', async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Zagraj mecz 11' }));
    await waitFor(() => expect(window.location.hash).toBe('#/matches/m%2042'));
    expect(postCalls().map((call) => call.url)).toEqual(['/api/tournaments/t1/fixtures/g-11/start']);
  });

  it('shows the Polish error, reloads and enables the buttons when a start fails', async () => {
    commandReply = () => json(409, { error: 'fixture_not_ready', message: 'Fixture is not ready' });
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Zagraj mecz' }));
    expect(await screen.findByText('Ten mecz nie jest jeszcze gotowy do gry.')).toBeTruthy();
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
    expect(calls.filter((call) => call.method === 'GET').map((call) => call.url)).toEqual(['/api/tournaments/t1', '/api/tournaments/t1']);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Zagraj mecz' }).disabled).toBe(false);
    expect(window.location.hash).toBe('');
  });

  it('shows the error next to the queue when a queue start fails', async () => {
    commandReply = () => json(409, { error: 'stale_state', message: 'Tournament state changed', tournament: groupView({ eventSeq: 14 }) });
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Zagraj mecz 12' }));
    const queue = screen.getByRole('region', { name: 'Kolejka' });
    expect(await within(queue).findByText('Dane zmieniły się na innym urządzeniu. Sprawdź stan i spróbuj ponownie.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Następny mecz' })).queryByRole('alert')).toBeNull();
  });
});

describe('TournamentScreen: running matches', () => {
  it('links back to a running match, the live one first', async () => {
    const fixtures = GROUP_FIXTURES.map((entry) => {
      if (entry.id === 'g-12') {
        return { ...entry, status: 'in_progress' as const, matchId: 'm7' };
      }
      if (entry.id === 'g-11') {
        return { ...entry, status: 'in_progress' as const, matchId: 'm6' };
      }
      return entry;
    });
    reply = () => json(200, groupView({ fixtures, liveFixtureId: 'g-12' }));
    await renderScreen();
    const running = within(screen.getByRole('list', { name: 'Trwające mecze' })).getAllByRole('listitem');
    expect(running.map((item) => visibleText(item))).toEqual([
      'Trwa: grupa, mecz 12#12FilipvsDarekWróć do meczu',
      'Trwa: grupa, mecz 11#11AnnavsEwaWróć do meczu',
    ]);
    const links = screen.getAllByRole('link', { name: 'Wróć do meczu' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#/matches/m7', '#/matches/m6']);
  });
});

function bracketFrame(): HTMLElement {
  return screen.getByRole('region', { name: 'Drabinka' });
}

// Nagłówki kolumn i liczba meczów w każdej kolumnie ramki.
function columnShape(frame: HTMLElement): [string, number][] {
  return within(frame)
    .getAllByRole('heading')
    .map((heading) => {
      const name = heading.textContent ?? '';
      return [name, within(within(frame).getByRole('list', { name })).getAllByRole('listitem').length];
    });
}

function playerName(view: TournamentView, fixtureId: string, index: 0 | 1): string {
  const slot = view.fixtures.find((entry) => entry.id === fixtureId)?.slots[index];
  const found = slot?.kind === 'player' ? view.players.find((entry) => entry.id === slot.playerId) : undefined;
  if (!found) {
    throw new Error(`No player in ${fixtureId}`);
  }
  return found.name;
}

// Pole meczu w drabince razem z linią stanu pod nim.
function box(tag: string): HTMLElement {
  const item = screen.getByText(tag).parentElement;
  if (!item) {
    throw new Error(`No box with ${tag}`);
  }
  return item;
}

const MOCKUP = tournamentConfig('group_playoff', 6, { advance: 4, thirdPlaceMatch: true, consolation: true });

// Stan z makiety: grupa rozegrana, pierwszy półfinał i pocieszenie zakończone, drugi półfinał trwa.
function mockupView(): TournamentView {
  const group = playedResults(MOCKUP, {}, (entry) => entry.phase === 'group');
  return computedView(MOCKUP, { ...group, 'p-sf-1': [3, 1], 'c-f': [0, 2], 'p-sf-2': [1, 1] });
}

function liveSemiFinal(view: TournamentView): (url: string) => Response {
  const semi = view.fixtures.find((entry) => entry.id === 'p-sf-2');
  const ids = semi?.slots.map((slot) => (slot.kind === 'player' ? slot.playerId : '')) ?? [];
  return (url) =>
    url === '/api/matches/m-p-sf-2'
      ? json(
          200,
          snapshot({
            id: 'm-p-sf-2',
            legIndex: 2,
            currentPlayerId: ids[0] ?? null,
            players: ids.map((id) => player(id, id, { legsWon: 1 })),
          }),
        )
      : json(404, { error: 'not_found', message: 'Match not found' });
}

describe('TournamentScreen: bracket', () => {
  it.each([
    [
      4,
      [
        ['Półfinały · do 3', 2],
        ['Finał · do 4', 1],
      ],
    ],
    [
      8,
      [
        ['Ćwierćfinały · do 3', 4],
        ['Półfinały · do 3', 2],
        ['Finał · do 4', 1],
      ],
    ],
    [
      16,
      [
        ['1/8 finału · do 3', 8],
        ['Ćwierćfinały · do 3', 4],
        ['Półfinały · do 3', 2],
        ['Finał · do 4', 1],
      ],
    ],
  ])('shows the columns of a cup of %i players in order', async (players, shape) => {
    reply = () => json(200, computedView(tournamentConfig('cup', players)));
    await renderScreen();
    expect(columnShape(bracketFrame())).toEqual(shape);
  });

  it('puts the bracket in a keyboard scrollable frame', async () => {
    reply = () => json(200, computedView(tournamentConfig('cup', 16)));
    await renderScreen();
    const frame = bracketFrame();
    expect(frame.tabIndex).toBe(0);
    // Klasa jest tu znaczeniem: tylko ta ramka przewija się w poziomie, a strona nie.
    expect(frame.classList.contains('overflow-x-auto')).toBe(true);
  });

  it('shows the byes of a cup of 5 players', async () => {
    reply = () => json(200, computedView(tournamentConfig('cup', 5)));
    await renderScreen();
    const frame = bracketFrame();
    expect(within(frame).getAllByText('Wolny los')).toHaveLength(3);
    expect(within(frame).getAllByText('Awans bez meczu')).toHaveLength(3);
    expect(visibleText(box('Mecz #1 · do rozegrania'))).toBe('4Darek5EwaMecz #1 · do rozegrania');
    expect(within(frame).getByText('Mecz #2 · po ćwierćfinałach')).toBeTruthy();
  });

  it('shows the group places while the group runs', async () => {
    reply = () => json(200, computedView(tournamentConfig('group_playoff', 6, { advance: 4 })));
    await renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'Play-off' }));
    expect(visibleText(box('Mecz #16 · po fazie grupowej'))).toBe('1. miejsce w grupie4. miejsce w grupieMecz #16 · po fazie grupowej');
  });

  it('shows the mockup state with the live semi-final, the extra matches and the placements', async () => {
    const view = mockupView();
    reply = () => json(200, view);
    matchReply = liveSemiFinal(view);
    await renderScreen();
    expect(screen.getByRole('tab', { name: 'Play-off' }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('Mecz #17 · na żywo, leg 3')).toBeTruthy();
    expect(calls.filter((call) => call.url.startsWith('/api/matches/')).map((call) => call.url)).toEqual(['/api/matches/m-p-sf-2']);

    expect(columnShape(bracketFrame())).toEqual([
      ['Półfinały · do 3', 2],
      ['Finał · do 4', 1],
    ]);
    expect(visibleText(box('Mecz #16 · zakończony'))).toBe(
      `Szczegóły meczu #16 1${playerName(view, 'p-sf-1', 0)}zwycięzca34${playerName(view, 'p-sf-1', 1)}1Mecz #16 · zakończony`,
    );
    expect(visibleText(box('Mecz #17 · na żywo, leg 3'))).toBe(
      `Szczegóły meczu #17 2${playerName(view, 'p-sf-2', 0)}13${playerName(view, 'p-sf-2', 1)}1Mecz #17 · na żywo, leg 3`,
    );
    expect(visibleText(box('Mecz #20 · po półfinałach'))).toBe(
      `1${playerName(view, 'p-sf-1', 0)}Zwycięzca półfinału 2Mecz #20 · po półfinałach`,
    );
    expect(visibleText(box('Mecz #19 · po półfinałach'))).toBe(
      `4${playerName(view, 'p-sf-1', 1)}Przegrany półfinału 2Mecz #19 · po półfinałach`,
    );
    expect(screen.getByRole('heading', { name: 'Mecz o 3. miejsce · do 2' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pocieszenie · 5. z 6. · do 2' })).toBeTruthy();
    expect(visibleText(box('Mecz #18 · zakończony'))).toBe(
      `Szczegóły meczu #18 5${playerName(view, 'c-f', 0)}06${playerName(view, 'c-f', 1)}zwycięzca2Mecz #18 · zakończony`,
    );

    const running = within(screen.getByRole('list', { name: 'Trwające mecze' })).getByRole('listitem');
    expect(within(running).getByText('Trwa: półfinał 2')).toBeTruthy();
    expect(within(running).getByText('1 : 1')).toBeTruthy();
    expect(within(running).getByText('Leg 3')).toBeTruthy();

    const placements = within(screen.getByRole('region', { name: 'Klasyfikacja końcowa' })).getAllByRole('listitem');
    expect(placements.map((item) => visibleText(item))).toEqual([
      '1.rozstrzygnie finał',
      '2.rozstrzygnie finał',
      '3.rozstrzygnie mecz o 3. miejsce',
      '4.rozstrzygnie mecz o 3. miejsce',
      `5.${playerName(view, 'c-f', 1)}pocieszenie 2–0`,
      `6.${playerName(view, 'c-f', 0)}pocieszenie`,
    ]);
  });

  it('marks the winner row for screen readers and leaves the loser row unmarked', async () => {
    const view = mockupView();
    reply = () => json(200, view);
    await renderScreen();
    const decided = box('Mecz #16 · zakończony');
    const winnerRow = within(decided).getByText(playerName(view, 'p-sf-1', 0)).parentElement;
    const loserRow = within(decided).getByText(playerName(view, 'p-sf-1', 1)).parentElement;
    expect(winnerRow?.querySelector('.sr-only')?.textContent).toBe('zwycięzca');
    expect(loserRow?.querySelector('.sr-only')).toBeNull();
    expect(within(decided).getAllByText('zwycięzca')).toHaveLength(1);
  });

  it('shows the running match without live legs until the match answers', async () => {
    reply = () => json(200, mockupView());
    await renderScreen();
    const running = within(screen.getByRole('list', { name: 'Trwające mecze' })).getByRole('listitem');
    await waitFor(() => expect(calls.some((call) => call.url === '/api/matches/m-p-sf-2')).toBe(true));
    expect(within(running).getByText('vs')).toBeTruthy();
    expect(within(running).queryByText(/^Leg /)).toBeNull();
    expect(screen.getByText('Mecz #17 · na żywo')).toBeTruthy();
  });

  it('fetches the live legs again on every tournament update', async () => {
    const view = mockupView();
    reply = () => json(200, view);
    matchReply = liveSemiFinal(view);
    await renderScreen();
    expect(await screen.findByText('1 : 1')).toBeTruthy();
    const ids = view.fixtures.find((entry) => entry.id === 'p-sf-2')?.slots.map((slot) => (slot.kind === 'player' ? slot.playerId : ''));
    matchReply = () =>
      json(200, snapshot({ id: 'm-p-sf-2', legIndex: 3, players: (ids ?? []).map((id, index) => player(id, id, { legsWon: 2 - index })) }));
    socket().serverSend(updated({ ...view }));
    expect(await screen.findByText('2 : 1')).toBeTruthy();
    expect(screen.getByText('Leg 4')).toBeTruthy();
    expect(screen.getByText('Mecz #17 · na żywo, leg 4')).toBeTruthy();
  });

  it('has no extra section without a third place match and a consolation', async () => {
    const config = tournamentConfig('group_playoff', 6, { advance: 4 });
    reply = () =>
      json(
        200,
        computedView(
          config,
          playedResults(config, {}, (entry) => entry.phase === 'group'),
        ),
      );
    await renderScreen();
    const panel = screen.getByRole('tabpanel');
    expect(
      within(panel)
        .getAllByRole('heading')
        .map((heading) => heading.textContent),
    ).toEqual(['Drabinka', 'Półfinały · do 3', 'Finał · do 4']);
    expect(within(panel).queryByText(/Mecz o 3\. miejsce/)).toBeNull();
    expect(within(panel).queryByText(/Pocieszenie/)).toBeNull();
    expect(screen.getByRole('region', { name: 'Klasyfikacja końcowa' })).toBeTruthy();
  });

  it('shows a consolation of more than one round as its own bracket', async () => {
    const config = tournamentConfig('group_playoff', 7, { advance: 4, consolation: true });
    reply = () =>
      json(
        200,
        computedView(
          config,
          playedResults(config, {}, (entry) => entry.phase === 'group'),
        ),
      );
    await renderScreen();
    const consolation = screen.getByRole('region', { name: 'Pocieszenie' });
    expect(consolation.tabIndex).toBe(0);
    expect(columnShape(consolation)).toEqual([
      ['Półfinały · do 2', 2],
      ['Finał · do 2', 1],
    ]);
    expect(within(consolation).getByText('Wolny los')).toBeTruthy();
    expect(within(consolation).getByText('Awans bez meczu')).toBeTruthy();
    expect(within(consolation).getByText(/Zwycięzca półfinału 2 \(pocieszenie\)/)).toBeTruthy();
    expect(within(bracketFrame()).queryByText('Wolny los')).toBeNull();
  });

  it('lists every place of a finished tournament without pending rows', async () => {
    reply = () => json(200, computedView(MOCKUP, playedResults(MOCKUP)));
    await renderScreen();
    const placements = within(screen.getByRole('region', { name: 'Klasyfikacja końcowa' })).getAllByRole('listitem');
    expect(placements.map((item) => visibleText(item).slice(0, 2))).toEqual(['1.', '2.', '3.', '4.', '5.', '6.']);
    expect(placements.some((item) => item.textContent?.includes('rozstrzygnie'))).toBe(false);
    expect(visibleText(placements[0] as HTMLElement)).toMatch(/finał 4–0$/);
  });

  it('shows no placements on the group tab', async () => {
    reply = () => json(200, mockupView());
    await renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'Grupa' }));
    expect(screen.queryByRole('region', { name: 'Klasyfikacja końcowa' })).toBeNull();
  });
});

describe('TournamentScreen: redraw', () => {
  it('shows Losuj ponownie only while canRedraw is true', async () => {
    await renderScreen();
    expect(screen.queryByRole('button', { name: 'Losuj ponownie' })).toBeNull();
  });

  it('redraws and renders the returned view', async () => {
    wideScreen();
    const unplayed = GROUP_FIXTURES.map((entry) => ({ ...entry, status: 'ready' as const, result: null, matchId: null }));
    const redrawn = unplayed.map((entry) => ({ ...entry, number: 16 - entry.number }));
    reply = () => json(200, groupView({ canRedraw: true, fixtures: unplayed, nextFixtureId: 'g-1' }));
    commandReply = () => json(200, groupView({ eventSeq: 13, canRedraw: true, fixtures: redrawn, nextFixtureId: 'g-15' }));
    await renderScreen();
    expect(crossCellText('Anna', 1)).toBe('13Mecz 13');
    fireEvent.click(screen.getByRole('button', { name: 'Losuj ponownie' }));
    await waitFor(() => expect(crossCellText('Anna', 1)).toBe('3Mecz 3'));
    expect(postCalls()).toEqual([{ url: '/api/tournaments/t1/draw', method: 'POST', body: '{"expectedSeq":12}' }]);
    expect(within(screen.getByRole('region', { name: 'Następny mecz' })).getByText('#1')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Losuj ponownie' }).disabled).toBe(false);
  });

  it('shows the Polish error when the first match has already started', async () => {
    reply = () => json(200, groupView({ canRedraw: true }));
    commandReply = () => json(409, { error: 'tournament_started', message: 'Tournament has started' });
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Losuj ponownie' }));
    expect(await screen.findByText('Pierwszy mecz już się zaczął, losowania nie da się powtórzyć.')).toBeTruthy();
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  });
});

function finishedGroupView(overrides: Partial<TournamentView> = {}): TournamentView {
  return groupView({
    status: 'finished',
    finishedAt: '2026-11-12T21:00:00.000Z',
    fixtures: GROUP_FIXTURES.map(finishedVersion),
    nextFixtureId: null,
    ...overrides,
  });
}

// Filip wycofany: jego dwa mecze do rozegrania (12 i 15) przegrywa walkowerem.
function withdrawnFilipView(): TournamentView {
  const fixtures = GROUP_FIXTURES.map((entry) => {
    if (entry.id === 'g-12') {
      return { ...entry, status: 'walkover' as const, result: { legs: [0, 3] as [number, number], winnerId: 'p4', corrected: false } };
    }
    if (entry.id === 'g-15') {
      return { ...entry, status: 'walkover' as const, result: { legs: [0, 3] as [number, number], winnerId: 'p5', corrected: false } };
    }
    return entry;
  });
  const standings = STANDINGS.map((entry) => (entry.playerId === 'p6' ? { ...entry, withdrawn: true } : entry));
  return groupView({ eventSeq: 13, fixtures, standings });
}

function incidentButton(name: 'Popraw wynik' | 'Wycofaj gracza'): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name });
}

function cellOf(rowName: string, columnIndex: number): string {
  const tr = within(table())
    .getByRole('rowheader', { name: new RegExp(`^${rowName}`) })
    .closest('tr');
  return tr?.querySelectorAll('td')[1 + columnIndex]?.textContent ?? '';
}

describe('TournamentScreen: incidents', () => {
  it('shows both buttons below the queue and not in the header while the tournament runs', async () => {
    await renderScreen();
    const correct = incidentButton('Popraw wynik');
    const withdraw = incidentButton('Wycofaj gracza');
    expect(correct.disabled).toBe(false);
    expect(document.querySelector('header')?.contains(correct)).toBe(false);
    const queue = screen.getByRole('region', { name: 'Kolejka' });
    expect(queue.compareDocumentPosition(correct) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(correct.parentElement).toBe(withdraw.parentElement);
    // Kolejność w DOM-ie: telefon pokazuje tabelę przed tymi przyciskami, więc „Zagraj mecz” zostaje na górze.
    expect(table().compareDocumentPosition(correct) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows only Popraw wynik in a finished tournament', async () => {
    reply = () => json(200, finishedGroupView());
    await renderScreen();
    expect(incidentButton('Popraw wynik')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Wycofaj gracza' })).toBeNull();
  });

  it('shows neither button in an archived tournament', async () => {
    reply = () => json(200, finishedGroupView({ archivedAt: '2026-11-13T10:00:00.000Z' }));
    await renderScreen();
    expect(screen.queryByRole('button', { name: 'Popraw wynik' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Wycofaj gracza' })).toBeNull();
  });

  it('hides Popraw wynik before the first finished match', async () => {
    reply = () => json(200, computedView(tournamentConfig('league', 4)));
    await renderScreen();
    expect(screen.queryByRole('button', { name: 'Popraw wynik' })).toBeNull();
    expect(incidentButton('Wycofaj gracza')).toBeTruthy();
  });

  it('corrects a result and shows popr. in the returned table', async () => {
    wideScreen();
    const fixtures = GROUP_FIXTURES.map((entry) =>
      entry.id === 'g-9' ? { ...entry, result: { legs: [2, 3] as [number, number], winnerId: 'p5', corrected: true } } : entry,
    );
    commandReply = () => json(200, groupView({ eventSeq: 13, fixtures }));
    await renderScreen();
    expect(screen.queryByText('popr.: wynik poprawiony.')).toBeNull();
    fireEvent.click(incidentButton('Popraw wynik'));
    const dialog = screen.getByRole('dialog', { name: 'Popraw wynik' });
    expect(within(dialog).getByRole<HTMLSelectElement>('combobox', { name: 'Mecz' }).value).toBe('g-9');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mniej legów: Darek' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Więcej legów: Ewa' }));
    expect(within(dialog).getByText('Zwycięzcą meczu zostanie Ewa.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Popraw wynik' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(postCalls()).toEqual([
      { url: '/api/tournaments/t1/fixtures/g-9/result', method: 'POST', body: '{"legs":[2,3],"expectedSeq":12}' },
    ]);
    expect(cellOf('Darek', 4)).toBe('Szczegóły meczu #9 2–3popr.wynik poprawiony');
    expect(cellOf('Ewa', 3)).toBe('Szczegóły meczu #9 3–2popr.wynik poprawiony');
    expect(screen.getByText('popr.: wynik poprawiony.')).toBeTruthy();
    expect(screen.queryByText('wo: walkower.')).toBeNull();
  });

  it('withdraws a player and shows wycofany and wo in the returned table', async () => {
    wideScreen();
    commandReply = () => json(201, withdrawnFilipView());
    await renderScreen();
    expect(screen.queryByText('wo: walkower.')).toBeNull();
    fireEvent.click(incidentButton('Wycofaj gracza'));
    const dialog = screen.getByRole('dialog', { name: 'Wycofać gracza?' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Filip/ }));
    expect(within(dialog).getByText('Filip przegra walkowerem 2 mecze.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Wycofaj gracza' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(postCalls()).toEqual([{ url: '/api/tournaments/t1/withdrawals', method: 'POST', body: '{"playerId":"p6","expectedSeq":12}' }]);
    expect(visibleText(within(table()).getByRole('rowheader', { name: /^Filip/ }))).toBe('Filipwycofany');
    expect(cellOf('Darek', 5)).toBe('3–0wowalkower');
    expect(cellOf('Filip', 3)).toBe('0–3wowalkower');
    expect(screen.getByText('wo: walkower.')).toBeTruthy();
    expect(screen.queryByText('popr.: wynik poprawiony.')).toBeNull();
  });

  it('marks the withdrawn player in the phone table', async () => {
    reply = () => json(200, withdrawnFilipView());
    await renderScreen();
    expect(within(table()).getByRole('columnheader', { name: 'Wygrane i przegrane' })).toBeTruthy();
    expect(visibleText(within(table()).getByRole('rowheader', { name: /^Filip/ }))).toBe('Filipwycofany');
    expect(visibleText(within(table()).getByRole('rowheader', { name: /^Ewa/ }))).toBe('Ewa');
  });

  it('shows the error in the window and fetches the tournament again', async () => {
    commandReply = () => json(409, { error: 'dependent_started', message: 'A dependent fixture has started' });
    await renderScreen();
    fireEvent.click(incidentButton('Popraw wynik'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mniej legów: Ewa' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Popraw wynik' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Zaczął się już mecz zależny od tego wyniku, więc wyniku nie da się poprawić.',
    );
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET' && call.url === '/api/tournaments/t1')).toHaveLength(2));
    expect(screen.getByRole('dialog')).toBe(dialog);
  });

  it('returns the focus to the opening button after Anuluj', async () => {
    await renderScreen();
    const withdraw = incidentButton('Wycofaj gracza');
    withdraw.focus();
    fireEvent.click(withdraw);
    expect(screen.getByRole('dialog', { name: 'Wycofać gracza?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(withdraw);
    expect(postCalls()).toEqual([]);
  });

  it('opens one window at a time', async () => {
    await renderScreen();
    fireEvent.click(incidentButton('Popraw wynik'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('marks a corrected result in the bracket', async () => {
    const cup = tournamentConfig('cup', 4);
    reply = () => json(200, computedView(cup, { 'p-sf-1': [3, 1] }, {}, { corrections: [{ fixtureId: 'p-sf-1', legs: [3, 2] }] }));
    await renderScreen();
    expect(within(bracketFrame()).getByText('Mecz #1 · zakończony, wynik poprawiony')).toBeTruthy();
  });
});

describe('TournamentScreen: averages', () => {
  // Anna z Celiną z średnimi, Anna z Darkiem jako walkower i Bartek z Darkiem jako poprawiony wynik ze średnimi.
  function averagesView(): TournamentView {
    const fixtures = GROUP_FIXTURES.map((entry): Fixture => {
      switch (entry.id) {
        case 'g-8':
          return { ...entry, averages: [52.5, 41.25] };
        case 'g-2':
          return { ...entry, status: 'walkover', matchId: null, averages: null };
        case 'g-4':
          return { ...entry, result: entry.result && { ...entry.result, corrected: true }, averages: [45, 39] };
        default:
          return entry;
      }
    });
    const standings = STANDINGS.map((entry) => (entry.playerId === 'p1' ? { ...entry, average: 47.625 } : entry));
    return groupView({ fixtures, standings });
  }

  function rowHeader(name: RegExp): HTMLElement {
    return within(table()).getByRole('rowheader', { name });
  }

  it('shows the row player average in a finished cell and none in a walkover or corrected cell', async () => {
    wideScreen();
    reply = () => json(200, averagesView());
    await renderScreen();
    const annaRow = rowHeader(/^Anna/).closest('tr') as HTMLElement;
    const celinaRow = rowHeader(/^Celina/).closest('tr') as HTMLElement;
    const cell = (row: HTMLElement, column: number) => row.querySelectorAll('td')[1 + column]?.textContent ?? '';
    expect(cell(annaRow, 2)).toBe('Szczegóły meczu #8 3–1średnia 52,50');
    expect(cell(celinaRow, 0)).toBe('Szczegóły meczu #8 1–3średnia 41,25');
    expect(cell(annaRow, 3)).toBe('3–0wowalkower');
    expect(crossCellText('Bartek', 3)).toBe('Szczegóły meczu #4 3–2popr.wynik poprawiony');
    expect(crossCellText('Bartek', 4)).toBe('Szczegóły meczu #1 3–2');
  });

  it('shows the group average under the name in the cross table', async () => {
    wideScreen();
    reply = () => json(200, averagesView());
    await renderScreen();
    const anna = rowHeader(/^Anna/);
    expect(within(anna).getByText('śr.').getAttribute('aria-hidden')).toBe('true');
    expect(visibleText(anna)).toBe('Annaśrednia 47,63');
    expect(within(rowHeader(/^Bartek/)).queryByText('śr.')).toBeNull();
  });

  it('shows the group average under the name in the phone table', async () => {
    reply = () => json(200, averagesView());
    await renderScreen();
    expect(within(table()).queryByRole('columnheader', { name: 'Anna' })).toBeNull();
    const anna = rowHeader(/^Anna/);
    expect(within(anna).getByText('śr.')).toBeTruthy();
    expect(visibleText(anna)).toBe('Annaśrednia 47,63');
    expect(visibleText(rowHeader(/^Ewa/))).toBe('Ewa');
  });

  it('shows the match averages in the slots of a finished bracket match and none in a running one', async () => {
    reply = () =>
      json(
        200,
        tournamentView({
          format: 'cup',
          players: PLAYERS.slice(0, 4),
          fixtures: [
            fixture({
              id: 'p-sf-1',
              number: 1,
              phase: 'playoff',
              bracketRound: 'sf',
              slots: [
                { kind: 'player', playerId: 'p1', seed: 1 },
                { kind: 'player', playerId: 'p4', seed: 4 },
              ],
              status: 'finished',
              matchId: 'm1',
              result: { legs: [3, 1], winnerId: 'p1', corrected: false },
              averages: [48.5, 36],
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
              status: 'in_progress',
              matchId: 'm2',
            }),
          ],
          nextFixtureId: null,
          liveFixtureId: 'p-sf-2',
        }),
      );
    await renderScreen();
    expect(visibleText(box('Mecz #1 · zakończony'))).toBe(
      'Szczegóły meczu #1 1Annazwycięzcaśrednia 48,5034Darekśrednia 36,001Mecz #1 · zakończony',
    );
    const running = box('Mecz #2 · na żywo');
    expect(running.textContent).not.toContain('średnia');
  });
});

describe('TournamentScreen: stats tab', () => {
  function statsView(): TournamentStats {
    return tournamentStats({
      players: PLAYERS.map((entry, index) => tournamentStatsPlayer(entry.id, { average: 40 + index, dartsThrown: 30 })),
    });
  }

  it('fetches the stats only after the tab opens and shows the panel without the queue', async () => {
    statsReply = () => json(200, statsView());
    await renderScreen();
    expect(screen.getByRole('region', { name: 'Kolejka' })).toBeTruthy();
    expect(calls.map((call) => call.url)).toEqual(['/api/tournaments/t1']);

    fireEvent.click(screen.getByRole('tab', { name: 'Statystyki' }));
    expect(screen.getByRole('tab', { name: 'Statystyki' }).getAttribute('aria-selected')).toBe('true');
    expect(within(screen.getByRole('tabpanel')).getByText('Ładowanie…')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Gracze w turnieju' })).toBeTruthy();
    expect(calls.map((call) => call.url)).toEqual(['/api/tournaments/t1', '/api/tournaments/t1/stats']);
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(screen.getByRole('tab', { name: 'Statystyki' }).id);
    expect(within(panel).getByRole('table', { name: 'Gracze w turnieju' })).toBeTruthy();
    expect(within(panel).getByRole('heading', { name: 'Rekordy turnieju' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Kolejka' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Następny mecz' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Popraw wynik' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Grupa' }));
    expect(screen.getByRole('region', { name: 'Kolejka' })).toBeTruthy();
  });

  it('fetches the stats again on tournament_updated while the tab is open', async () => {
    statsReply = () => json(200, statsView());
    await renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'Statystyki' }));
    await screen.findByRole('heading', { name: 'Gracze w turnieju' });
    socket().serverSend(updated(groupView({ eventSeq: 13 })));
    await waitFor(() => expect(calls.filter((call) => call.url === '/api/tournaments/t1/stats')).toHaveLength(2));
    expect(screen.getByRole('heading', { name: 'Gracze w turnieju' })).toBeTruthy();
  });

  it('shows an error when the stats fail to load', async () => {
    statsReply = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    await renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'Statystyki' }));
    expect(await screen.findByText('Nie udało się pobrać statystyk turnieju')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Gracze w turnieju' })).toBeNull();
  });

  it('keeps the last stats under the error after a failed refetch', async () => {
    statsReply = () => json(200, statsView());
    await renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'Statystyki' }));
    await screen.findByRole('heading', { name: 'Gracze w turnieju' });
    statsReply = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    socket().serverSend(updated(groupView({ eventSeq: 13 })));
    expect(await screen.findByText('Nie udało się pobrać statystyk turnieju')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Gracze w turnieju' })).toBeTruthy();
  });
});

describe('TournamentScreen: live updates', () => {
  it('shows a new result from tournament_updated', async () => {
    wideScreen();
    await renderScreen();
    expect(crossCellText('Bartek', 2)).toContain('teraz');
    const fixtures = GROUP_FIXTURES.map((entry) => (entry.id === 'g-10' ? played(10, 'p2', 'p3', [1, 3]) : entry));
    socket().serverSend(updated(groupView({ eventSeq: 13, fixtures, nextFixtureId: 'g-11' })));
    expect(crossCellText('Bartek', 2)).toBe('Szczegóły meczu #10 1–3');
    expect(crossCellText('Celina', 1)).toBe('Szczegóły meczu #10 3–1');
    expect(screen.getByText('Faza grupowa · 10 z 15 meczów')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Następny mecz' })).getByText('#11')).toBeTruthy();
  });
});

describe('TournamentScreen: loading failures', () => {
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

  it('encodes the tournament id in the GET and the socket', async () => {
    reply = () => json(200, tournamentView({ id: 't 1' }));
    await renderScreen('t 1');
    expect(calls.map((call) => call.url)).toEqual(['/api/tournaments/t%201']);
    expect(socket().url).toMatch(/\/api\/tournaments\/t%201\/live$/);
  });
});

describe('TournamentScreen: match page links', () => {
  it('links a finished cross table cell to the match page and keeps the legs text on its own', async () => {
    wideScreen();
    const fixtures = GROUP_FIXTURES.map((entry): Fixture =>
      entry.id === 'g-2' ? { ...entry, status: 'walkover', matchId: 'm-2', averages: null } : entry,
    );
    reply = () => json(200, groupView({ id: 't 1', fixtures }));
    await renderScreen('t 1');
    const links = within(table()).getAllByRole('link', { name: /^Szczegóły meczu #8\b/ });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#/tournaments/t%201/matches/m-8', '#/tournaments/t%201/matches/m-8']);
    expect(within(links[0] as HTMLElement).getByText('3–1', { exact: true })).toBeTruthy();
    expect(within(table()).queryByRole('link', { name: /^Szczegóły meczu #2\b/ })).toBeNull();
    expect(within(table()).queryByRole('link', { name: /^Szczegóły meczu #10\b/ })).toBeNull();
  });

  it('links the finished and the running bracket boxes to the match page', async () => {
    const finished = fixture({
      id: 'p-sf-1',
      number: 1,
      phase: 'playoff',
      bracketRound: 'sf',
      slots: [
        { kind: 'player', playerId: 'p1', seed: 1 },
        { kind: 'player', playerId: 'p4', seed: 4 },
      ],
      status: 'finished',
      matchId: 'm 1',
      result: { legs: [3, 1], winnerId: 'p1', corrected: false },
    });
    const running = fixture({
      id: 'p-sf-2',
      number: 2,
      phase: 'playoff',
      bracketRound: 'sf',
      slots: [
        { kind: 'player', playerId: 'p2', seed: 2 },
        { kind: 'player', playerId: 'p3', seed: 3 },
      ],
      status: 'in_progress',
      matchId: 'm2',
    });
    const final = fixture({
      id: 'p-f',
      number: 3,
      phase: 'playoff',
      bracketRound: 'final',
      slots: [
        { kind: 'winner_of', fixtureId: 'p-sf-1' },
        { kind: 'winner_of', fixtureId: 'p-sf-2' },
      ],
      status: 'waiting',
    });
    reply = () =>
      json(
        200,
        tournamentView({
          format: 'cup',
          players: PLAYERS.slice(0, 4),
          fixtures: [finished, running, final],
          nextFixtureId: null,
          liveFixtureId: 'p-sf-2',
        }),
      );
    await renderScreen();
    const frame = bracketFrame();
    expect(
      within(frame)
        .getByRole('link', { name: /^Szczegóły meczu #1\b/ })
        .getAttribute('href'),
    ).toBe('#/tournaments/t1/matches/m%201');
    expect(
      within(frame)
        .getByRole('link', { name: /^Szczegóły meczu #2\b/ })
        .getAttribute('href'),
    ).toBe('#/tournaments/t1/matches/m2');
    expect(within(frame).queryByRole('link', { name: /^Szczegóły meczu #3\b/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Wróć do meczu' }).getAttribute('href')).toBe('#/matches/m2');
  });

  it('lists the played fixtures from the last one with the tournament result and a details link', async () => {
    const fixtures = GROUP_FIXTURES.map((entry): Fixture =>
      entry.id === 'g-9' && entry.result ? { ...entry, result: { legs: [1, 3], winnerId: 'p5', corrected: true } } : entry,
    );
    reply = () => json(200, groupView({ fixtures }));
    await renderScreen();
    const list = screen.getByRole('region', { name: 'Rozegrane mecze' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(9);
    expect(visibleText(rows[0] as HTMLElement)).toBe('#9Darek1 : 3wynik poprawionyEwaSzczegóły');
    expect(visibleText(rows[8] as HTMLElement)).toBe('#1Bartek3 : 2EwaSzczegóły');
    const details = within(list).getByRole('link', { name: 'Szczegóły meczu #9' });
    expect(details.getAttribute('href')).toBe('#/tournaments/t1/matches/m-9');
    expect(within(list).getByRole('link', { name: 'Szczegóły meczu #1' }).getAttribute('href')).toBe('#/tournaments/t1/matches/m-1');
  });

  it('leaves the played fixtures out before the first finished match', async () => {
    reply = () => json(200, tournamentView({ fixtures: [fixture()] }));
    await renderScreen();
    expect(screen.queryByRole('region', { name: 'Rozegrane mecze' })).toBeNull();
    expect(screen.queryByText('Rozegrane mecze')).toBeNull();
  });
});

describe('TournamentScreen: sharing', () => {
  const finishedAt = '2026-11-12T21:00:00.000Z';

  it('shows Udostępnij in a running and in a finished tournament, but not in an archived one', async () => {
    await renderScreen();
    expect(screen.getByRole('button', { name: 'Udostępnij' })).toBeTruthy();

    socket().serverSend(
      updated(groupView({ status: 'finished', finishedAt, fixtures: GROUP_FIXTURES.map(finishedVersion), eventSeq: 13 })),
    );
    expect(screen.getByRole('button', { name: 'Udostępnij' })).toBeTruthy();

    socket().serverSend(
      updated(
        groupView({ status: 'finished', finishedAt, fixtures: GROUP_FIXTURES.map(finishedVersion), archivedAt: finishedAt, eventSeq: 14 }),
      ),
    );
    expect(screen.queryByRole('button', { name: 'Udostępnij' })).toBeNull();
  });

  it('opens the dialog, switches sharing off and takes the returned view', async () => {
    commandReply = () => json(200, groupView({ sharing: false, eventSeq: 13 }));
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Udostępnij' }));
    const dialog = screen.getByRole('dialog', { name: 'Udostępnij turniej' });
    const toggle = within(dialog).getByRole('button', { name: 'Publiczny link z kodem QR' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('false'));
    expect(postCalls()).toEqual([
      { url: '/api/tournaments/t1/sharing', method: 'POST', body: JSON.stringify({ sharing: false, expectedSeq: 12 }) },
    ]);
    expect(screen.getByRole('dialog', { name: 'Udostępnij turniej' })).toBe(dialog);
  });

  it('fetches the tournament again after a failed switch', async () => {
    commandReply = () => json(409, { error: 'tournament_archived', message: 'Tournament is archived' });
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Udostępnij' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publiczny link z kodem QR' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET' && call.url === '/api/tournaments/t1')).toHaveLength(2));
  });

  it('returns the focus to Udostępnij after Zamknij', async () => {
    await renderScreen();
    const share = screen.getByRole('button', { name: 'Udostępnij' });
    share.focus();
    fireEvent.click(share);
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(share);
    expect(postCalls()).toEqual([]);
  });
});
