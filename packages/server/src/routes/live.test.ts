import { LiveMessage } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D, LEG_301, S, createGame, createPlayers, hitEvent, postThrow, setup, throwDarts, undo, type TestApp } from '../test-helpers.js';
import { MATCH_NOT_FOUND_CLOSE_CODE } from './live.js';

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'close', listener: (code: number) => void): void;
  terminate(): void;
}

interface Subscriber {
  readonly messages: unknown[];
  closeCode: number | null;
  readonly socket: TestSocket;
}

let t: TestApp;
const sockets: TestSocket[] = [];
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.terminate();
  }
  await t.close();
});

// Nasłuch w onInit, bo pierwsza wiadomość może przyjść przed rozwiązaniem injectWS.
async function subscribe(matchId: string): Promise<Subscriber> {
  const messages: unknown[] = [];
  const subscriber = { messages, closeCode: null as number | null };
  const socket: TestSocket = await t.app.injectWS(`/matches/${matchId}/live`, {}, {
    onInit(ws: TestSocket) {
      ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
      ws.on('close', (code) => (subscriber.closeCode = code));
    },
  });
  sockets.push(socket);
  return Object.assign(subscriber, { socket });
}

async function received(subscriber: Subscriber, count: number): Promise<LiveMessage[]> {
  await vi.waitFor(() => expect(subscriber.messages.length).toBeGreaterThanOrEqual(count));
  return subscriber.messages.map((message) => LiveMessage.parse(message));
}

async function match301(bestOf: number) {
  const [anna, bartek] = await createPlayers(t.app, 2);
  return createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf });
}

describe('GET /matches/:id/live', () => {
  it('sends the current state on connect', async () => {
    const { id } = await match301(3);
    await throwDarts(t.app, id, [S(20)]);
    const subscriber = await subscribe(id);
    const [first] = await received(subscriber, 1);
    expect(first).toMatchObject({ type: 'state_updated', matchId: id, eventSeq: 1, state: { id, eventSeq: 1 } });
  });

  it('streams a match-winning checkout in engine order', async () => {
    const { id } = await match301(1);
    await throwDarts(t.app, id, LEG_301.slice(0, -1));
    const subscriber = await subscribe(id);
    await received(subscriber, 1);

    const response = await postThrow(t.app, id, hitEvent(id, D(5)));
    expect(response.statusCode).toBe(201);
    const messages = (await received(subscriber, 6)).slice(1);
    expect(messages.map((message) => message.type)).toEqual(['throw_registered', 'turn_completed', 'leg_won', 'match_won', 'state_updated']);
    expect(messages.every((message) => message.matchId === id && message.eventSeq === 9)).toBe(true);
    expect(messages.at(-1)).toEqual({ type: 'state_updated', matchId: id, eventSeq: 9, state: response.json().state });
  });

  it('sends throw_undone and then state_updated after an undo', async () => {
    const { id } = await match301(3);
    const [thrown] = await throwDarts(t.app, id, [S(20)]);
    const subscriber = await subscribe(id);
    await received(subscriber, 1);

    expect((await undo(t.app, id)).statusCode).toBe(200);
    const messages = (await received(subscriber, 3)).slice(1);
    expect(messages).toEqual([
      { type: 'throw_undone', matchId: id, eventSeq: 2, throwId: thrown.throw.id },
      expect.objectContaining({ type: 'state_updated', eventSeq: 2 }),
    ]);
  });

  it('delivers every message to two subscribers and skips idempotent resends', async () => {
    const { id } = await match301(3);
    const first = await subscribe(id);
    const second = await subscribe(id);
    await received(first, 1);
    await received(second, 1);

    const hit = hitEvent(id, S(20));
    await postThrow(t.app, id, hit);
    expect((await postThrow(t.app, id, hit)).statusCode).toBe(200);
    await undo(t.app, id);

    const expected = ['state_updated', 'throw_registered', 'state_updated', 'throw_undone', 'state_updated'];
    const fromFirst = await received(first, expected.length);
    const fromSecond = await received(second, expected.length);
    expect(fromFirst.map((message) => message.type)).toEqual(expected);
    expect(fromSecond).toEqual(fromFirst);
  });

  it('stops sending to a closed socket', async () => {
    const { id } = await match301(3);
    const subscriber = await subscribe(id);
    await received(subscriber, 1);
    subscriber.socket.terminate();
    await vi.waitFor(() => expect(subscriber.closeCode).not.toBeNull());

    expect((await postThrow(t.app, id, hitEvent(id, S(20)))).statusCode).toBe(201);
    expect(subscriber.messages).toHaveLength(1);
  });

  it('closes with 4404 for an unknown match', async () => {
    const subscriber = await subscribe('nope');
    await vi.waitFor(() => expect(subscriber.closeCode).toBe(MATCH_NOT_FOUND_CLOSE_CODE));
    expect(subscriber.messages).toEqual([]);
  });
});
