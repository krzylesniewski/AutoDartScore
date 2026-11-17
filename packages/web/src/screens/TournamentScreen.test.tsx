import type { Fixture, FixtureSlot, StandingRow, TournamentLiveMessage, TournamentView } from '@autoscore/schema';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture, standingRow, tournamentPlayer, tournamentView } from '../test/snapshots';
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
let commandReply: (call: Call) => Response;

beforeEach(() => {
  calls = [];
  FakeWebSocket.instances = [];
  reply = () => json(200, groupView());
  commandReply = () => json(201, { matchId: 'm 42', tournament: groupView({ eventSeq: 13 }) });
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const call = { url, method: init.method ?? 'GET', body: typeof init.body === 'string' ? init.body : undefined };
      calls.push(call);
      return Promise.resolve(call.method === 'GET' ? reply() : commandReply(call));
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
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Grupa', 'Play-off']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
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
    expect(within(screen.getByRole('tabpanel')).getByText('Mecz 16')).toBeTruthy();
    expect(within(screen.getByRole('tabpanel')).queryByText('Mecz 1')).toBeNull();

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
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Tabela']);
    expect(screen.getByRole('table', { name: 'Tabela ligi' })).toBeTruthy();
    expect(screen.getByText('do 3 wygranych legów')).toBeTruthy();
    expect(screen.getByText('W komórce: wynik w legach.')).toBeTruthy();
    expect(screen.queryByText('Strzałka: miejsce dające awans do play-off.')).toBeNull();
    expect(screen.queryByText('awans do play-off')).toBeNull();
  });

  it('shows the Drabinka tab with the play-off list in a cup', async () => {
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
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Drabinka']);
    const items = within(screen.getByRole('tabpanel')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Mecz 1Anna vs Wolny losWolny los',
      'Mecz 2Bartek vs Celina1 : 3Rozegrany',
      'Mecz 3Anna vs Do ustaleniaCzeka na rywali',
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
    expect(crossCellText('Anna', 2)).toBe('3–1');
    expect(crossCellText('Celina', 0)).toBe('1–3');
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
    expect(running.map((item) => visibleText(item))).toEqual(['Trwa#12Filip vs DarekWróć do meczu', 'Trwa#11Anna vs EwaWróć do meczu']);
    const links = screen.getAllByRole('link', { name: 'Wróć do meczu' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#/matches/m7', '#/matches/m6']);
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

describe('TournamentScreen: live updates', () => {
  it('shows a new result from tournament_updated', async () => {
    wideScreen();
    await renderScreen();
    expect(crossCellText('Bartek', 2)).toContain('teraz');
    const fixtures = GROUP_FIXTURES.map((entry) => (entry.id === 'g-10' ? played(10, 'p2', 'p3', [1, 3]) : entry));
    socket().serverSend(updated(groupView({ eventSeq: 13, fixtures, nextFixtureId: 'g-11' })));
    expect(crossCellText('Bartek', 2)).toBe('1–3');
    expect(crossCellText('Celina', 1)).toBe('3–1');
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
