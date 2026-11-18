import type { Fixture, LiveMessage, MatchSnapshot, TournamentLiveMessage, TournamentView } from '@autoscore/schema';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computedView, legTurn, player, snapshot, summary, summaryPlayer, tournamentConfig, type ResultLegs } from '../test/snapshots';
import { TournamentTvScreen } from './TournamentTvScreen';

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

  serverSend(message: TournamentLiveMessage | LiveMessage): void {
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

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const NETWORK_PAGE = { hostname: 'autoscore.lan', origin: 'http://autoscore.lan', pathname: '/' };
const LOCAL_PAGE = { hostname: 'localhost', origin: 'http://localhost:5173', pathname: '/' };

// Puchar czterech graczy z meczem o 3. miejsce: Anna (p1), Bartek (p2), Celina (p3) i Darek (p4).
const CUP = tournamentConfig('cup', 4, { name: 'Puchar jesienny', thirdPlaceMatch: true });
const SEMIFINAL_LIVE: ResultLegs = { 'p-sf-1': [3, 1], 'p-sf-2': [1, 1] };
const THIRD_PLACE_LIVE: ResultLegs = { 'p-sf-1': [3, 1], 'p-sf-2': [3, 1], 'p-3rd': [0, 0] };
const FINAL_NEXT: ResultLegs = { 'p-sf-1': [3, 1], 'p-sf-2': [3, 1], 'p-3rd': [2, 0] };

function cupView(results: ResultLegs, overrides: Partial<TournamentView> = {}): TournamentView {
  return computedView(CUP, results, { name: 'Puchar jesienny', ...overrides });
}

function liveFixture(view: TournamentView): Fixture {
  const found = view.fixtures.find((entry) => entry.id === view.liveFixtureId);
  if (!found?.matchId) {
    throw new Error('No live fixture');
  }
  return found;
}

function slotIds(entry: Fixture): [string, string] {
  const [first, second] = entry.slots.map((slot) => (slot.kind === 'player' ? slot.playerId : ''));
  return [first ?? '', second ?? ''];
}

// Pierwszy gracz meczu rzuca drugą rzutkę: T20 i zostało 81, drugi ma 96. Ostatnie tury to 85 i 100.
function liveState(view: TournamentView, overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  const entry = liveFixture(view);
  const [first, second] = slotIds(entry);
  const name = (id: string) => view.players.find((candidate) => candidate.id === id)?.name ?? id;
  return snapshot({
    id: entry.matchId ?? '',
    legsToWin: entry.legsToWin,
    eventSeq: 40,
    legIndex: 2,
    currentPlayerId: first,
    currentDarts: [{ segment: 20, multiplier: 3 }],
    legTurns: [
      legTurn(first, { turnIndex: 0, points: 85, remainingAfter: 141 }),
      legTurn(second, { turnIndex: 0, points: 100, remainingAfter: 96 }),
    ],
    players: [player(first, name(first), { legsWon: 1, remaining: 81 }), player(second, name(second), { legsWon: 1, remaining: 96 })],
    ...overrides,
  });
}

let tournamentReply: () => Response;
let urls: string[];

beforeEach(() => {
  urls = [];
  FakeWebSocket.instances = [];
  tournamentReply = () => json(200, cupView(SEMIFINAL_LIVE));
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      urls.push(url);
      if (url.startsWith('/api/tournaments/')) {
        return Promise.resolve(tournamentReply());
      }
      const summaryUrl = /^\/api\/matches\/([^/]+)\/summary$/.exec(url);
      // Średnie Bartka i Celiny z półfinału 2.
      if (summaryUrl?.[1]) {
        return Promise.resolve(
          json(
            200,
            summary({
              matchId: decodeURIComponent(summaryUrl[1]),
              eventSeq: 40,
              players: [summaryPlayer('p2', { average: 41.72 }), summaryPlayer('p3', { average: 44.95 })],
            }),
          ),
        );
      }
      return Promise.resolve(json(404, { error: 'not_found', message: 'Match not found' }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function tournamentSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.find((entry) => entry.url.includes('/tournaments/'));
  if (!socket) {
    throw new Error('No tournament socket');
  }
  return socket;
}

function matchSockets(): FakeWebSocket[] {
  return FakeWebSocket.instances.filter((entry) => entry.url.includes('/matches/'));
}

function sendState(state: MatchSnapshot): void {
  const socket = matchSockets().find((entry) => entry.url.includes(`/matches/${encodeURIComponent(state.id)}/live`));
  if (!socket) {
    throw new Error(`No socket for ${state.id}`);
  }
  socket.serverSend({ type: 'state_updated', matchId: state.id, eventSeq: state.eventSeq, state });
}

function sendView(view: TournamentView): void {
  tournamentSocket().serverSend({ type: 'tournament_updated', tournamentId: view.id, eventSeq: view.eventSeq, tournament: view });
}

function header(): HTMLElement {
  const found = document.querySelector('header');
  if (!(found instanceof HTMLElement)) {
    throw new Error('No header');
  }
  return found;
}

async function renderTv(page = NETWORK_PAGE): Promise<void> {
  render(<TournamentTvScreen tournamentId="t1" page={page} />);
  await screen.findByRole('heading', { level: 1, name: 'Puchar jesienny' });
}

async function renderLive(state: MatchSnapshot = liveState(cupView(SEMIFINAL_LIVE))): Promise<HTMLElement> {
  await renderTv();
  sendState(state);
  return screen.getByRole('region', { name: 'Trwający mecz' });
}

describe('TournamentTvScreen', () => {
  it('shows the live semi-final with both players, the thrower, the current turn and the checkout', async () => {
    const live = await renderLive();

    expect(within(header()).getByText('Półfinał 2 · do 3 wygranych legów')).toBeTruthy();
    expect(within(header()).getByText('na żywo')).toBeTruthy();
    expect(within(header()).getByRole('link', { name: 'Wróć do turnieju' }).getAttribute('href')).toBe('#/tournaments/t1');

    const bartek = within(live).getByRole('group', { name: 'Bartek' });
    const celina = within(live).getByRole('group', { name: 'Celina' });
    expect(within(live).getAllByText('Rzuca')).toHaveLength(1);
    expect(within(bartek).getByText('Rzuca')).toBeTruthy();
    expect(within(celina).queryByText('Rzuca')).toBeNull();

    expect(within(bartek).getByText('81')).toBeTruthy();
    expect(within(celina).getByText('96')).toBeTruthy();
    expect(within(bartek).getByText('Legi')).toBeTruthy();
    expect(within(bartek).getByText('1')).toBeTruthy();
    expect(await within(bartek).findByText('średnia meczu 41,72 · ostatnia tura 85')).toBeTruthy();
    expect(within(celina).getByText('średnia meczu 44,95 · ostatnia tura 100')).toBeTruthy();

    expect(within(live).getByText('Ta tura')).toBeTruthy();
    expect(within(live).getByText('T20')).toBeTruthy();
    expect(within(live).getByText('60')).toBeTruthy();
    const checkout = within(live).getByRole('group', { name: 'Zamknięcie' });
    expect(within(checkout).getByText('T15 · D18')).toBeTruthy();
  });

  it('keeps the cards in slot order whoever throws', async () => {
    const view = cupView(SEMIFINAL_LIVE);
    const live = await renderLive(liveState(view, { currentPlayerId: 'p3', currentDarts: [] }));
    const [first, second] = within(live).getAllByRole('group', { name: /Bartek|Celina/ });
    expect(first?.getAttribute('aria-label')).toBe('Bartek');
    expect(second?.getAttribute('aria-label')).toBe('Celina');
    expect(within(second as HTMLElement).getByText('Rzuca')).toBeTruthy();
  });

  it('shows the play-off list with the live row, the next match and the QR code beside the live match', async () => {
    await renderLive();
    const bracket = screen.getByRole('region', { name: 'Drabinka' });
    expect(within(bracket).getByText('Anna – Darek')).toBeTruthy();
    expect(within(bracket).getByText('3 : 1')).toBeTruthy();
    expect(within(bracket).getByText('na żywo')).toBeTruthy();
    const next = screen.getByRole('region', { name: 'Następny mecz' });
    expect(within(next).getByText('Mecz o 3. miejsce: Darek – Przegrany tego meczu')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Kod QR publicznego linku' })).toBeTruthy();
    expect(screen.getByText('Śledź turniej na telefonie')).toBeTruthy();
  });

  it('moves to the next live match and to the idle layout without a click', async () => {
    await renderLive();
    const [first] = matchSockets();
    expect(first?.url).toContain('/matches/m-p-sf-2/live');

    sendView(cupView(THIRD_PLACE_LIVE));
    expect(first?.closed).toBe(true);
    const sockets = matchSockets();
    expect(sockets).toHaveLength(2);
    expect(sockets[1]?.url).toContain('/matches/m-p-3rd/live');
    expect(sockets[1]?.closed).toBe(false);
    expect(within(header()).getByText('Mecz o 3. miejsce · do 2 wygranych legów')).toBeTruthy();

    sendState(liveState(cupView(THIRD_PLACE_LIVE)));
    expect(screen.getByText('Rzuca')).toBeTruthy();

    sendView(cupView(FINAL_NEXT));
    expect(sockets[1]?.closed).toBe(true);
    expect(screen.queryByText('Rzuca')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Trwający mecz' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Następny mecz' })).toBeTruthy();
  });

  it('shows the next match and the league table with no live match', async () => {
    const league = tournamentConfig('league', 3, { name: 'Liga czwartkowa' });
    tournamentReply = () => json(200, computedView(league, {}, { name: 'Liga czwartkowa' }));
    render(<TournamentTvScreen tournamentId="t1" page={NETWORK_PAGE} />);
    await screen.findByRole('heading', { level: 1, name: 'Liga czwartkowa' });

    expect(within(header()).getByText('Liga · 0 z 3 meczów')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Trwający mecz' })).toBeNull();
    const next = screen.getByRole('region', { name: 'Następny mecz' });
    expect(within(next).getByText(/^Liga, mecz 1: /)).toBeTruthy();
    expect(within(next).getByText('do 3 wygranych legów')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Tabela ligi' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Drabinka' })).toBeNull();
  });

  it('shows the bracket of a cup with no live match', async () => {
    tournamentReply = () => json(200, cupView({ 'p-sf-1': [3, 1] }));
    await renderTv();
    expect(within(header()).getByText('Play-off · 1 z 4 meczów')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Drabinka' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Tabela ligi' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Następny mecz' })).getByText('Półfinał 2: Bartek – Celina')).toBeTruthy();
  });

  it('shows the finished tournament with a trophy instead of the next match', async () => {
    tournamentReply = () => json(200, cupView({ 'p-sf-1': [3, 1], 'p-sf-2': [3, 1], 'p-3rd': [2, 0], 'p-f': [4, 2] }));
    await renderTv();
    expect(screen.getAllByText('Turniej zakończony').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { level: 2, name: 'Następny mecz' })).toBeNull();
  });

  it('shows the QR code only with sharing on, on a network address', async () => {
    const { unmount } = render(<TournamentTvScreen tournamentId="t1" page={NETWORK_PAGE} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('img', { name: 'Kod QR publicznego linku' })).toBeTruthy();
    unmount();

    tournamentReply = () => json(200, cupView(SEMIFINAL_LIVE, { sharing: false }));
    const off = render(<TournamentTvScreen tournamentId="t1" page={NETWORK_PAGE} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('img', { name: 'Kod QR publicznego linku' })).toBeNull();
    off.unmount();

    tournamentReply = () => json(200, cupView(SEMIFINAL_LIVE));
    render(<TournamentTvScreen tournamentId="t1" page={LOCAL_PAGE} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('img', { name: 'Kod QR publicznego linku' })).toBeNull();
    expect(screen.queryByText('Śledź turniej na telefonie')).toBeNull();
  });

  it('hides the QR code of an archived tournament', async () => {
    tournamentReply = () => json(200, cupView({ 'p-sf-1': [3, 1] }, { archivedAt: '2026-11-13T10:00:00.000Z' }));
    await renderTv();
    expect(screen.queryByRole('img', { name: 'Kod QR publicznego linku' })).toBeNull();
  });

  it('has no button in the live and in the idle layout', async () => {
    await renderLive();
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    sendView(cupView(FINAL_NEXT));
    expect(screen.getByRole('heading', { level: 2, name: 'Następny mecz' })).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows an abandoned match without the live pill and without a thrower', async () => {
    const live = await renderLive(liveState(cupView(SEMIFINAL_LIVE), { status: 'abandoned' }));
    expect(within(header()).getByText('Porzucony')).toBeTruthy();
    expect(within(header()).queryByText('na żywo')).toBeNull();
    expect(screen.queryByText('Rzuca')).toBeNull();
    expect(within(within(live).getByRole('group', { name: 'Zamknięcie' })).getByText('—')).toBeTruthy();
  });

  it('shows a bust as the last turn', async () => {
    const view = cupView(SEMIFINAL_LIVE);
    const state = liveState(view);
    const [, celinaTurn] = state.legTurns;
    await renderLive({
      ...state,
      legTurns: [state.legTurns[0] ?? legTurn('p2'), { ...(celinaTurn ?? legTurn('p3')), bust: true, points: 0, remainingAfter: 196 }],
    });
    expect(await screen.findByText('średnia meczu 44,95 · ostatnia tura bust')).toBeTruthy();
  });

  it('shows no value without a closed turn and before the summary', async () => {
    const live = await renderLive(liveState(cupView(SEMIFINAL_LIVE), { legTurns: [] }));
    expect(within(live).getAllByText('średnia meczu — · ostatnia tura —')).toHaveLength(2);
  });

  it('shows the loading text in the live panel before the first snapshot', async () => {
    await renderTv();
    const live = screen.getByRole('region', { name: 'Trwający mecz' });
    expect(within(live).getByText('Ładowanie…')).toBeTruthy();
    expect(within(header()).queryByText('na żywo')).toBeNull();
  });

  it('shows the connection notice when the match channel closes', async () => {
    await renderLive();
    matchSockets()[0]?.serverClose(1006);
    expect(screen.getByText('Brak połączenia z serwerem. Łączę ponownie…')).toBeTruthy();
  });

  it('shows the connection notice when the tournament channel closes', async () => {
    await renderTv();
    tournamentSocket().serverClose(1006);
    expect(screen.getByText('Brak połączenia z serwerem. Łączę ponownie…')).toBeTruthy();
  });

  it('shows the not found state with a link to the tournaments', async () => {
    tournamentReply = () => json(404, { error: 'not_found', message: 'Tournament not found' });
    render(<TournamentTvScreen tournamentId="t1" page={NETWORK_PAGE} />);
    expect(await screen.findByText('Nie znaleziono turnieju.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Wróć do turniejów' }).getAttribute('href')).toBe('#/tournaments');
  });

  it('shows the load error', async () => {
    tournamentReply = () => json(500, { error: 'internal', message: 'Boom' });
    render(<TournamentTvScreen tournamentId="t1" page={NETWORK_PAGE} />);
    expect(await screen.findByText('Nie udało się pobrać turnieju')).toBeTruthy();
  });

  it('fetches the summary of the live match', async () => {
    await renderLive();
    await screen.findByText('średnia meczu 41,72 · ostatnia tura 85');
    expect(urls).toContain('/api/matches/m-p-sf-2/summary');
  });
});
