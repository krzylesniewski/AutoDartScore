import { HitEvent, RestMissRequest, type LiveMessage, type MatchSnapshot } from '@autoscore/schema';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snapshot } from '../test/snapshots';
import { REQUEST_TIMEOUT_MS } from './client';
import { useMatch, type UseMatch } from './use-match';

const MATCH_ID = 'm_42';
const THROWS_URL = `/api/matches/${MATCH_ID}/throws`;
const UNDO_URL = `/api/matches/${MATCH_ID}/undo`;
const REST_MISS_URL = `/api/matches/${MATCH_ID}/rest-miss`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
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

function stale(state: MatchSnapshot): Promise<Response> {
  return Promise.resolve(json(409, { error: 'stale_state', message: 'Match state changed', state }));
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

describe('useMatch Reszta Miss', () => {
  const restMissed = snapshot({ id: MATCH_ID, eventSeq: 7, currentPlayerId: 'p2' });

  function restMissOk(state: MatchSnapshot = restMissed): Promise<Response> {
    return Promise.resolve(json(200, { throws: [], events: [], state }));
  }

  function restMissBodies(): unknown[] {
    return calls.filter((call) => call.url === REST_MISS_URL).map((call) => call.body);
  }

  it('sends one rest-miss command with a uuid eventId and the current eventSeq', async () => {
    respond = () => restMissOk();
    const { result } = render();
    deliver({ ...initial, currentDarts: [T20] });
    act(() => {
      result.current.sendRestMiss();
    });
    await settled(result);
    expect(calls.map((call) => call.url)).toEqual([REST_MISS_URL]);
    expect(RestMissRequest.parse(calls[0]?.body)).toEqual(calls[0]?.body);
    expect(calls[0]?.body).toEqual({ eventId: expect.stringMatching(UUID) as unknown, expectedSeq: 4 });
    expect(throwCalls()).toEqual([]);
    expect(result.current.state).toEqual(restMissed);
    expect(result.current.errorCode).toBeNull();
  });

  it('sends the eventSeq from the reply to a hit queued ahead of it', async () => {
    const afterHit = { ...initial, eventSeq: 5, currentDarts: [T20] };
    respond = (call) => (call.url === THROWS_URL ? Promise.resolve(json(201, throwResult(call, afterHit))) : restMissOk());
    const { result } = render();
    deliver(initial);
    act(() => {
      result.current.sendHit(T20);
      result.current.sendRestMiss();
    });
    await settled(result);
    expect(calls.map((call) => call.url)).toEqual([THROWS_URL, REST_MISS_URL]);
    expect(restMissBodies()).toEqual([{ eventId: expect.stringMatching(UUID) as unknown, expectedSeq: 5 }]);
  });

  it('fails on HTTP 500 without a partial turn and drops a queued undo', async () => {
    respond = (call) => (call.url === UNDO_URL ? Promise.resolve(json(200, { undoneThrowId: 't1', state: { ...initial, eventSeq: 5 } })) : serverError());
    const { result } = render();
    deliver(initial);
    act(() => {
      result.current.sendRestMiss();
      result.current.sendUndo();
    });
    await settled(result);
    expect(calls.map((call) => call.url)).toEqual([REST_MISS_URL]);
    expect(result.current.errorCode).toBe('throw_failed');
    expect(result.current.state).toEqual(initial);
  });

  it('resends the identical command once after a network error', async () => {
    respond = () => (calls.length === 1 ? networkError() : restMissOk());
    const { result } = render();
    deliver(initial);
    act(() => {
      result.current.sendRestMiss();
    });
    await settled(result);
    const sent = restMissBodies();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(result.current.errorCode).toBeNull();
    expect(result.current.state).toEqual(restMissed);
  });

  it('fails after two network errors', async () => {
    respond = networkError;
    const { result } = render();
    deliver(initial);
    act(() => {
      result.current.sendRestMiss();
    });
    await settled(result);
    const sent = restMissBodies();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(result.current.errorCode).toBe('throw_failed');
    expect(result.current.state).toEqual(initial);
  });

  it('accepts the state from a stale_state reply without an error and keeps a hit queued behind it', async () => {
    const newer = snapshot({ id: MATCH_ID, eventSeq: 9, currentPlayerId: 'p2' });
    respond = (call) => (call.url === REST_MISS_URL ? stale(newer) : created(call));
    const { result } = render();
    deliver(initial);
    act(() => {
      result.current.sendRestMiss();
      result.current.sendHit(T20);
    });
    await settled(result);
    expect(calls.map((call) => call.url)).toEqual([REST_MISS_URL, THROWS_URL]);
    expect(result.current.errorCode).toBeNull();
    expect(result.current.state?.eventSeq).toBe(9);
  });

  it('sends nothing when the hit queued ahead of it closed the turn', async () => {
    const twoDarts = { ...initial, currentPlayerId: 'p1', currentDarts: [T20, T20] };
    const nextThrower = { ...initial, eventSeq: 5, currentPlayerId: 'p2', currentDarts: [] };
    respond = (call) => (call.url === THROWS_URL ? Promise.resolve(json(201, throwResult(call, nextThrower))) : restMissOk());
    const { result } = render();
    deliver(twoDarts);
    act(() => {
      result.current.sendHit(T20);
      result.current.sendRestMiss();
    });
    await settled(result);
    expect(calls.map((call) => call.url)).toEqual([THROWS_URL]);
    expect(result.current.state).toEqual(nextThrower);
  });
});

describe('useMatch expectedSeq', () => {
  it('sends the same expectedSeq with two queued undos and accepts the stale reply silently', async () => {
    const afterUndo = { ...initial, eventSeq: 5 };
    respond = () => (calls.length === 1 ? Promise.resolve(json(200, { undoneThrowId: 't1', state: afterUndo })) : stale(afterUndo));
    const { result } = render();
    deliver(initial);
    act(() => {
      result.current.sendUndo();
      result.current.sendUndo();
    });
    await settled(result);
    expect(calls).toEqual([
      { url: UNDO_URL, body: { expectedSeq: 4 } },
      { url: UNDO_URL, body: { expectedSeq: 4 } },
    ]);
    expect(result.current.errorCode).toBeNull();
    expect(result.current.state?.eventSeq).toBe(5);
  });

  it.each([
    ['undo', UNDO_URL, (match: UseMatch) => match.sendUndo(), { expectedSeq: 4 }],
    ['checkout attempt', `/api/matches/${MATCH_ID}/checkout-attempts`, (match: UseMatch) => match.sendCheckoutAttempt(true), { success: true, expectedSeq: 4 }],
    ['checkout skip', `/api/matches/${MATCH_ID}/checkout-skips`, (match: UseMatch) => match.sendCheckoutSkip(), { expectedSeq: 4 }],
  ] as const)('accepts a stale_state reply to %s with one request and no error', async (_name, url, send, body) => {
    const newer = snapshot({ id: MATCH_ID, eventSeq: 9, currentPlayerId: 'p2' });
    respond = () => stale(newer);
    const { result } = render();
    deliver(initial);
    act(() => {
      send(result.current);
    });
    await settled(result);
    expect(calls).toEqual([{ url, body }]);
    expect(result.current.errorCode).toBeNull();
    expect(result.current.state).toEqual(newer);
  });

  describe.each([
    ['abandon', `/api/matches/${MATCH_ID}/abandon`, (match: UseMatch) => match.sendAbandon('p1', null), { playerId: 'p1' }, 'Nie udało się porzucić meczu'],
    ['resume', `/api/matches/${MATCH_ID}/resume`, (match: UseMatch) => match.sendResume(), {}, 'Nie udało się wznowić meczu'],
    ['end practice', `/api/matches/${MATCH_ID}/end`, (match: UseMatch) => match.sendEndPractice(), {}, 'Nie udało się zakończyć treningu'],
  ] as const)('%s after stale_state', (_name, url, send, body, failure) => {
    const newer = snapshot({ id: MATCH_ID, eventSeq: 9 });
    const newest = snapshot({ id: MATCH_ID, eventSeq: 11 });
    const done = snapshot({ id: MATCH_ID, eventSeq: 10 });

    async function run(second: () => Promise<Response>): Promise<{ readonly current: UseMatch }> {
      respond = () => (calls.length === 1 ? stale(newer) : second());
      const { result } = render();
      deliver(initial);
      act(() => {
        send(result.current);
      });
      await settled(result);
      expect(calls).toEqual([
        { url, body: { ...body, expectedSeq: 4 } },
        { url, body: { ...body, expectedSeq: 9 } },
      ]);
      return result;
    }

    it('is sent once more with the eventSeq of the reply state', async () => {
      const result = await run(() => Promise.resolve(json(200, done)));
      expect(result.current.errorCode).toBeNull();
      expect(result.current.state).toEqual(done);
    });

    it('shows the existing text when the second attempt fails', async () => {
      const result = await run(serverError);
      expect(result.current.error).toBe(failure);
      expect(result.current.state).toEqual(newer);
    });

    it('shows the existing text and the newest state when the second attempt is stale too', async () => {
      const result = await run(() => stale(newest));
      expect(result.current.error).toBe(failure);
      expect(result.current.state).toEqual(newest);
    });
  });
});

describe('useMatch other commands', () => {
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
