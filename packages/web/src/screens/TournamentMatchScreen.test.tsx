import type { Fixture, LegTurn, LiveMessage, MatchLeg, MatchLegs, MatchSnapshot, MatchSummary, TournamentView } from '@autoscore/schema';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fixture,
  legTurn,
  matchLeg,
  matchLegs,
  player,
  scoredTurns,
  snapshot,
  summary,
  summaryPlayer,
  tournamentView,
} from '../test/snapshots';
import { TournamentMatchScreen } from './TournamentMatchScreen';

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  readonly url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close(): void {}

  send(): void {}

  serverSend(message: LiveMessage): void {
    act(() => {
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
    });
  }
}

interface Call {
  readonly url: string;
  readonly method: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const notFound = () => json(404, { error: 'not_found', message: 'Not found' });

const MATCH_ID = 'm-f';
// Czas lokalny, żeby testy przechodziły w każdej strefie.
const STARTED_AT = new Date(2026, 10, 16, 21, 14).toISOString();
const FINISHED_AT = new Date(2026, 10, 16, 21, 52).toISOString();

const FINAL: Fixture = fixture({
  id: 'p-f',
  number: 20,
  phase: 'playoff',
  round: 1,
  bracketRound: 'final',
  legsToWin: 4,
  slots: [
    { kind: 'player', playerId: 'p1', seed: 1 },
    { kind: 'player', playerId: 'p2', seed: 2 },
  ],
  status: 'finished',
  matchId: MATCH_ID,
  result: { legs: [4, 2], winnerId: 'p1', corrected: false },
});

function cupView(fixtures: Fixture[] = [FINAL]): TournamentView {
  return tournamentView({ name: 'Puchar jesienny', format: 'cup', fixtures, nextFixtureId: null, standings: [] });
}

function finalState(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return snapshot({
    id: MATCH_ID,
    status: 'finished',
    finished: true,
    legsToWin: 4,
    startingScore: 501,
    createdAt: new Date(2026, 10, 16, 21, 10).toISOString(),
    startedAt: STARTED_AT,
    finishedAt: FINISHED_AT,
    pausedMs: 0,
    currentPlayerId: null,
    round: null,
    legIndex: 5,
    eventSeq: 200,
    players: [player('p1', 'Anna', { legsWon: 4 }), player('p2', 'Bartek', { legsWon: 2 })],
    winnerId: 'p1',
    tournament: { id: 't1', name: 'Puchar jesienny', fixtureId: 'p-f', label: 'Finał' },
    ...overrides,
  });
}

function finalSummary(): MatchSummary {
  return summary({
    matchId: MATCH_ID,
    finished: true,
    eventSeq: 200,
    players: [
      summaryPlayer('p1', {
        legsWon: 4,
        average: 49.73,
        first9Average: 58.2,
        scores100: 7,
        scores140: 1,
        scores180: 0,
        highestCheckout: 64,
        bestLegDarts: 21,
        doublesPercent: 36.36,
        doublesHit: 4,
        doubleAttempts: 11,
      }),
      summaryPlayer('p2', {
        legsWon: 2,
        average: 44.88,
        first9Average: 47.1,
        scores100: 4,
        scores140: 0,
        scores180: 0,
        highestCheckout: 40,
        bestLegDarts: 24,
        doublesPercent: 22.22,
        doublesHit: 2,
        doubleAttempts: 9,
      }),
    ],
  });
}

function interleave(first: readonly LegTurn[], second: readonly LegTurn[]): LegTurn[] {
  return Array.from({ length: Math.max(first.length, second.length) }, (_, index) => [first[index], second[index]]).flatMap((pair) =>
    pair.filter((turn): turn is LegTurn => turn !== undefined),
  );
}

// Leg 4 z makiety: Anna zaczyna i zamyka D20 w 26. rzutce, Bartek zostaje na 60.
function legFour(): MatchLeg {
  const checkout = legTurn('p1', {
    darts: [
      { segment: 0, multiplier: 0 },
      { segment: 20, multiplier: 2 },
    ],
    points: 40,
    remainingAfter: 0,
  });
  return matchLeg({
    legIndex: 3,
    starterId: 'p1',
    winnerId: 'p1',
    checkout: 40,
    dartsThrown: 26,
    players: [
      { playerId: 'p1', darts: 26, average: 57.807 },
      { playerId: 'p2', darts: 24, average: 55.125 },
    ],
    turns: interleave(
      [...scoredTurns('p1', [60, 45, 81, 100, 41, 60, 54, 20]), checkout],
      scoredTurns('p2', [41, 85, 26, 60, 100, 45, 57, 27]),
    ),
  });
}

function shortLeg(legIndex: number, winnerId: string): MatchLeg {
  return matchLeg({ legIndex, starterId: legIndex % 2 === 0 ? 'p1' : 'p2', winnerId, checkout: 40, dartsThrown: 18 });
}

function finalLegs(): MatchLegs {
  return matchLegs([shortLeg(0, 'p1'), shortLeg(1, 'p2'), shortLeg(2, 'p1'), legFour(), shortLeg(4, 'p2'), shortLeg(5, 'p1')], {
    matchId: MATCH_ID,
    finished: true,
    eventSeq: 200,
    legsToWin: 4,
  });
}

let calls: Call[];
let tournamentReply: () => Response;
let summaryReply: () => Response;
let legsReply: () => Response;

beforeEach(() => {
  calls = [];
  FakeWebSocket.instances = [];
  tournamentReply = () => json(200, cupView());
  summaryReply = () => json(200, finalSummary());
  legsReply = () => json(200, finalLegs());
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? 'GET' });
      if (url.endsWith('/summary')) {
        return Promise.resolve(summaryReply());
      }
      if (url.endsWith('/legs')) {
        return Promise.resolve(legsReply());
      }
      return Promise.resolve(url.startsWith('/api/tournaments/') ? tournamentReply() : notFound());
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function matchSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.find((entry) => entry.url.includes('/matches/'));
  if (!socket) {
    throw new Error('No match socket');
  }
  return socket;
}

function sendState(state: MatchSnapshot): void {
  matchSocket().serverSend({ type: 'state_updated', matchId: state.id, eventSeq: state.eventSeq, state });
}

async function renderPage(state: MatchSnapshot = finalState(), tournamentId = 't1'): Promise<void> {
  render(<TournamentMatchScreen tournamentId={tournamentId} matchId={state.id} />);
  sendState(state);
  await screen.findByRole('heading', { level: 1 });
  await screen.findByRole('tablist', { name: 'Legi' });
  await screen.findByRole('table', { name: 'Statystyki meczu' });
}

function statRows(): HTMLTableRowElement[] {
  const table = screen.getByRole('table', { name: 'Statystyki meczu' });
  return Array.from(table.querySelectorAll('tbody tr'));
}

function statRow(label: string): HTMLTableRowElement {
  const row = statRows().find((entry) => entry.querySelector('th')?.textContent === label);
  if (!row) {
    throw new Error(`No row ${label}`);
  }
  return row;
}

function turnRows(): HTMLTableRowElement[] {
  const panel = screen.getByRole('tabpanel');
  return Array.from(panel.querySelectorAll('tbody tr'));
}

function cellTexts(row: HTMLTableRowElement | undefined): string[] {
  return Array.from(row?.querySelectorAll('td') ?? []).map((cell) => cell.textContent ?? '');
}

function urlsOf(suffix: string): string[] {
  return calls.filter((call) => call.url.endsWith(suffix)).map((call) => call.url);
}

describe('TournamentMatchScreen: mockup final', () => {
  it('shows the label, the meta, the score and the date line', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Finał · Mecz #20' })).toBeTruthy();
    expect(screen.getByText('do 4 wygranych legów · 501')).toBeTruthy();
    expect(screen.getByText('4 : 2')).toBeTruthy();
    expect(screen.getByText('16.11.2026 · 21:14 · 38 min')).toBeTruthy();
    const winner = screen.getByText('zwycięzca');
    expect(winner.parentElement?.textContent).toBe('Annazwycięzca');
    expect(screen.queryByText(/^rozegrano/)).toBeNull();
    expect(screen.queryByText('na żywo', { exact: false })).toBeNull();
  });

  it('links back to the tournament with a 44 px target and the tournament name', async () => {
    await renderPage();
    const back = screen.getByRole('link', { name: 'Wróć do turnieju Puchar jesienny' });
    expect(back.getAttribute('href')).toBe('#/tournaments/t1');
    // Minimalny cel dotyku to znaczenie tej klasy.
    expect(back.className).toContain('min-h-11');
    expect(screen.getByRole('link', { name: 'Turniej' }).getAttribute('aria-current')).toBe('page');
  });

  it('compares the stats with the better value marked only on Anna’s side and none in the 180 row', async () => {
    await renderPage();
    const table = screen.getByRole('table', { name: 'Statystyki meczu' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Anna', 'Bartek']);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Wygrane legi',
      'Średnia (3 rzutki)',
      'First 9',
      '100+',
      '140+',
      '180',
      'Najwyższe zamknięcie',
      'Najlepszy leg',
      '% doubli',
    ]);
    const marks = within(table).getAllByText('lepszy wynik');
    expect(marks).toHaveLength(8);
    expect(marks.every((mark) => (mark.closest('td') as HTMLTableCellElement).cellIndex === 0)).toBe(true);
    expect(statRow('180').textContent).not.toContain('lepszy wynik');
    expect(cellTexts(statRow('Średnia (3 rzutki)'))).toEqual(['49,73 lepszy wynik', '44,88']);
    expect(cellTexts(statRow('Najlepszy leg'))).toEqual(['21 rzutek lepszy wynik', '24 rzutki']);
    expect(cellTexts(statRow('% doubli'))).toEqual(['36,4% (4/11) lepszy wynik', '22,2% (2/9)']);
  });

  it('shows six leg tabs with the winners and selects the last leg', async () => {
    await renderPage();
    const tabs = within(screen.getByRole('tablist', { name: 'Legi' })).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Leg 1 Anna',
      'Leg 2 Bartek',
      'Leg 3 Anna',
      'Leg 4 Anna',
      'Leg 5 Bartek',
      'Leg 6 Anna',
    ]);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false', 'false', 'false', 'true']);
    expect(tabs[5]?.getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id);
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[5]?.id);
    expect(screen.getByText('Brak zamkniętych tur.')).toBeTruthy();
  });

  it('shows the story and the turns of leg 4 after picking it', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Leg 4 Anna' }));
    expect(screen.getByText('Leg 4: zaczyna Anna, zamyka D20 w 26. rzutce (średnia lega 57,81).')).toBeTruthy();
    const panel = screen.getByRole('tabpanel');
    const table = within(panel).getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Zdobył', 'Zostało', 'Rzutki', 'Zdobył', 'Zostało', 'Anna', 'Bartek']);
    const rows = turnRows();
    expect(rows).toHaveLength(9);
    expect(rows.map((row) => cellTexts(row)[2])).toEqual(['3', '6', '9', '12', '15', '18', '21', '24', '26']);
    expect(cellTexts(rows[0])).toEqual(['60', '441', '3', '41', '460']);
    expect(cellTexts(rows[7])).toEqual(['20', '40', '24', '27', '60']);
    expect(cellTexts(rows[8])).toEqual(['zamknięcie 40 · D20', '0', '26', '', '']);
    expect(within(panel).getByText('40 · D20')).toBeTruthy();
  });

  it('moves between the leg tabs with the arrow keys', async () => {
    await renderPage();
    const last = screen.getByRole('tab', { name: 'Leg 6 Anna' });
    expect(last.tabIndex).toBe(0);
    fireEvent.keyDown(last, { key: 'ArrowRight' });
    const first = screen.getByRole('tab', { name: 'Leg 1 Anna' });
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(first);
    expect(last.tabIndex).toBe(-1);
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(last.getAttribute('aria-selected')).toBe('true');
  });

  it('is read-only: the only buttons are the leg tabs and nothing is posted', async () => {
    await renderPage();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    const buttons = Array.from(document.querySelectorAll('button'));
    expect(buttons).toHaveLength(6);
    expect(buttons.every((button) => button.getAttribute('role') === 'tab')).toBe(true);
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
    expect(urlsOf('/legs')).toEqual(['/api/matches/m-f/legs']);
    expect(urlsOf('/summary')).toEqual(['/api/matches/m-f/summary']);
  });

  it('stacks the cards below lg and keeps the turns table in its own horizontal scroll', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Leg 4 Anna' }));
    // Układ strony to znaczenie tych klas: jedna kolumna bez prefiksu, dwie dopiero od lg.
    const grid = document.querySelector('main > .grid');
    const classes = Array.from(grid?.classList ?? []);
    expect(classes).toContain('grid-cols-1');
    const columnClasses = classes.filter((name) => name.includes('grid-cols') && name !== 'grid-cols-1');
    expect(columnClasses.length).toBeGreaterThan(0);
    expect(columnClasses.every((name) => name.startsWith('lg:'))).toBe(true);
    const wrapper = within(screen.getByRole('tabpanel')).getByRole('table').parentElement;
    expect(wrapper?.className).toContain('overflow-x-auto');
  });
});

describe('TournamentMatchScreen: labels and cells', () => {
  it('shows only the group label without the fixture number suffix', async () => {
    const group = fixture({
      id: 'g-7',
      number: 7,
      status: 'finished',
      matchId: MATCH_ID,
      result: { legs: [3, 1], winnerId: 'p1', corrected: false },
    });
    tournamentReply = () => json(200, tournamentView({ format: 'group_playoff', fixtures: [group], nextFixtureId: null }));
    await renderPage(
      finalState({
        legsToWin: 3,
        players: [player('p1', 'Anna', { legsWon: 3 }), player('p2', 'Bartek', { legsWon: 1 })],
        tournament: { id: 't1', name: 'Grupa', fixtureId: 'g-7', label: 'Grupa, mecz 7' },
      }),
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Grupa, mecz 7');
    expect(screen.queryByText(/Mecz #7/)).toBeNull();
    expect(screen.getByText('do 3 wygranych legów · 501')).toBeTruthy();
  });

  it('shows a one-dart bust with the unchanged score and counts one dart', async () => {
    const bust = legTurn('p1', { darts: [{ segment: 20, multiplier: 3 }], bust: true, points: 0, remainingAfter: 441 });
    const leg = matchLeg({ turns: [...interleave(scoredTurns('p1', [60]), scoredTurns('p2', [100])), bust] });
    legsReply = () => json(200, matchLegs([leg], { matchId: MATCH_ID, eventSeq: 200 }));
    await renderPage();
    const rows = turnRows();
    expect(cellTexts(rows[1])).toEqual(['Bust', '441', '4', '', '']);
  });

  it('marks 100 or more as a heavier turn', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Leg 4 Anna' }));
    const rows = turnRows();
    // Grubość pisma niesie wyróżnienie tury 100+, więc klasa jest tu znaczeniem.
    expect(rows[3]?.querySelector('td')?.className).toContain('font-black');
    expect(rows[0]?.querySelector('td')?.className).not.toContain('font-black');
  });
});

describe('TournamentMatchScreen: running match', () => {
  const RUNNING: Fixture = { ...FINAL, status: 'in_progress', result: null };

  function runningState(eventSeq: number, legIndex: number): MatchSnapshot {
    return finalState({
      status: 'in_progress',
      finished: false,
      finishedAt: null,
      winnerId: null,
      currentPlayerId: 'p1',
      round: 1,
      legIndex,
      eventSeq,
      players: [player('p1', 'Anna', { legsWon: legIndex }), player('p2', 'Bartek', { legsWon: 0 })],
    });
  }

  function runningLegs(eventSeq: number, legs: MatchLeg[]): MatchLegs {
    return matchLegs(legs, { matchId: MATCH_ID, eventSeq, legsToWin: 4 });
  }

  it('shows the live tag without a winner and refetches legs and summary on a newer state', async () => {
    tournamentReply = () => json(200, cupView([RUNNING]));
    legsReply = () => json(200, runningLegs(10, [shortLeg(0, 'p1'), matchLeg({ legIndex: 1, turns: scoredTurns('p1', [60]) })]));
    summaryReply = () => json(200, { ...finalSummary(), eventSeq: 10, finished: false });
    await renderPage(runningState(10, 1));
    expect(screen.getByText('1 : 0')).toBeTruthy();
    expect(screen.getByText('na żywo, leg 2')).toBeTruthy();
    expect(screen.queryByText('zwycięzca')).toBeNull();
    expect(screen.queryByText(/ min$/)).toBeNull();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Leg 1 Anna', 'Leg 2 trwa']);
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Leg 2: zaczyna Anna, leg trwa.')).toBeTruthy();

    legsReply = () =>
      json(
        200,
        runningLegs(11, [
          shortLeg(0, 'p1'),
          matchLeg({ legIndex: 1, turns: interleave(scoredTurns('p1', [60]), scoredTurns('p2', [85])) }),
        ]),
      );
    summaryReply = () => json(200, { ...finalSummary(), eventSeq: 11, finished: false });
    sendState(runningState(11, 1));
    expect(await screen.findByText('85')).toBeTruthy();
    expect(urlsOf('/legs')).toHaveLength(2);
    expect(urlsOf('/summary')).toHaveLength(2);
    expect(cellTexts(turnRows()[0])).toEqual(['60', '441', '3', '85', '416']);
  });

  it('follows the last leg until a tab is picked and keeps the picked tab after that', async () => {
    tournamentReply = () => json(200, cupView([RUNNING]));
    legsReply = () => json(200, runningLegs(10, [shortLeg(0, 'p1'), matchLeg({ legIndex: 1 })]));
    await renderPage(runningState(10, 1));
    expect(screen.getByRole('tab', { name: 'Leg 2 trwa' }).getAttribute('aria-selected')).toBe('true');

    legsReply = () => json(200, runningLegs(11, [shortLeg(0, 'p1'), shortLeg(1, 'p1'), matchLeg({ legIndex: 2 })]));
    sendState(runningState(11, 2));
    expect(await screen.findByRole('tab', { name: 'Leg 3 trwa' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Leg 3 trwa' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: 'Leg 1 Anna' }));
    legsReply = () => json(200, runningLegs(12, [shortLeg(0, 'p1'), shortLeg(1, 'p1'), shortLeg(2, 'p1'), matchLeg({ legIndex: 3 })]));
    sendState(runningState(12, 3));
    expect(await screen.findByRole('tab', { name: 'Leg 4 trwa' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Leg 1 Anna' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Leg 4 trwa' }).getAttribute('aria-selected')).toBe('false');
  });
});

describe('TournamentMatchScreen: corrected and walkover results', () => {
  it('shows the corrected result in match order with popr. and the played result, and keeps the stats as played', async () => {
    const corrected = fixture({
      id: 'g-3',
      number: 3,
      legsToWin: 3,
      slots: [
        { kind: 'player', playerId: 'p1', seed: null },
        { kind: 'player', playerId: 'p2', seed: null },
      ],
      status: 'finished',
      matchId: MATCH_ID,
      result: { legs: [3, 1], winnerId: 'p1', corrected: true },
    });
    tournamentReply = () => json(200, tournamentView({ fixtures: [corrected], nextFixtureId: null }));
    summaryReply = () =>
      json(
        200,
        summary({
          matchId: MATCH_ID,
          finished: true,
          eventSeq: 200,
          players: [summaryPlayer('p2', { legsWon: 3 }), summaryPlayer('p1', { legsWon: 2 })],
        }),
      );
    await renderPage(
      finalState({
        legsToWin: 3,
        players: [player('p2', 'Bartek', { legsWon: 3 }), player('p1', 'Anna', { legsWon: 2 })],
        winnerId: 'p2',
        tournament: { id: 't1', name: 'Liga', fixtureId: 'g-3', label: 'Liga, mecz 3' },
      }),
    );
    expect(screen.getByText('1 : 3')).toBeTruthy();
    expect(screen.getByText('popr.')).toBeTruthy();
    expect(screen.getByText('wynik poprawiony')).toBeTruthy();
    expect(screen.getByText('rozegrano 3:2')).toBeTruthy();
    expect(screen.getByText('zwycięzca').parentElement?.textContent).toBe('Annazwycięzca');
    expect(cellTexts(statRow('Wygrane legi'))).toEqual(['3 lepszy wynik', '2']);
  });

  it('shows the walkover result of the abandoned match with wo and the played legs', async () => {
    const walkover = fixture({
      id: 'g-3',
      number: 3,
      status: 'walkover',
      matchId: MATCH_ID,
      result: { legs: [3, 0], winnerId: 'p1', corrected: false },
    });
    tournamentReply = () => json(200, tournamentView({ fixtures: [walkover], nextFixtureId: null }));
    await renderPage(
      finalState({
        status: 'abandoned',
        finished: false,
        finishedAt: null,
        winnerId: null,
        legsToWin: 3,
        abandonment: { playerId: 'p2', reason: null, at: FINISHED_AT },
        players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 2 })],
        tournament: { id: 't1', name: 'Liga', fixtureId: 'g-3', label: 'Liga, mecz 3' },
      }),
    );
    expect(screen.getByText('3 : 0')).toBeTruthy();
    expect(screen.getByText('wo')).toBeTruthy();
    expect(screen.getByText('walkower')).toBeTruthy();
    expect(screen.getByText('rozegrano 1:2')).toBeTruthy();
    expect(screen.queryByText('Porzucony')).toBeNull();
    expect(screen.getByText('zwycięzca').parentElement?.textContent).toBe('Annazwycięzca');
  });

  it('shows Porzucony for an abandoned match without a walkover', async () => {
    tournamentReply = () => json(200, cupView([{ ...FINAL, status: 'in_progress', result: null }]));
    await renderPage(finalState({ status: 'abandoned', finished: false, finishedAt: null, winnerId: null }));
    expect(screen.getByText('Porzucony')).toBeTruthy();
    expect(screen.queryByText('zwycięzca')).toBeNull();
  });
});

describe('TournamentMatchScreen: loading and errors', () => {
  it('shows the not found text for a match of another tournament', async () => {
    render(<TournamentMatchScreen tournamentId="t1" matchId={MATCH_ID} />);
    sendState(finalState({ tournament: { id: 't2', name: 'Inny', fixtureId: 'p-f', label: 'Finał' } }));
    expect(await screen.findByText('Nie znaleziono meczu w tym turnieju.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Wróć do turnieju' }).getAttribute('href')).toBe('#/tournaments/t1');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows the not found text when the tournament does not exist', async () => {
    tournamentReply = notFound;
    render(<TournamentMatchScreen tournamentId="t 0" matchId={MATCH_ID} />);
    sendState(finalState());
    expect(await screen.findByText('Nie znaleziono meczu w tym turnieju.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Wróć do turnieju' }).getAttribute('href')).toBe('#/tournaments/t%200');
  });

  it('shows Ładowanie… until the match state arrives', async () => {
    render(<TournamentMatchScreen tournamentId="t1" matchId={MATCH_ID} />);
    expect(screen.getByText('Ładowanie…')).toBeTruthy();
    expect(urlsOf('/legs')).toEqual([]);
    sendState(finalState());
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('shows only the tournament error when the tournament fails to load', async () => {
    tournamentReply = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    render(<TournamentMatchScreen tournamentId="t1" matchId={MATCH_ID} />);
    sendState(finalState());
    expect(await screen.findByText('Nie udało się pobrać turnieju')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows the summary and legs errors inside the cards', async () => {
    summaryReply = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    legsReply = () => json(500, { error: 'internal_error', message: 'Internal server error' });
    render(<TournamentMatchScreen tournamentId="t1" matchId={MATCH_ID} />);
    sendState(finalState());
    expect(await screen.findByText('Nie udało się pobrać podsumowania')).toBeTruthy();
    expect(await screen.findByText('Nie udało się pobrać przebiegu legów')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Statystyki meczu' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Przebieg lega' })).toBeTruthy();
  });

  it('shows the lost connection while the match socket is closed and the match runs', async () => {
    tournamentReply = () => json(200, cupView([{ ...FINAL, status: 'in_progress', result: null }]));
    await renderPage(finalState({ status: 'in_progress', finished: false, finishedAt: null, winnerId: null }));
    act(() => {
      matchSocket().dispatchEvent(new CloseEvent('close', { code: 1006 }));
    });
    expect(screen.getByText('Brak połączenia z serwerem. Łączę ponownie…')).toBeTruthy();
  });
});
