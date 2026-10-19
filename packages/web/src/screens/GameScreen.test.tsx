import { HitEvent, type LiveMessage, type MatchSnapshot } from '@autoscore/schema';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { casual, player, snapshot, summary, summaryPlayer } from '../test/snapshots';
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
  respond = async (call) => json(201, throwResult(call, initial));
  respondSummary = async () => json(200, summary({ matchId: MATCH_ID, eventSeq: initial.eventSeq }));
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

  it('hides Porzuć mecz before the first leg is completed', () => {
    connect();
    expect(screen.queryByRole('button', { name: 'Porzuć mecz' })).toBeNull();
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

  it('loads the six event clips on mount', () => {
    connect();
    expect(FakeAudio.loaded).toEqual([
      '/audio/pl/events/bust_1.mp3',
      '/audio/pl/events/bust_2.mp3',
      '/audio/pl/events/bust_3.mp3',
      '/audio/pl/events/game_shot.mp3',
      '/audio/pl/events/winner_1.mp3',
      '/audio/pl/events/winner_2.mp3',
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

  it('reads Bust after the effect ends', () => {
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

  it('reads Bust at once with the effects off', () => {
    localStorage.setItem('autoscore.effects', 'off');
    const ws = connect();
    sendBust(ws);
    expect(FakeAudio.played).toEqual([expect.stringMatching(BUST_CLIP)]);
  });
});
