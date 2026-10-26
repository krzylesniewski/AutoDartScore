import { HitEvent, type LiveMessage, type MatchSnapshot } from '@autoscore/schema';
import { LiveAuthMessage } from '@autoscore/schema';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { casual, checkoutHistory, checkoutPractice, checkoutSession, player, snapshot, summary, summaryPlayer } from '../test/snapshots';
import { ACHIEVEMENT_DURATION_MS } from '../api/use-match';
import { GameScreen } from './GameScreen';

const MATCH_ID = 'm_42';

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  closed = false;
  sent: string[] = [];

  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  serverOpen(): void {
    act(() => {
      this.dispatchEvent(new Event('open'));
    });
  }

  serverSend(message: LiveMessage): void {
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

// jsdom nie implementuje play(), pause() ani load(), więc każdy test dostaje atrapę Audio.
class FakeAudio {
  static created: string[] = [];
  static played: string[] = [];
  static loaded: string[] = [];
  static playResult: () => Promise<void> = () => Promise.resolve();
  readonly src: string;
  currentTime = 0;
  preload = '';

  constructor(src: string) {
    this.src = src;
    FakeAudio.created.push(src);
  }

  play(): Promise<void> {
    FakeAudio.played.push(this.src);
    return FakeAudio.playResult();
  }

  pause(): void {}

  load(): void {
    FakeAudio.loaded.push(this.src);
  }

  addEventListener(): void {}
}

interface Call {
  readonly url: string;
  readonly body: unknown;
}

let calls: Call[];
let respond: (call: Call) => Promise<Response>;
// GET .../summary idzie osobno, żeby asercje na calls dotyczyły tylko komend.
let summaryCalls: string[];
let respondSummary: (url: string) => Promise<Response>;
// GET /players/:id/frequent-hits też osobno, z tego samego powodu.
let frequentCalls: string[];
let respondFrequent: (playerId: string) => Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const initial = snapshot({
  id: MATCH_ID,
  eventSeq: 4,
  currentPlayerId: 'p2',
  players: [player('p1', 'Anna', { remaining: 501, legsWon: 0 }), player('p2', 'Bartek', { remaining: 437, legsWon: 0 })],
});

function throwResult(call: Call, state: MatchSnapshot) {
  const hit = HitEvent.parse(call.body);
  return { throw: { ...hit, id: `t_${hit.sequence}`, receivedAt: hit.detectedAt }, events: [], state };
}

function socket(): FakeWebSocket {
  const last = FakeWebSocket.instances.at(-1);
  if (!last) {
    throw new Error('no socket');
  }
  return last;
}

function connect(state: MatchSnapshot = initial): FakeWebSocket {
  render(<GameScreen matchId={MATCH_ID} />);
  const ws = socket();
  ws.serverOpen();
  ws.serverSend({ type: 'state_updated', matchId: MATCH_ID, eventSeq: state.eventSeq, state });
  return ws;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function tap(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  calls = [];
  summaryCalls = [];
  frequentCalls = [];
  respond = async (call) => json(201, throwResult(call, initial));
  respondSummary = async () => json(200, summary({ matchId: MATCH_ID, eventSeq: initial.eventSeq }));
  respondFrequent = async (playerId) => json(200, { playerId, hits: [] });
  FakeAudio.created = [];
  FakeAudio.played = [];
  FakeAudio.loaded = [];
  FakeAudio.playResult = () => Promise.resolve();
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.endsWith('/summary')) {
        summaryCalls.push(url);
        return respondSummary(url);
      }
      const frequent = /\/players\/([^/]+)\/frequent-hits$/.exec(url);
      if (frequent) {
        const playerId = decodeURIComponent(frequent[1] ?? '');
        frequentCalls.push(playerId);
        return respondFrequent(playerId);
      }
      const call = { url, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined };
      calls.push(call);
      return respond(call);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GameScreen', () => {
  it('opens the live socket through the proxy', () => {
    render(<GameScreen matchId={MATCH_ID} />);
    expect(socket().url).toBe(`ws://${location.host}/api/matches/${MATCH_ID}/live`);
  });

  it('renders names and each remaining score once from the first state_updated', () => {
    connect({ ...initial, currentDarts: [{ segment: 20, multiplier: 3 }] });
    const scoreboard = within(screen.getByRole('region', { name: 'Wyniki' }));
    expect(scoreboard.getByText('Anna')).toBeTruthy();
    expect(scoreboard.getByText('Bartek')).toBeTruthy();
    expect(scoreboard.getAllByText('501')).toHaveLength(1);
    expect(screen.getAllByText('437')).toHaveLength(1);
  });

  it('posts a keypad tap as a HitEvent', async () => {
    connect();
    tap('T');
    tap('20');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    const [call] = calls;
    expect(call?.url).toBe(`/api/matches/${MATCH_ID}/throws`);
    const parsed = HitEvent.safeParse(call?.body);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ matchId: MATCH_ID, source: 'keypad', segment: 20, multiplier: 3, confidence: 1 });
  });

  it('sends two quick taps one after another in tap order', async () => {
    const pending: (() => void)[] = [];
    respond = (call) => new Promise((resolve) => pending.push(() => resolve(json(201, throwResult(call, initial)))));
    connect();
    tap('20');
    tap('5');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect((screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement).disabled).toBe(true);
    pending.shift()?.();
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    pending.shift()?.();

    const hits = calls.map((call) => HitEvent.parse(call.body));
    expect(hits.map((hit) => hit.segment)).toEqual([20, 5]);
    expect(hits.map((hit) => hit.sequence)).toEqual([0, 1]);
    expect(hits[0]?.eventId).not.toBe(hits[1]?.eventId);
    await vi.waitFor(() => expect((screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('posts Cofnij to the undo endpoint', async () => {
    respond = async () => json(200, { undoneThrowId: 't1', state: { ...initial, eventSeq: 5 } });
    connect();
    tap('Cofnij');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: `/api/matches/${MATCH_ID}/undo`, body: undefined });
  });

  it('shows Nie ma czego cofnąć on 409 nothing_to_undo', async () => {
    respond = async () => json(409, { error: 'nothing_to_undo', message: 'Match has no throw to undo' });
    connect();
    tap('Cofnij');
    expect(await screen.findByText('Nie ma czego cofnąć')).toBeTruthy();
  });

  it('shows a failed throw', async () => {
    respond = async () => json(409, { error: 'match_finished', message: 'Match is finished' });
    connect();
    tap('Miss');
    expect(await screen.findByText('Nie udało się wysłać rzutki')).toBeTruthy();
  });

  it('shows a bust banner for 2500 ms', () => {
    vi.useFakeTimers();
    const ws = connect();
    const darts = [{ segment: 20, multiplier: 3 }] as const;
    ws.serverSend({ type: 'bust', matchId: MATCH_ID, eventSeq: 5, playerId: 'p2', legIndex: 0, turnIndex: 3, darts: [...darts], remaining: 40 });
    const status = screen.getByRole('status');
    expect(within(status).getByText('Bust')).toBeTruthy();
    expect(within(status).getByText('Bartek')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2499);
    });
    expect(within(status).queryByText('Bust')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(within(status).queryByText('Bust')).toBeNull();
  });

  it('ignores a state_updated with a lower eventSeq', () => {
    const ws = connect();
    const older = { ...initial, eventSeq: 3, players: [player('p1', 'Anna', { remaining: 333, legsWon: 0 }), player('p2', 'Bartek', { remaining: 437, legsWon: 0 })] };
    ws.serverSend({ type: 'state_updated', matchId: MATCH_ID, eventSeq: 3, state: older });
    expect(screen.queryByText('333')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Wyniki' })).getByText('501')).toBeTruthy();
  });

  it('shows Nie znaleziono gry on close code 4404 and stops', () => {
    vi.useFakeTimers();
    render(<GameScreen matchId={MATCH_ID} />);
    socket().serverClose(4404);
    expect(screen.getByText('Nie znaleziono gry')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nowa gra' }).getAttribute('href')).toBe('#/');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('reconnects after a dropped connection', () => {
    vi.useFakeTimers();
    const ws = connect();
    ws.serverClose(1006);
    expect(screen.getByText('Brak połączenia z serwerem. Łączę ponownie…')).toBeTruthy();
    expect((screen.getByRole('button', { name: '20' }) as HTMLButtonElement).disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('pins the connection notice and the keypad in one bottom dock', () => {
    vi.useFakeTimers();
    const ws = connect();
    ws.serverClose(1006);
    const dock = screen.getByRole('region', { name: 'Klawiatura rzutek' }).parentElement;
    expect(dock?.contains(screen.getByText('Brak połączenia z serwerem. Łączę ponownie…'))).toBe(true);
    expect(dock?.className.split(' ')).toEqual(expect.arrayContaining(['sticky', 'bottom-0', 'lg:contents']));
  });

  it('shows the bust banner outside the dock at the top of the screen', () => {
    vi.useFakeTimers();
    const ws = connect();
    ws.serverSend({ type: 'bust', matchId: MATCH_ID, eventSeq: 5, playerId: 'p2', legIndex: 0, turnIndex: 3, darts: [{ segment: 20, multiplier: 3 }], remaining: 40 });
    const status = screen.getByRole('status');
    const dock = screen.getByRole('region', { name: 'Klawiatura rzutek' }).parentElement;
    expect(dock?.contains(status)).toBe(false);
    expect(status.className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'top-0']));
  });

  it('pushes the dock to the bottom when the content is short', () => {
    connect();
    const dock = screen.getByRole('region', { name: 'Klawiatura rzutek' }).parentElement;
    expect(dock?.className.split(' ')).toEqual(expect.arrayContaining(['mt-auto', 'sticky', 'bottom-0', 'lg:contents']));
  });

  it('overlays the notices from lg instead of moving them above the turn', () => {
    vi.useFakeTimers();
    const ws = connect();
    ws.serverClose(1006);
    const notices = screen.getByText('Brak połączenia z serwerem. Łączę ponownie…').parentElement;
    expect(notices?.className.split(' ')).toContain('lg:absolute');
    expect(notices?.className.split(' ')).not.toContain('lg:order-first');
  });

  it('closes the socket on unmount and never reconnects', () => {
    vi.useFakeTimers();
    const { unmount } = render(<GameScreen matchId={MATCH_ID} />);
    const ws = socket();
    unmount();
    expect(ws.closed).toBe(true);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('shows the last turn dimmed after it closes', () => {
    const ws = connect();
    const darts = [
      { segment: 20, multiplier: 3 },
      { segment: 20, multiplier: 3 },
      { segment: 20, multiplier: 3 },
    ] as const;
    ws.serverSend({ type: 'turn_completed', matchId: MATCH_ID, eventSeq: 7, playerId: 'p2', legIndex: 0, turnIndex: 1, darts: [...darts], total: 180, remaining: 257 });
    ws.serverSend({
      type: 'state_updated',
      matchId: MATCH_ID,
      eventSeq: 7,
      state: { ...initial, eventSeq: 7, currentPlayerId: 'p1', players: [player('p1', 'Anna', { remaining: 501, legsWon: 0 }), player('p2', 'Bartek', { remaining: 257, legsWon: 0 })] },
    });
    expect(screen.getAllByText('T20')).toHaveLength(3);
    expect(screen.getByText('180')).toBeTruthy();
  });

  it('shows the result once the match is over', () => {
    connect({
      ...initial,
      finished: true,
      status: 'finished',
      currentPlayerId: null,
      winnerId: 'p2',
      players: [player('p1', 'Anna', { remaining: 501, legsWon: 1 }), player('p2', 'Bartek', { remaining: 0, legsWon: 2 })],
    });
    expect(screen.getByText('Mecz zakończony')).toBeTruthy();
    expect(screen.getByText('Bartek wygrywa')).toBeTruthy();
    expect(screen.getByText('2 : 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '20' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Klawiatura rzutek' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Porzuć mecz' })).toBeNull();
    expect(screen.getByText('Mecz zakończony').closest('.sticky')).toBeNull();
  });

  it('brings the game screen back after Cofnij on the match end view', async () => {
    respond = async () => json(200, { undoneThrowId: 't9', state: { ...initial, eventSeq: 5 } });
    connect({
      ...initial,
      finished: true,
      status: 'finished',
      currentPlayerId: null,
      winnerId: 'p2',
      players: [player('p1', 'Anna', { remaining: 501, legsWon: 1 }), player('p2', 'Bartek', { remaining: 0, legsWon: 2 })],
    });
    tap('Cofnij');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: `/api/matches/${MATCH_ID}/undo`, body: undefined });
    expect(await screen.findByRole('region', { name: 'Klawiatura rzutek' })).toBeTruthy();
    expect(screen.queryByText('Mecz zakończony')).toBeNull();
  });

  it('keeps the summary panel without Rewanż in a finished casual game', () => {
    connect(
      casual(['Anna', 'Bartek', 'Celina'], {
        id: MATCH_ID,
        eventSeq: 4,
        finished: true,
        currentPlayerId: null,
        placements: [
          { playerId: 'p2', place: 1 },
          { playerId: 'p1', place: 2 },
          { playerId: 'p3', place: 3 },
        ],
      }),
    );
    expect(screen.getByText('Koniec meczu')).toBeTruthy();
    expect(screen.getByText('Koniec meczu').closest('.sticky')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rewanż' })).toBeNull();
  });

  it('keeps the summary panel without Rewanż in a finished Solo 501', () => {
    connect(
      snapshot({
        id: MATCH_ID,
        type: 'practice',
        practiceMode: 'solo_501',
        legsToWin: null,
        eventSeq: 4,
        finished: true,
        currentPlayerId: null,
        winnerId: 'p1',
        players: [player('p1', 'Anna', { remaining: 0 })],
      }),
    );
    expect(screen.getByText('Koniec meczu')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rewanż' })).toBeNull();
  });
});

describe('keyboard shortcuts and checkout entry', () => {
  // Bartkowi zostaje 40, więc podpowiedź to D20.
  const onForty: MatchSnapshot = { ...initial, players: [player('p1', 'Anna', { remaining: 501, legsWon: 0 }), player('p2', 'Bartek', { remaining: 40, legsWon: 0 })] };

  function posted() {
    return calls.map((call) => {
      const { segment, multiplier } = HitEvent.parse(call.body);
      return { url: call.url, segment, multiplier };
    });
  }

  it('posts the first route dart on Enter', async () => {
    connect(onForty);
    fireEvent.keyDown(window, { key: 'Enter' });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await flush();
    expect(posted()).toEqual([{ url: `/api/matches/${MATCH_ID}/throws`, segment: 20, multiplier: 2 }]);
    expect(HitEvent.parse(calls[0]?.body)).toMatchObject({ matchId: MATCH_ID, source: 'keypad', confidence: 1 });
  });

  it('posts the first route dart on a click on the checkout panel', async () => {
    connect(onForty);
    fireEvent.click(screen.getByRole('button', { name: /Zamknięcie/ }));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await flush();
    expect(posted()).toEqual([{ url: `/api/matches/${MATCH_ID}/throws`, segment: 20, multiplier: 2 }]);
  });

  it('posts no second stale dart while the first is in flight', async () => {
    const pending: (() => void)[] = [];
    respond = (call) => new Promise((resolve) => pending.push(() => resolve(json(201, throwResult(call, onForty)))));
    connect(onForty);
    fireEvent.click(screen.getByRole('button', { name: /Zamknięcie/ }));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /Zamknięcie/ }));
    fireEvent.keyDown(window, { key: 'Enter' });
    pending.shift()?.();
    await flush();
    await flush();
    expect(calls).toHaveLength(1);
  });

  it('posts Backspace to the undo endpoint', async () => {
    respond = async () => json(200, { undoneThrowId: 't1', state: { ...initial, eventSeq: 5 } });
    connect();
    fireEvent.keyDown(window, { key: 'Backspace' });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: `/api/matches/${MATCH_ID}/undo`, body: undefined });
  });

  it('posts a Space as a Miss', async () => {
    connect();
    fireEvent.keyDown(window, { key: ' ' });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(posted()).toEqual([{ url: `/api/matches/${MATCH_ID}/throws`, segment: 0, multiplier: 0 }]);
  });

  it('posts nothing for keys typed in the abandon dialog', async () => {
    connect({ ...onForty, legIndex: 1 });
    tap('Porzuć mecz');
    const reason = within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Powód (opcjonalnie)' });
    reason.focus();
    fireEvent.change(reason, { target: { value: 'koniec prądu' } });
    for (const key of [' ', 'b', '3', 'Enter', 'Backspace']) {
      fireEvent.keyDown(reason, { key });
    }
    fireEvent.keyDown(window, { key: ' ' });
    await flush();
    expect(calls).toEqual([]);
  });
});

describe('Reszta Miss', () => {
  // Odpowiedź jak z serwera: rzutka dopisana do tury, a po trzeciej tura przechodzi na drugiego gracza.
  function advancing(start: MatchSnapshot): (call: Call) => Promise<Response> {
    let current = start;
    return async (call) => {
      const hit = HitEvent.parse(call.body);
      const darts = [...current.currentDarts, { segment: hit.segment, multiplier: hit.multiplier }];
      current =
        darts.length === 3
          ? { ...current, eventSeq: current.eventSeq + 1, currentDarts: [], currentPlayerId: 'p1' }
          : { ...current, eventSeq: current.eventSeq + 1, currentDarts: darts };
      return json(201, throwResult(call, current));
    };
  }

  function misses() {
    return calls.map((call) => HitEvent.parse(call.body));
  }

  it.each([
    [0, 3],
    [1, 2],
    [2, 1],
  ])('posts the rest of the turn as misses with %i darts thrown', async (thrown, expected) => {
    const start: MatchSnapshot = { ...initial, currentDarts: Array.from({ length: thrown }, () => ({ segment: 20, multiplier: 1 }) as const) };
    respond = advancing(start);
    connect(start);
    tap('Reszta Miss');
    await vi.waitFor(() => expect(calls).toHaveLength(expected));
    await flush();
    expect(calls).toHaveLength(expected);
    expect(calls.every((call) => call.url === `/api/matches/${MATCH_ID}/throws`)).toBe(true);
    expect(misses().map(({ segment, multiplier }) => ({ segment, multiplier }))).toEqual(Array.from({ length: expected }, () => ({ segment: 0, multiplier: 0 })));
    expect(new Set(misses().map((hit) => hit.eventId)).size).toBe(expected);
    expect(misses().map((hit) => hit.sequence)).toEqual(Array.from({ length: expected }, (_, index) => index));
  });

  it('sends the next miss only after the previous response', async () => {
    const next = advancing(initial);
    const pending: (() => void)[] = [];
    respond = (call) => new Promise((resolve) => pending.push(() => resolve(next(call))));
    connect();
    tap('Reszta Miss');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await flush();
    expect(calls).toHaveLength(1);
    pending.shift()?.();
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    await flush();
    expect(calls).toHaveLength(2);
    pending.shift()?.();
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    pending.shift()?.();
    await flush();
    expect(calls).toHaveLength(3);
  });

  it('stops at the first failed miss', async () => {
    respond = async () => json(409, { error: 'match_finished', message: 'Match is finished' });
    connect();
    tap('Reszta Miss');
    expect(await screen.findByText('Nie udało się wysłać rzutki')).toBeTruthy();
    await flush();
    expect(calls).toHaveLength(1);
  });

  it('stops when a response shows another thrower', async () => {
    respond = async (call) => json(201, throwResult(call, { ...initial, eventSeq: 5, currentDarts: [], currentPlayerId: 'p1' }));
    connect();
    tap('Reszta Miss');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await flush();
    await flush();
    expect(calls).toHaveLength(1);
  });

  it('stops when a response shows the same turn without the miss', async () => {
    connect();
    tap('Reszta Miss');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await flush();
    await flush();
    expect(calls).toHaveLength(1);
  });

  it('is disabled and posts nothing while the connection is not open', async () => {
    const ws = connect();
    ws.serverClose(1006);
    const button = screen.getByRole('button', { name: 'Reszta Miss' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    await flush();
    expect(calls).toHaveLength(0);
  });
});

describe('abandon and resume', () => {
  // Porzucić można dopiero po ukończonym legu.
  const secondLeg: MatchSnapshot = { ...initial, legIndex: 1 };
  const abandonedState: MatchSnapshot = {
    ...secondLeg,
    eventSeq: 5,
    status: 'abandoned',
    abandonment: { playerId: 'p2', reason: null, at: '2026-10-15T19:00:00.000Z' },
  };

  function dialog(): HTMLElement {
    return screen.getByRole('dialog', { name: 'Porzucić mecz?' });
  }

  it('offers Porzuć mecz from the start of the game', () => {
    connect();
    expect(screen.getByRole('button', { name: 'Porzuć mecz' })).toBeTruthy();
  });

  it('opens the dialog with the current player preselected and posts the abandon', async () => {
    respond = async () => json(200, abandonedState);
    connect(secondLeg);
    tap('Porzuć mecz');
    expect(within(dialog()).getByText('Gra zostanie zapisana jako porzucona. Wznowisz ją z ekranu startowego.')).toBeTruthy();
    expect((within(dialog()).getByRole('radio', { name: 'Bartek' }) as HTMLInputElement).checked).toBe(true);
    expect((within(dialog()).getByRole('radio', { name: 'Anna' }) as HTMLInputElement).checked).toBe(false);

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Porzuć mecz' }));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: `/api/matches/${MATCH_ID}/abandon`, body: { playerId: 'p2' } });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByText('Mecz porzucony. Tylko do odczytu.')).toBeTruthy();
  });

  it('sends the chosen player and a typed reason', async () => {
    respond = async () => json(200, abandonedState);
    connect(secondLeg);
    tap('Porzuć mecz');
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Anna' }));
    fireEvent.change(within(dialog()).getByRole('textbox', { name: 'Powód (opcjonalnie)' }), { target: { value: ' koniec prądu ' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Porzuć mecz' }));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({ playerId: 'p1', reason: 'koniec prądu' });
  });

  it('closes on Anuluj and on Escape without a request', () => {
    connect(secondLeg);
    tap('Porzuć mecz');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Anuluj' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    tap('Porzuć mecz');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('shows an abandoned game read-only and resumes it', async () => {
    respond = async () => json(200, { ...abandonedState, eventSeq: 6, status: 'in_progress', abandonment: null });
    connect(abandonedState);
    expect(screen.getByText('Porzucony')).toBeTruthy();
    expect(screen.getByText('Mecz porzucony. Tylko do odczytu.')).toBeTruthy();
    // Link w nagłówku i link obok komunikatu.
    expect(screen.getAllByRole('link', { name: 'Ekran startowy' }).map((link) => link.getAttribute('href'))).toEqual(['#/', '#/']);
    expect((screen.getByRole('button', { name: '20' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Miss' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Porzuć mecz' })).toBeNull();

    tap('Wznów mecz');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: `/api/matches/${MATCH_ID}/resume`, body: undefined });
    await vi.waitFor(() => expect((screen.getByRole('button', { name: '20' }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText('Mecz porzucony. Tylko do odczytu.')).toBeNull();
  });

  it('shows a failed resume', async () => {
    respond = async () => json(409, { error: 'match_not_abandoned', message: 'Match is not abandoned' });
    connect(abandonedState);
    tap('Wznów mecz');
    expect(await screen.findByText('Nie udało się wznowić meczu')).toBeTruthy();
  });

  it('shows the summary table of a finished match', async () => {
    const finished = {
      ...initial,
      finished: true,
      status: 'finished' as const,
      currentPlayerId: null,
      winnerId: 'p1',
      players: [player('p1', 'Anna', { remaining: 0, legsWon: 1 }), player('p2', 'Bartek', { remaining: 301, legsWon: 0 })],
    };
    respondSummary = async () =>
      json(
        200,
        summary({
          matchId: MATCH_ID,
          finished: true,
          eventSeq: finished.eventSeq,
          players: [summaryPlayer('p1', { dartsThrown: 6, average: 150.5, legsWon: 1 }), summaryPlayer('p2', { dartsThrown: 3, average: 0 })],
          legs: [{ legIndex: 0, winnerId: 'p1', checkout: 121, dartsThrown: 6, averages: [] }],
        }),
      );
    connect(finished);
    const table = await screen.findByRole('table', { name: 'Podsumowanie meczu' });
    expect(within(table).getByText('150,50')).toBeTruthy();
    expect(screen.getByText('Leg 1')).toBeTruthy();
    expect(screen.getByText('Anna · 6 rzutek · zamknięcie 121')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Klawiatura rzutek' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the live stats panel under the scoreboard in a 1v1 match', async () => {
    respondSummary = async () =>
      json(200, summary({ matchId: MATCH_ID, eventSeq: initial.eventSeq, players: [summaryPlayer('p1'), summaryPlayer('p2', { dartsThrown: 3, average: 64 })] }));
    connect();
    const panel = screen.getByRole('table', { name: 'Statystyki meczu' });
    expect(panel.closest('section')?.previousElementSibling).toBe(screen.getByRole('region', { name: 'Wyniki' }));
    expect(await within(panel).findByText('64,00')).toBeTruthy();
    expect(summaryCalls).toEqual([`/api/matches/${MATCH_ID}/summary`]);
  });

  it('has no stats panel and fetches no summary in a casual game in progress', () => {
    connect(casual(['Anna', 'Bartek', 'Celina'], { id: MATCH_ID, eventSeq: 4, currentPlayerId: 'p1' }));
    expect(screen.getByText('Celina')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Statystyki meczu' })).toBeNull();
    expect(summaryCalls).toEqual([]);
  });

  it('keeps the newest summary when an older response arrives later', async () => {
    const pending: ((eventSeq: number, average: number) => void)[] = [];
    respondSummary = () =>
      new Promise((resolve) => {
        pending.push((eventSeq, average) =>
          resolve(json(200, summary({ matchId: MATCH_ID, eventSeq, players: [summaryPlayer('p1', { dartsThrown: 3, average }), summaryPlayer('p2')] }))),
        );
      });
    const ws = connect();
    ws.serverSend({ type: 'state_updated', matchId: MATCH_ID, eventSeq: 5, state: { ...initial, eventSeq: 5 } });
    await vi.waitFor(() => expect(summaryCalls).toHaveLength(2));

    const [older, newer] = pending;
    const panel = screen.getByRole('table', { name: 'Statystyki meczu' });
    newer?.(5, 99);
    expect(await within(panel).findByText('99,00')).toBeTruthy();
    older?.(4, 11);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(within(panel).getByText('99,00')).toBeTruthy();
    expect(within(panel).queryByText('11,00')).toBeNull();
  });
});

describe('end practice', () => {
  const freeRun = snapshot({
    id: MATCH_ID,
    type: 'practice',
    practiceMode: 'free_run',
    startingScore: null,
    legsToWin: null,
    countsToStats: false,
    eventSeq: 2,
    currentPlayerId: 'p1',
    currentDarts: [
      { segment: 20, multiplier: 3 },
      { segment: 5, multiplier: 1 },
    ],
    players: [player('p1', 'Anna', { remaining: null, dartsThrownInLeg: 2 })],
    freeRun: { dartsThrown: 2, totalPoints: 65, average: 97.5 },
  });
  const endedState: MatchSnapshot = { ...freeRun, eventSeq: 3, status: 'ended', endedAt: '2026-10-15T19:00:00.000Z' };

  function dialog(): HTMLElement {
    return screen.getByRole('dialog', { name: 'Zakończyć trening?' });
  }

  it('hides Zakończ trening before the first dart', () => {
    connect({ ...freeRun, eventSeq: 0, currentDarts: [], players: [player('p1', 'Anna', { remaining: null })], freeRun: { dartsThrown: 0, totalPoints: 0, average: 0 } });
    expect(screen.queryByRole('button', { name: 'Zakończ trening' })).toBeNull();
  });

  it('confirms, posts the end and shows the session read-only', async () => {
    respond = async () => json(200, endedState);
    connect(freeRun);
    tap('Zakończ trening');
    expect(within(dialog()).getByText('Trening zostanie zapisany jako zakończony i zniknie z listy gier do dokończenia. Nie da się go wznowić.')).toBeTruthy();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Zakończ trening' }));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: `/api/matches/${MATCH_ID}/end`, body: undefined });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByText('Trening zakończony. Tylko do odczytu.')).toBeTruthy();
    expect(screen.getByText('Zakończony')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Ekran startowy' }).map((link) => link.getAttribute('href'))).toEqual(['#/', '#/']);
    expect((screen.getByRole('button', { name: '20' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Miss' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Zakończ trening' })).toBeNull();
    expect(screen.getByText('Anna')).toBeTruthy();
  });

  it('closes on Anuluj and on Escape without a request', () => {
    connect(freeRun);
    tap('Zakończ trening');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Anuluj' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    tap('Zakończ trening');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('closes the dialog when another device ends the session', () => {
    const ws = connect(freeRun);
    tap('Zakończ trening');
    ws.serverSend({ type: 'state_updated', matchId: MATCH_ID, eventSeq: endedState.eventSeq, state: endedState });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('shows a failed end', async () => {
    respond = async () => json(409, { error: 'nothing_to_end', message: 'Match has no throw yet' });
    connect(freeRun);
    tap('Zakończ trening');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Zakończ trening' }));
    expect(await screen.findByText('Nie udało się zakończyć treningu')).toBeTruthy();
  });
});

describe('checkout practice', () => {
  const fresh = checkoutPractice(checkoutSession([], { target: 100, range: '51-100' }), { id: MATCH_ID, eventSeq: 1 });
  const tried = checkoutPractice(checkoutSession(checkoutHistory([true]), { target: 64, range: '51-100' }), { id: MATCH_ID, eventSeq: 2 });
  const endedState: MatchSnapshot = { ...tried, eventSeq: 3, status: 'ended', endedAt: '2026-10-15T19:00:00.000Z' };

  beforeEach(() => {
    respond = async (call) => (call.url.endsWith('/undo') ? json(200, { undoneThrowId: null, state: { ...fresh, eventSeq: 3 } }) : json(201, tried));
  });

  function attemptBodies(): unknown[] {
    return calls.filter((call) => call.url === `/api/matches/${MATCH_ID}/checkout-attempts`).map((call) => call.body);
  }

  it('shows the target and the route without the keypad or the turn panel', async () => {
    connect(fresh);
    const card = screen.getByRole('region', { name: 'Końcówka' });
    expect(within(card).getByText('100')).toBeTruthy();
    expect(within(card).getByText('T20 D20')).toBeTruthy();
    expect(within(card).getByText('0 z 0 · —')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Klawiatura rzutek' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Miss' })).toBeNull();
    expect(screen.queryByText('Suma tury')).toBeNull();
    expect(screen.queryByText('Anna rzuca')).toBeNull();
    await flush();
    expect(frequentCalls).toEqual([]);
  });

  it('posts a success and a failure and shows the next target', async () => {
    connect(fresh);
    tap('Udało się');
    await vi.waitFor(() => expect(attemptBodies()).toEqual([{ success: true }]));
    expect(await screen.findByText('1 z 1 · 100%')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Końcówka' })).getByText('64')).toBeTruthy();
    tap('Nie udało się');
    await vi.waitFor(() => expect(attemptBodies()).toEqual([{ success: true }, { success: false }]));
  });

  it('sends one request for a double click', async () => {
    const pending: (() => void)[] = [];
    respond = () => new Promise((resolve) => pending.push(() => resolve(json(201, tried))));
    connect(fresh);
    tap('Udało się');
    tap('Udało się');
    fireEvent.keyDown(window, { key: 'Enter' });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    pending.shift()?.();
    await flush();
    await flush();
    expect(attemptBodies()).toEqual([{ success: true }]);
  });

  it('undoes one attempt for a double click on Cofnij', async () => {
    const pending: (() => void)[] = [];
    respond = () => new Promise((resolve) => pending.push(() => resolve(json(200, { undoneThrowId: null, state: { ...fresh, eventSeq: 3 } }))));
    connect(tried);
    tap('Cofnij');
    tap('Cofnij');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    pending.shift()?.();
    await flush();
    await flush();
    expect(calls).toEqual([{ url: `/api/matches/${MATCH_ID}/undo`, body: undefined }]);
  });

  it('disables Cofnij before the first attempt', () => {
    connect(fresh);
    expect((screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Udało się' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('records Enter and 1 as a success and 0 as a failure', async () => {
    connect(fresh);
    fireEvent.keyDown(window, { key: 'Enter' });
    await vi.waitFor(() => expect(attemptBodies()).toHaveLength(1));
    await flush();
    fireEvent.keyDown(window, { key: '1' });
    await vi.waitFor(() => expect(attemptBodies()).toHaveLength(2));
    await flush();
    fireEvent.keyDown(window, { key: '0' });
    await vi.waitFor(() => expect(attemptBodies()).toHaveLength(3));
    expect(attemptBodies()).toEqual([{ success: true }, { success: true }, { success: false }]);
  });

  it('undoes on Backspace', async () => {
    connect(tried);
    fireEvent.keyDown(window, { key: 'Backspace' });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ url: `/api/matches/${MATCH_ID}/undo`, body: undefined });
  });

  describe('Nowa końcówka', () => {
    const skipUrl = `/api/matches/${MATCH_ID}/checkout-skips`;
    const skippedTried = checkoutPractice(checkoutSession(checkoutHistory([true]), { target: 77, range: '51-100', skips: 1 }), { id: MATCH_ID, eventSeq: 3 });
    const skippedFresh = checkoutPractice(checkoutSession([], { target: 77, range: '51-100', skips: 1 }), { id: MATCH_ID, eventSeq: 2 });

    function recentRows(): string[] {
      const recent = screen.getByRole('region', { name: 'Ostatnie próby' });
      return within(recent)
        .queryAllByRole('listitem')
        .map((row) => row.textContent ?? '');
    }

    it('posts once without a body on a click and on N', async () => {
      respond = async () => json(201, skippedFresh);
      connect(fresh);
      tap('Nowa końcówka');
      await vi.waitFor(() => expect(calls).toHaveLength(1));
      await flush();
      fireEvent.keyDown(window, { key: 'n' });
      await vi.waitFor(() => expect(calls).toHaveLength(2));
      await flush();
      expect(calls).toEqual([
        { url: skipUrl, body: undefined },
        { url: skipUrl, body: undefined },
      ]);
    });

    it('sends one request for a double click', async () => {
      const pending: (() => void)[] = [];
      respond = () => new Promise((resolve) => pending.push(() => resolve(json(201, skippedFresh))));
      connect(fresh);
      tap('Nowa końcówka');
      tap('Nowa końcówka');
      fireEvent.keyDown(window, { key: 'N' });
      await vi.waitFor(() => expect(calls).toHaveLength(1));
      pending.shift()?.();
      await flush();
      await flush();
      expect(calls).toEqual([{ url: skipUrl, body: undefined }]);
    });

    it('shows the new target and keeps the counter and the recent attempts', async () => {
      respond = async () => json(201, skippedTried);
      connect(tried);
      const card = screen.getByRole('region', { name: 'Końcówka' });
      expect(within(card).getByText('1 z 1 · 100%')).toBeTruthy();
      const rowsBefore = recentRows();
      expect(rowsBefore).toHaveLength(1);

      tap('Nowa końcówka');
      expect(await within(card).findByText('77')).toBeTruthy();
      expect(within(card).getByText('1 z 1 · 100%')).toBeTruthy();
      expect(recentRows()).toEqual(rowsBefore);
    });

    it('enables Cofnij after a skip with no attempts', async () => {
      respond = async (call) => (call.url.endsWith('/undo') ? json(200, { undoneThrowId: null, state: { ...fresh, eventSeq: 3 } }) : json(201, skippedFresh));
      connect(fresh);
      const undoButton = screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement;
      expect(undoButton.disabled).toBe(true);
      tap('Nowa końcówka');
      await vi.waitFor(() => expect(undoButton.disabled).toBe(false));
      expect(within(screen.getByRole('region', { name: 'Końcówka' })).getByText('0 z 0 · —')).toBeTruthy();
      tap('Cofnij');
      await vi.waitFor(() => expect(calls).toHaveLength(2));
      expect(calls[1]).toEqual({ url: `/api/matches/${MATCH_ID}/undo`, body: undefined });
    });

    it('shows a failed skip', async () => {
      respond = async () => json(500, { error: 'internal', message: 'boom' });
      connect(fresh);
      tap('Nowa końcówka');
      expect(await screen.findByText('Nie udało się wylosować nowej końcówki')).toBeTruthy();
    });
  });

  it('prevents the default action of a handled key', () => {
    connect(fresh);
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  function pressKey(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  }

  it('leaves Backspace to the browser with 0 attempts', () => {
    connect(fresh);
    expect(pressKey('Backspace').defaultPrevented).toBe(false);
    expect(pressKey('Enter').defaultPrevented).toBe(true);
  });

  it('leaves every key to the browser once the session has ended', async () => {
    connect(endedState);
    for (const key of ['Enter', '1', '0', 'n', 'Backspace']) {
      expect(pressKey(key).defaultPrevented).toBe(false);
    }
    await flush();
    expect(calls).toEqual([]);
  });

  it('leaves every key to the browser while the connection is lost', async () => {
    const ws = connect(tried);
    ws.serverClose(1006);
    expect(screen.getByText('Brak połączenia z serwerem. Łączę ponownie…')).toBeTruthy();
    for (const key of ['Enter', '1', '0', 'n', 'Backspace']) {
      expect(pressKey(key).defaultPrevented).toBe(false);
    }
    await flush();
    expect(calls).toEqual([]);
  });

  it('sends nothing for a held key, a modifier or Backspace with 0 attempts', async () => {
    connect(fresh);
    fireEvent.keyDown(window, { key: 'Enter', repeat: true });
    fireEvent.keyDown(window, { key: '1', ctrlKey: true });
    fireEvent.keyDown(window, { key: '0', metaKey: true });
    fireEvent.keyDown(window, { key: 'Enter', altKey: true });
    fireEvent.keyDown(window, { key: 'n', repeat: true });
    fireEvent.keyDown(window, { key: 'N', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Backspace' });
    await flush();
    expect(calls).toEqual([]);
  });

  it('sends nothing while the end practice dialog is open', async () => {
    connect(tried);
    tap('Zakończ trening');
    for (const key of ['Enter', '1', '0', 'n', 'Backspace']) {
      fireEvent.keyDown(window, { key });
    }
    await flush();
    expect(calls).toEqual([]);
    expect(screen.getByRole('dialog', { name: 'Zakończyć trening?' })).toBeTruthy();
  });

  it('shows a failed attempt', async () => {
    respond = async () => json(500, { error: 'internal', message: 'boom' });
    connect(fresh);
    tap('Nie udało się');
    expect(await screen.findByText('Nie udało się zapisać próby')).toBeTruthy();
  });

  it('offers Zakończ trening only after the first attempt', async () => {
    connect(fresh);
    expect(screen.queryByRole('button', { name: 'Zakończ trening' })).toBeNull();
    tap('Udało się');
    expect(await screen.findByRole('button', { name: 'Zakończ trening' })).toBeTruthy();
  });

  it('swaps the panel for the summary when another device ends the session', async () => {
    const ws = connect(tried);
    ws.serverSend({ type: 'state_updated', matchId: MATCH_ID, eventSeq: endedState.eventSeq, state: endedState });
    const summaryPanel = screen.getByRole('region', { name: 'Podsumowanie treningu' });
    expect(within(summaryPanel).getByText('Udało się')).toBeTruthy();
    expect(screen.getByText('Trening zakończony. Tylko do odczytu.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Końcówka' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Udało się' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nie udało się' })).toBeNull();
    fireEvent.keyDown(window, { key: 'Enter' });
    await flush();
    expect(calls).toEqual([]);
    expect(summaryCalls).toEqual([]);
  });

  it('keeps the recent attempts under the scoreboard', () => {
    connect(tried);
    const recent = screen.getByRole('region', { name: 'Ostatnie próby' });
    expect(recent.previousElementSibling?.getAttribute('aria-label')).toBe('Wyniki');
  });

  it('keeps the actions in the bottom dock', () => {
    connect(fresh);
    const dock = screen.getByRole('button', { name: 'Udało się' }).closest('.sticky');
    expect(dock?.className.split(' ')).toEqual(expect.arrayContaining(['sticky', 'bottom-0', 'lg:contents']));
  });
});

describe('voice', () => {
  class FakeUtterance {
    readonly text: string;
    lang = '';

    constructor(text: string) {
      this.text = text;
    }
  }

  let speak: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  });

  afterEach(() => {
    localStorage.clear();
  });

  const BATCH_SEQ = 5;
  const darts = [{ segment: 20, multiplier: 3 }] as const;

  function sendBatch(ws: FakeWebSocket, event: LiveMessage): void {
    ws.serverSend(event);
    ws.serverSend({ type: 'state_updated', matchId: MATCH_ID, eventSeq: BATCH_SEQ, state: { ...initial, eventSeq: BATCH_SEQ } });
  }

  function sendTurn(ws: FakeWebSocket): void {
    sendBatch(ws, { type: 'turn_completed', matchId: MATCH_ID, eventSeq: BATCH_SEQ, playerId: 'p2', legIndex: 0, turnIndex: 1, darts: [...darts], total: 100, remaining: 337 });
  }

  function toggle(): HTMLElement {
    return screen.getByRole('button', { name: 'Głos' });
  }

  function spokenTexts(): string[] {
    return speak.mock.calls.map(([utterance]) => (utterance as FakeUtterance).text);
  }

  it('is on by default and plays the turn total clip', async () => {
    const ws = connect();
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    sendTurn(ws);
    expect(FakeAudio.played).toEqual(['/audio/pl/scores/100.mp3']);
    await flush();
    expect(speak).not.toHaveBeenCalled();
  });

  it('stays silent after the toggle is off', async () => {
    const ws = connect();
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    sendTurn(ws);
    await flush();
    expect(FakeAudio.played).toEqual([]);
    expect(speak).not.toHaveBeenCalled();
  });

  it('plays a bust clip and a winner clip', () => {
    const ws = connect();
    sendBatch(ws, { type: 'bust', matchId: MATCH_ID, eventSeq: BATCH_SEQ, playerId: 'p2', legIndex: 0, turnIndex: 1, darts: [...darts], remaining: 40 });
    expect(FakeAudio.played).toEqual([expect.stringMatching(/^\/audio\/pl\/events\/bust_[123]\.mp3$/)]);
    sendBatch(ws, { type: 'match_won', matchId: MATCH_ID, eventSeq: BATCH_SEQ, playerId: 'p2', legsWon: { p1: 0, p2: 2 } });
    expect(FakeAudio.played).toEqual([expect.stringMatching(/bust_[123]\.mp3$/), expect.stringMatching(/^\/audio\/pl\/events\/winner_[12]\.mp3$/)]);
  });

  it('plays Game shot on a leg win that does not end the match', () => {
    const ws = connect();
    sendBatch(ws, { type: 'leg_won', matchId: MATCH_ID, eventSeq: BATCH_SEQ, playerId: 'p2', legIndex: 0, checkout: 40, dartsThrown: 15 });
    expect(FakeAudio.played).toEqual(['/audio/pl/events/game_shot.mp3']);
  });

  it('speaks the total when the clip cannot play', async () => {
    FakeAudio.playResult = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    const ws = connect();
    sendTurn(ws);
    expect(FakeAudio.played).toEqual(['/audio/pl/scores/100.mp3']);
    await vi.waitFor(() => expect(spokenTexts()).toEqual(['sto']));
  });

  it('loads the 16 event clips on mount', () => {
    connect();
    expect(FakeAudio.loaded).toEqual([
      '/audio/pl/events/bust_1.mp3',
      '/audio/pl/events/bust_2.mp3',
      '/audio/pl/events/bust_3.mp3',
      '/audio/pl/events/game_shot.mp3',
      '/audio/pl/events/winner_1.mp3',
      '/audio/pl/events/winner_2.mp3',
      '/audio/pl/events/zero_1.mp3',
      '/audio/pl/events/zero_2.mp3',
      '/audio/pl/events/first_100.mp3',
      '/audio/pl/events/first_120.mp3',
      '/audio/pl/events/first_140.mp3',
      '/audio/pl/events/first_180.mp3',
      '/audio/pl/events/achievement_turn_record.mp3',
      '/audio/pl/events/achievement_checkout_record.mp3',
      '/audio/pl/events/achievement_shortest_leg.mp3',
      '/audio/pl/events/achievement_longest_leg.mp3',
    ]);
    expect(FakeAudio.played).toEqual([]);
  });

  it('shows the voice state as text and keeps the name Głos', () => {
    connect();
    expect(toggle().textContent).toContain('włączony');
    expect(toggle().textContent).not.toContain('wyłączony');
    fireEvent.click(toggle());
    expect(toggle().textContent).toContain('wyłączony');
  });

  it('keeps the setting after a new render', () => {
    const { unmount } = render(<GameScreen matchId={MATCH_ID} />);
    fireEvent.click(toggle());
    unmount();
    expect(localStorage.getItem('autoscore.voice')).toBe('off');
    render(<GameScreen matchId={MATCH_ID} />);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('never plays or speaks on a keypad tap', async () => {
    connect();
    tap('20');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(FakeAudio.played).toEqual([]);
    expect(speak).not.toHaveBeenCalled();
  });
});

describe('effects', () => {
  class FakeParam {
    value = 0;
    setValueAtTime(): void {}
    linearRampToValueAtTime(): void {}
    exponentialRampToValueAtTime(): void {}
  }

  class FakeNode extends EventTarget {
    connect(): void {}
    disconnect(): void {}
  }

  class FakeAudioContext {
    static oscillators = 0;
    state = 'running';
    currentTime = 0;
    destination = new FakeNode();

    createOscillator() {
      FakeAudioContext.oscillators++;
      return Object.assign(new FakeNode(), { type: 'sine', frequency: new FakeParam(), start() {}, stop() {} });
    }

    createGain() {
      return Object.assign(new FakeNode(), { gain: new FakeParam() });
    }

    async resume(): Promise<void> {}
    async close(): Promise<void> {}
  }

  class FakeUtterance {
    readonly text: string;
    lang = '';

    constructor(text: string) {
      this.text = text;
    }
  }

  let speak: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    FakeAudioContext.oscillators = 0;
    vi.stubGlobal('AudioContext', FakeAudioContext);
    speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  });

  afterEach(() => {
    localStorage.clear();
  });

  const BATCH_SEQ = 5;
  const darts = [{ segment: 20, multiplier: 3 }] as const;

  function sendBatch(ws: FakeWebSocket, event: LiveMessage): void {
    ws.serverSend(event);
    ws.serverSend({ type: 'state_updated', matchId: MATCH_ID, eventSeq: BATCH_SEQ, state: { ...initial, eventSeq: BATCH_SEQ } });
  }

  function sendBust(ws: FakeWebSocket): void {
    sendBatch(ws, { type: 'bust', matchId: MATCH_ID, eventSeq: BATCH_SEQ, playerId: 'p2', legIndex: 0, turnIndex: 1, darts: [...darts], remaining: 40 });
  }

  function toggle(): HTMLElement {
    return screen.getByRole('button', { name: 'Efekty dźwiękowe' });
  }

  const BUST_CLIP = /^\/audio\/pl\/events\/bust_[123]\.mp3$/;

  function voiceOff(): void {
    localStorage.setItem('autoscore.voice', 'off');
  }

  it('is on by default', () => {
    connect();
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });

  it('plays a bust while the voice is off', () => {
    voiceOff();
    const ws = connect();
    sendBust(ws);
    expect(FakeAudioContext.oscillators).toBeGreaterThan(0);
    expect(FakeAudio.played).toEqual([]);
    expect(speak).not.toHaveBeenCalled();
  });

  it('plays nothing on a plain turn', () => {
    const ws = connect();
    sendBatch(ws, { type: 'turn_completed', matchId: MATCH_ID, eventSeq: BATCH_SEQ, playerId: 'p2', legIndex: 0, turnIndex: 1, darts: [...darts], total: 100, remaining: 337 });
    expect(FakeAudioContext.oscillators).toBe(0);
  });

  it('plays nothing on a keypad tap', async () => {
    connect();
    tap('20');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(FakeAudioContext.oscillators).toBe(0);
  });

  it('stores the off setting and stays silent', () => {
    const ws = connect();
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('autoscore.effects')).toBe('off');
    sendBust(ws);
    expect(FakeAudioContext.oscillators).toBe(0);
  });

  it('plays the bust clip after the effect ends', () => {
    vi.useFakeTimers();
    const ws = connect();
    sendBust(ws);
    expect(FakeAudioContext.oscillators).toBeGreaterThan(0);
    expect(FakeAudio.played).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(FakeAudio.played).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(FakeAudio.played).toEqual([expect.stringMatching(BUST_CLIP)]);
    expect(speak).not.toHaveBeenCalled();
  });

  it('plays the bust clip at once with the effects off', () => {
    localStorage.setItem('autoscore.effects', 'off');
    const ws = connect();
    sendBust(ws);
    expect(FakeAudio.played).toEqual([expect.stringMatching(BUST_CLIP)]);
  });
});

describe('live auth', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('sends the stored token as the first message after open', () => {
    localStorage.setItem('autoscore.token', 't1');
    render(<GameScreen matchId={MATCH_ID} />);
    const ws = socket();
    expect(ws.sent).toEqual([]);
    ws.serverOpen();
    expect(LiveAuthMessage.parse(JSON.parse(ws.sent[0] ?? 'null'))).toEqual({ type: 'auth', token: 't1' });
  });

  it('sends nothing without a token', () => {
    render(<GameScreen matchId={MATCH_ID} />);
    const ws = socket();
    ws.serverOpen();
    expect(ws.sent).toEqual([]);
  });

  it('removes the token on close code 4401 and stops', () => {
    vi.useFakeTimers();
    localStorage.setItem('autoscore.token', 't1');
    const ws = connect();
    ws.serverClose(4401);
    expect(localStorage.getItem('autoscore.token')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

describe('GameScreen undo window', () => {
  const LOCKED_TEXT = 'Mecz zamknięty, nie można go już zmienić';

  function undoButton(): HTMLButtonElement {
    return screen.getByRole('button', { name: /^Cofnij/ }) as HTMLButtonElement;
  }

  function finishedCasual(editableUntil: string) {
    return casual(['Anna', 'Bartek'], {
      id: MATCH_ID,
      eventSeq: 9,
      finished: true,
      currentPlayerId: null,
      placements: [
        { playerId: 'p1', place: 1 },
        { playerId: 'p2', place: 2 },
      ],
      finishedAt: new Date(Date.parse(editableUntil) - 300_000).toISOString(),
      editableUntil,
    });
  }

  it('counts down on Cofnij of a finished casual game and then locks it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T20:00:48.000Z'));
    connect(finishedCasual('2026-10-21T20:05:00.000Z'));
    expect(screen.getByRole('button', { name: 'Cofnij (4:12)' })).toBe(undoButton());
    expect(undoButton().disabled).toBe(false);
    expect(screen.queryByText(LOCKED_TEXT)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('button', { name: 'Cofnij (3:12)' })).toBe(undoButton());

    act(() => {
      vi.advanceTimersByTime(192_000);
    });
    expect(screen.getByRole('button', { name: 'Cofnij' })).toBe(undoButton());
    expect(undoButton().disabled).toBe(true);
    expect(screen.getAllByText(LOCKED_TEXT)).toHaveLength(1);
  });

  it('shows the lock notice once on 409 match_locked and disables Cofnij', async () => {
    respond = async () => json(409, { error: 'match_locked', message: `Match ${MATCH_ID} is locked` });
    connect(finishedCasual(new Date(Date.now() + 60_000).toISOString()));
    expect(undoButton().disabled).toBe(false);
    fireEvent.click(undoButton());
    expect(await screen.findByText(LOCKED_TEXT)).toBeTruthy();
    expect(screen.getAllByText(LOCKED_TEXT)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Cofnij' })).toBe(undoButton());
    expect(undoButton().disabled).toBe(true);
  });

  it('shows the lock notice on 409 match_locked in the match end view', async () => {
    respond = async () => json(409, { error: 'match_locked', message: `Match ${MATCH_ID} is locked` });
    connect({
      ...initial,
      finished: true,
      status: 'finished',
      currentPlayerId: null,
      winnerId: 'p2',
      players: [player('p1', 'Anna', { remaining: 501, legsWon: 1 }), player('p2', 'Bartek', { remaining: 0, legsWon: 2 })],
      finishedAt: new Date(Date.now() - 60_000).toISOString(),
      editableUntil: new Date(Date.now() + 240_000).toISOString(),
    });
    expect(screen.getByText('Mecz zakończony')).toBeTruthy();
    fireEvent.click(undoButton());
    expect(await screen.findByText(LOCKED_TEXT)).toBeTruthy();
    expect(screen.getAllByText(LOCKED_TEXT)).toHaveLength(1);
    expect(undoButton().disabled).toBe(true);
  });

  it('shows a plain Cofnij in a game in progress', () => {
    vi.useFakeTimers();
    connect();
    expect(screen.getByRole('button', { name: 'Cofnij' })).toBe(undoButton());
    expect(undoButton().disabled).toBe(false);
    act(() => {
      vi.advanceTimersByTime(3_600_000);
    });
    expect(screen.getByRole('button', { name: 'Cofnij' })).toBe(undoButton());
    expect(screen.queryByText(LOCKED_TEXT)).toBeNull();
  });
});

describe('frequent hits', () => {
  const BARTEK_HITS = [
    { segment: 20, multiplier: 1, count: 9 },
    { segment: 1, multiplier: 1, count: 5 },
    { segment: 20, multiplier: 3, count: 2 },
  ];
  const ANNA_HITS = [{ segment: 19, multiplier: 3, count: 4 }];
  const annaThrows = { ...initial, eventSeq: 7, currentPlayerId: 'p1' };

  function row(name: string): HTMLElement | null {
    return screen.queryByRole('group', { name: `Najczęstsze: ${name}` });
  }

  function rowLabels(name: string): string[] {
    const group = row(name);
    return group ? within(group).getAllByRole('button').map((element) => element.textContent ?? '') : [];
  }

  beforeEach(() => {
    respondFrequent = async (playerId) => json(200, { playerId, hits: playerId === 'p2' ? BARTEK_HITS : ANNA_HITS });
  });

  it('shows the hits of the current thrower', async () => {
    connect();
    expect(await screen.findByRole('group', { name: 'Najczęstsze: Bartek' })).toBeTruthy();
    expect(rowLabels('Bartek')).toEqual(['S20', 'S1', 'T20']);
    expect(frequentCalls).toEqual(['p2']);
  });

  it('fetches the hits of the next thrower and never shows the old list under the new name', async () => {
    const pending: (() => void)[] = [];
    const ws = connect();
    await screen.findByRole('group', { name: 'Najczęstsze: Bartek' });
    respondFrequent = (playerId) => new Promise((resolve) => pending.push(() => resolve(json(200, { playerId, hits: ANNA_HITS }))));

    ws.serverSend({ type: 'state_updated', matchId: MATCH_ID, eventSeq: 7, state: annaThrows });
    await vi.waitFor(() => expect(frequentCalls).toEqual(['p2', 'p1']));
    expect(row('Bartek')).toBeNull();
    expect(row('Anna')).toBeNull();
    expect(screen.queryByRole('button', { name: 'S20' })).toBeNull();

    pending.shift()?.();
    expect(await screen.findByRole('group', { name: 'Najczęstsze: Anna' })).toBeTruthy();
    expect(rowLabels('Anna')).toEqual(['T19']);
  });

  it('ignores a late response for the previous thrower', async () => {
    const pending = new Map<string, () => void>();
    respondFrequent = (playerId) =>
      new Promise((resolve) => pending.set(playerId, () => resolve(json(200, { playerId, hits: playerId === 'p2' ? BARTEK_HITS : ANNA_HITS }))));
    const ws = connect();
    ws.serverSend({ type: 'state_updated', matchId: MATCH_ID, eventSeq: 7, state: annaThrows });
    await vi.waitFor(() => expect(frequentCalls).toEqual(['p2', 'p1']));

    pending.get('p2')?.();
    await act(flush);
    expect(row('Bartek')).toBeNull();
    expect(row('Anna')).toBeNull();

    pending.get('p1')?.();
    expect(await screen.findByRole('group', { name: 'Najczęstsze: Anna' })).toBeTruthy();
    expect(rowLabels('Anna')).toEqual(['T19']);
  });

  it.each([
    ['an error', () => json(500, { error: 'internal', message: 'boom' })],
    ['an empty list', () => json(200, { playerId: 'p2', hits: [] })],
  ])('shows no row buttons after %s', async (_name, response) => {
    respondFrequent = async () => response();
    connect();
    await vi.waitFor(() => expect(frequentCalls).toEqual(['p2']));
    await act(flush);
    expect(row('Bartek')).toBeNull();
    expect(screen.queryByText('Najczęstsze: Bartek')).toBeNull();
    expect(screen.getAllByRole('button', { name: '20' })).toHaveLength(1);
  });

  it('posts a row click as a HitEvent with that segment and multiplier', async () => {
    connect();
    const group = await screen.findByRole('group', { name: 'Najczęstsze: Bartek' });
    tap('D');
    fireEvent.click(within(group).getByRole('button', { name: 'T20' }));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.url).toBe(`/api/matches/${MATCH_ID}/throws`);
    expect(HitEvent.parse(calls[0]?.body)).toMatchObject({ matchId: MATCH_ID, source: 'keypad', segment: 20, multiplier: 3 });
  });

  it('fetches nothing for a finished game', async () => {
    connect({ ...initial, finished: true, status: 'finished', currentPlayerId: null, winnerId: 'p2' });
    await act(flush);
    expect(frequentCalls).toEqual([]);
  });
});

describe('achievements', () => {
  afterEach(() => {
    localStorage.clear();
  });

  function achievement(eventSeq: number, overrides: Partial<Extract<LiveMessage, { type: 'achievement' }>> = {}): LiveMessage {
    return { type: 'achievement', matchId: MATCH_ID, eventSeq, playerId: 'p2', kind: 'turn_record', value: 140, previous: 121, ...overrides };
  }

  function notices(): string[] {
    const list = screen.queryByRole('list', { name: 'Osiągnięcia' });
    return list ? within(list).getAllByRole('listitem').map((item) => item.textContent) : [];
  }

  it('shows the notice with the player name and the text inside the status overlay', () => {
    const ws = connect();
    ws.serverSend(achievement(5));
    const status = screen.getByRole('status');
    const list = within(status).getByRole('list', { name: 'Osiągnięcia' });
    expect(within(list).getByText('Bartek')).toBeTruthy();
    expect(within(list).getByText('Rekord tury: 140 (było 121)', { exact: false })).toBeTruthy();
    expect(list.querySelector('svg')).not.toBeNull();
    expect(status.className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'pointer-events-none']));
  });

  it('groups achievements with the same eventSeq and replaces them on a new one', () => {
    const ws = connect();
    ws.serverSend(achievement(5, { kind: 'first_140', value: 140, previous: null }));
    ws.serverSend(achievement(5));
    expect(notices()).toEqual(['Bartek Pierwsza tura 140+: 140', 'Bartek Rekord tury: 140 (było 121)']);
    ws.serverSend(achievement(6, { playerId: 'p1', kind: 'checkout_record', value: 121, previous: 100 }));
    expect(notices()).toEqual(['Anna Rekord zamknięcia: 121 (było 100)']);
  });

  it('hides the notices after ACHIEVEMENT_DURATION_MS', () => {
    vi.useFakeTimers();
    const ws = connect();
    ws.serverSend(achievement(5));
    act(() => {
      vi.advanceTimersByTime(ACHIEVEMENT_DURATION_MS - 1);
    });
    expect(notices()).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(notices()).toEqual([]);
  });

  it('restarts the timer for an achievement in the same group', () => {
    vi.useFakeTimers();
    const ws = connect();
    ws.serverSend(achievement(5, { kind: 'first_140', value: 140, previous: null }));
    act(() => {
      vi.advanceTimersByTime(ACHIEVEMENT_DURATION_MS - 1);
    });
    ws.serverSend(achievement(5));
    act(() => {
      vi.advanceTimersByTime(ACHIEVEMENT_DURATION_MS - 1);
    });
    expect(notices()).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(notices()).toEqual([]);
  });

  it('hides the notices on throw_undone', () => {
    const ws = connect();
    ws.serverSend(achievement(5));
    ws.serverSend({ type: 'throw_undone', matchId: MATCH_ID, eventSeq: 6, throwId: 't_5' });
    expect(notices()).toEqual([]);
  });

  it('shows the notice with the voice off', () => {
    localStorage.setItem('autoscore.voice', 'off');
    localStorage.setItem('autoscore.effects', 'off');
    const ws = connect();
    ws.serverSend(achievement(5));
    expect(notices()).toEqual(['Bartek Rekord tury: 140 (było 121)']);
  });

  it('shows the notice on the match end view', () => {
    const ws = connect({
      ...initial,
      finished: true,
      status: 'finished',
      currentPlayerId: null,
      winnerId: 'p2',
      players: [player('p1', 'Anna', { remaining: 501, legsWon: 0 }), player('p2', 'Bartek', { remaining: 0, legsWon: 1 })],
    });
    expect(screen.getByText('Mecz zakończony')).toBeTruthy();
    ws.serverSend(achievement(4, { kind: 'shortest_leg', value: 15, previous: 18 }));
    const status = screen.getByRole('status');
    expect(within(status).getByRole('list', { name: 'Osiągnięcia' }).textContent).toBe('Bartek Najkrótszy leg: 15 lotek (było 18)');
    expect(status.className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'pointer-events-none']));
  });
});
