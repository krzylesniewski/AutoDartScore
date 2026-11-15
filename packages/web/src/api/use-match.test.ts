import { HitEvent, type LiveMessage, type MatchSnapshot } from '@autoscore/schema';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snapshot } from '../test/snapshots';
import { REQUEST_TIMEOUT_MS } from './client';
import { useMatch, type UseMatch } from './use-match';

const MATCH_ID = 'm_42';
const THROWS_URL = `/api/matches/${MATCH_ID}/throws`;
const UNDO_URL = `/api/matches/${MATCH_ID}/undo`;
const T20 = { segment: 20, multiplier: 3 } as const;

// Wzorowana na atrapie z GameScreen.test.tsx. Hook potrzebuje z socketu tylko stanu meczu.
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
  readonly body: unknown;
}

let calls: Call[];
let respond: (call: Call) => Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const initial = snapshot({ id: MATCH_ID, eventSeq: 4 });

function throwResult(call: Call, state: MatchSnapshot = initial) {
  const hit = HitEvent.parse(call.body);
  return { throw: { ...hit, id: `t_${hit.sequence}`, receivedAt: hit.detectedAt }, events: [], state };
}

function created(call: Call): Promise<Response> {
  return Promise.resolve(json(201, throwResult(call)));
}

function serverError(): Promise<Response> {
  return Promise.resolve(json(500, { error: 'internal_error', message: 'Internal error' }));
}

function networkError(): Promise<Response> {
  return Promise.reject(new TypeError('Failed to fetch'));
}

// Jak prawdziwy fetch: przerwany sygnał odrzuca żądanie powodem przerwania.
function fakeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const call = { url, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined };
  calls.push(call);
  const signal = init.signal;
  if (!signal) {
    return respond(call);
  }
  if (signal.aborted) {
    return Promise.reject(signal.reason);
  }
  const aborted = new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  return Promise.race([respond(call), aborted]);
}

function throwCalls(): HitEvent[] {
  return calls.filter((call) => call.url === THROWS_URL).map((call) => HitEvent.parse(call.body));
}

function render() {
  return renderHook(() => useMatch(MATCH_ID));
}

async function settled(result: { readonly current: UseMatch }): Promise<void> {
  await waitFor(() => expect(result.current.busy).toBe(false));
}

function deliver(state: MatchSnapshot): void {
  const ws = FakeWebSocket.instances.at(-1);
  if (!ws) {
    throw new Error('no socket');
  }
  ws.serverSend({ type: 'state_updated', matchId: MATCH_ID, eventSeq: state.eventSeq, state });
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  calls = [];
  respond = created;
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useMatch command queue', () => {
  it('drops the taps queued behind a throw that fails with HTTP 500', async () => {
    respond = (call) => (calls.length === 1 ? serverError() : created(call));
    const { result } = render();
    act(() => {
      result.current.sendHit(T20);
      result.current.sendHit(T20);
      result.current.sendHit(T20);
    });
    await settled(result);
    expect(throwCalls()).toHaveLength(1);
    expect(result.current.errorCode).toBe('throw_failed');
    expect(result.current.error).toBe('Nie udało się wysłać rzutki');
    expect(result.current.busy).toBe(false);
  });

  it('retries a throw once after a network error and then drops the queued taps', async () => {
    respond = networkError;
    const { result } = render();
    act(() => {
      result.current.sendHit({ segment: 20, multiplier: 1 });
      result.current.sendHit({ segment: 5, multiplier: 1 });
      result.current.sendHit({ segment: 1, multiplier: 1 });
    });
    await settled(result);
    const sent = throwCalls();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.eventId).toBe(sent[0]?.eventId);
    expect(sent.map((hit) => hit.segment)).toEqual([20, 20]);
    expect(result.current.errorCode).toBe('throw_failed');
    expect(result.current.busy).toBe(false);
  });

  it('sends a tap made after the failure and clears the error on success', async () => {
    respond = networkError;
    const { result } = render();
    act(() => {
      result.current.sendHit({ segment: 20, multiplier: 1 });
      result.current.sendHit({ segment: 5, multiplier: 1 });
    });
    await settled(result);
    expect(result.current.error).toBe('Nie udało się wysłać rzutki');

    respond = created;
    act(() => {
      result.current.sendHit({ segment: 19, multiplier: 1 });
    });
    await settled(result);
    expect(throwCalls().map((hit) => hit.segment)).toEqual([20, 20, 19]);
    expect(result.current.errorCode).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe('useMatch throw retry', () => {
  it('resends the same event after a network error', async () => {
    respond = (call) => (calls.length === 1 ? networkError() : created(call));
    const { result } = render();
    act(() => {
      result.current.sendHit(T20);
    });
    await settled(result);
    const sent = throwCalls();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(result.current.errorCode).toBeNull();
  });

  it.each([
    [409, { error: 'match_finished', message: 'Match is finished' }],
    [500, { error: 'internal_error', message: 'Internal error' }],
  ])('does not retry a throw after HTTP %i', async (status, body) => {
    respond = () => Promise.resolve(json(status, body));
    const { result } = render();
    act(() => {
      result.current.sendHit(T20);
    });
    await settled(result);
    expect(throwCalls()).toHaveLength(1);
    expect(result.current.error).toBe('Nie udało się wysłać rzutki');
  });

  it('fails the throw after both attempts time out', async () => {
    const controllers: AbortController[] = [];
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const controller = new AbortController();
      controllers.push(controller);
      return controller.signal;
    });
    respond = () => new Promise<Response>(() => {});
    const { result } = render();
    act(() => {
      result.current.sendHit(T20);
      result.current.sendHit(T20);
    });
    await waitFor(() => expect(controllers).toHaveLength(1));
    controllers[0]?.abort(new DOMException('timeout', 'TimeoutError'));
    await waitFor(() => expect(controllers).toHaveLength(2));
    expect(result.current.busy).toBe(true);
    controllers[1]?.abort(new DOMException('timeout', 'TimeoutError'));
    await settled(result);
    const sent = throwCalls();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.eventId).toBe(sent[0]?.eventId);
    expect(result.current.errorCode).toBe('throw_failed');
    expect(result.current.busy).toBe(false);
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
  });
});

describe('useMatch other commands', () => {
  it('drops a queued undo when a Reszta Miss throw fails', async () => {
    respond = (call) => (call.url === UNDO_URL ? Promise.resolve(json(200, { undoneThrowId: 't1', state: { ...initial, eventSeq: 5 } })) : serverError());
    const { result } = render();
    deliver(initial);
    act(() => {
      result.current.sendRestMiss();
      result.current.sendUndo();
    });
    await settled(result);
    expect(throwCalls()).toHaveLength(1);
    expect(calls.filter((call) => call.url === UNDO_URL)).toEqual([]);
    expect(result.current.errorCode).toBe('throw_failed');
  });

  it.each([
    ['match_locked', 'any server text'],
    ['nothing_to_undo', 'Match has no throw to undo'],
  ] as const)('reads 409 %s on undo as an error code', async (code, message) => {
    respond = () => Promise.resolve(json(409, { error: code, message }));
    const { result } = render();
    act(() => {
      result.current.sendUndo();
    });
    await settled(result);
    expect(result.current.errorCode).toBe(code);
  });

  it('keeps a hit queued behind a failed undo', async () => {
    respond = (call) => (call.url === UNDO_URL ? serverError() : created(call));
    const { result } = render();
    act(() => {
      result.current.sendUndo();
      result.current.sendHit(T20);
    });
    await settled(result);
    expect(calls.map((call) => call.url)).toEqual([UNDO_URL, THROWS_URL]);
    expect(result.current.error).toBeNull();
  });
});
