import { HitEvent, type LiveMessage, type MatchSnapshot } from '@autoscore/schema';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { player, snapshot } from '../test/snapshots';
import { GameScreen } from './GameScreen';

const MATCH_ID = 'm_42';

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

interface Call {
  readonly url: string;
  readonly body: unknown;
}

let calls: Call[];
let respond: (call: Call) => Promise<Response>;

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

function tap(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  calls = [];
  respond = async (call) => json(201, throwResult(call, initial));
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
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
    expect(screen.getByText('Anna')).toBeTruthy();
    expect(screen.getByText('Bartek')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Wyniki' })).getAllByText('501')).toHaveLength(1);
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
      currentPlayerId: null,
      winnerId: 'p2',
      players: [player('p1', 'Anna', { remaining: 501, legsWon: 1 }), player('p2', 'Bartek', { remaining: 0, legsWon: 2 })],
    });
    expect(screen.getByText('Koniec meczu')).toBeTruthy();
    expect(screen.getByText('Bartek 2:1 w legach')).toBeTruthy();
    expect((screen.getByRole('button', { name: '20' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement).disabled).toBe(false);
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

  it('is off by default and stays silent', () => {
    const ws = connect();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    sendTurn(ws);
    expect(speak).not.toHaveBeenCalled();
  });

  it('reads the turn total after the toggle is on', () => {
    const ws = connect();
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    sendTurn(ws);
    expect(spokenTexts()).toEqual(['sto']);
  });

  it('reads Bust and Zwycięzca', () => {
    const ws = connect();
    fireEvent.click(toggle());
    sendBatch(ws, { type: 'bust', matchId: MATCH_ID, eventSeq: BATCH_SEQ, playerId: 'p2', legIndex: 0, turnIndex: 1, darts: [...darts], remaining: 40 });
    expect(spokenTexts()).toEqual(['Bust']);
    sendBatch(ws, { type: 'match_won', matchId: MATCH_ID, eventSeq: BATCH_SEQ, playerId: 'p2', legsWon: { p1: 0, p2: 2 } });
    expect(spokenTexts()).toEqual(['Bust', 'Zwycięzca']);
  });

  it('shows the voice state as text and keeps the name Głos', () => {
    connect();
    expect(toggle().textContent).toContain('wyłączony');
    fireEvent.click(toggle());
    expect(toggle().textContent).toContain('włączony');
    expect(toggle().textContent).not.toContain('wyłączony');
  });

  it('keeps the setting after a new render', () => {
    const { unmount } = render(<GameScreen matchId={MATCH_ID} />);
    fireEvent.click(toggle());
    unmount();
    expect(localStorage.getItem('autoscore.voice')).toBe('on');
    render(<GameScreen matchId={MATCH_ID} />);
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });

  it('never speaks on a keypad tap', async () => {
    connect();
    fireEvent.click(toggle());
    tap('20');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(speak).not.toHaveBeenCalled();
  });
});
