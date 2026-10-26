import { LiveMessage } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { abandon, createGame, createPlayer, createPlayers, D, hitEvent, MISS, postThrow, S, setup, T, throwDarts, undo, type Dart, type TestApp } from '../test-helpers.js';

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  terminate(): void;
}

interface Subscriber {
  readonly messages: unknown[];
}

let t: TestApp;
let anna: string;
let bartek: string;
const sockets: TestSocket[] = [];
beforeEach(async () => {
  t = await setup();
  [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];
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
  const socket: TestSocket = await t.app.injectWS(`/matches/${matchId}/live`, {}, {
    onInit(ws: TestSocket) {
      ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
    },
  });
  sockets.push(socket);
  return { messages };
}

async function received(subscriber: Subscriber, count: number): Promise<LiveMessage[]> {
  await vi.waitFor(() => expect(subscriber.messages.length).toBeGreaterThanOrEqual(count));
  return subscriber.messages.map((message) => LiveMessage.parse(message));
}

// Pierwszy gracz wygrywa 301 w 15 rzutkach turami po 60 i zamknięciem 61, drugi pudłuje.
// Rekordy pierwszego to tura 61, zamknięcie 61, leg w 15 rzutkach, więc późniejszy mecz łatwo je pobije.
const REFERENCE_LEG: readonly Dart[] = [
  ...Array.from({ length: 4 }, (): Dart[] => [S(20), S(20), S(20), MISS, MISS, MISS]).flat(),
  S(1),
  S(20),
  D(20),
];
const TON: readonly Dart[] = [T(20), S(20), S(20)];

function match301(playerIds: readonly string[]) {
  return createGame(t.app, { type: 'match', playerIds, startingScore: 301, bestOf: 1 });
}

async function finishedMatch(playerIds: readonly string[]): Promise<string> {
  const { id } = await match301(playerIds);
  await throwDarts(t.app, id, REFERENCE_LEG);
  return id;
}

// Rzuca i zwraca wszystkie wiadomości po snapshocie z chwili połączenia.
async function liveDarts(matchId: string, darts: readonly Dart[]): Promise<LiveMessage[]> {
  const subscriber = await subscribe(matchId);
  await received(subscriber, 1);
  const before = subscriber.messages.length;
  await throwDarts(t.app, matchId, darts);
  // Każda rzutka kończy się state_updated, więc czekamy na tyle state_updated, ile było rzutek.
  await vi.waitFor(() => expect(subscriber.messages.slice(before).filter((message) => (message as LiveMessage).type === 'state_updated')).toHaveLength(darts.length));
  return (await received(subscriber, before)).slice(1);
}

function achievementsIn(messages: readonly LiveMessage[]) {
  return messages.filter((message) => message.type === 'achievement');
}

describe('achievement live messages', () => {
  it('sends nothing in the first 1v1 game of a profile', async () => {
    const { id } = await match301([anna, bartek]);
    expect(achievementsIn(await liveDarts(id, REFERENCE_LEG))).toEqual([]);
  });

  it('sends achievements in the second game between the domain events and state_updated', async () => {
    await finishedMatch([anna, bartek]);
    const { id } = await match301([anna, bartek]);
    await throwDarts(t.app, id, TON.slice(0, -1));
    const subscriber = await subscribe(id);
    await received(subscriber, 1);

    expect((await postThrow(t.app, id, hitEvent(id, S(20)))).statusCode).toBe(201);
    const messages = (await received(subscriber, 6)).slice(1);
    expect(messages.map((message) => message.type)).toEqual(['throw_registered', 'turn_completed', 'achievement', 'achievement', 'state_updated']);
    expect(messages.every((message) => message.matchId === id && message.eventSeq === 3)).toBe(true);
    expect(achievementsIn(messages)).toEqual([
      { type: 'achievement', matchId: id, eventSeq: 3, playerId: anna, kind: 'first_100', value: 100, previous: null },
      { type: 'achievement', matchId: id, eventSeq: 3, playerId: anna, kind: 'turn_record', value: 100, previous: 61 },
    ]);
  });

  it('keeps achievements out of the HTTP throw response', async () => {
    await finishedMatch([anna, bartek]);
    const { id } = await match301([anna, bartek]);
    const [, , last] = await throwDarts(t.app, id, TON);
    expect(Object.keys(last).sort()).toEqual(['events', 'state', 'throw']);
    expect(last.events.map((event: { type: string }) => event.type)).toEqual(['turn_completed']);
  });

  it('sends nothing to a guest', async () => {
    const guest = await createPlayer(t.app, 'Gość', { guest: true });
    const other = await createPlayer(t.app, 'Gość 2', { guest: true });
    await finishedMatch([guest.id, other.id]);
    const { id } = await match301([guest.id, other.id]);
    expect(achievementsIn(await liveDarts(id, [...TON, MISS, MISS, MISS, ...TON]))).toEqual([]);
  });

  it.each([
    ['a casual game', (players: readonly string[]) => ({ type: 'casual', playerIds: players, startingScore: 301 })],
    ['Solo 501', ([first]: readonly string[]) => ({ type: 'practice', practiceMode: 'solo_501', playerIds: [first] })],
    ['Free run', ([first]: readonly string[]) => ({ type: 'practice', practiceMode: 'free_run', playerIds: [first] })],
  ])('sends nothing in %s', async (_name, payload) => {
    await finishedMatch([anna, bartek]);
    const { id } = await createGame(t.app, payload([anna, bartek]));
    expect(achievementsIn(await liveDarts(id, [T(20), T(20), T(20)]))).toEqual([]);
  });

  it('does not count an abandoned 1v1 match', async () => {
    const abandoned = await match301([anna, bartek]);
    await throwDarts(t.app, abandoned.id, REFERENCE_LEG.slice(0, 6));
    expect((await abandon(t.app, abandoned.id, { playerId: bartek })).statusCode).toBe(200);

    const { id } = await match301([anna, bartek]);
    expect(achievementsIn(await liveDarts(id, TON))).toEqual([]);
  });

  it('picks up a 1v1 match finished after the reference was cached', async () => {
    const { id } = await match301([anna, bartek]);
    expect(achievementsIn(await liveDarts(id, [S(10), S(10), S(10), MISS, MISS, MISS]))).toEqual([]);

    await finishedMatch([anna, bartek]);
    expect(achievementsIn(await liveDarts(id, TON)).map(({ kind }) => kind)).toEqual(['first_100', 'turn_record']);
  });

  it('drops a 1v1 match that an undo reopens after the reference was cached', async () => {
    const reference = await finishedMatch([anna, bartek]);
    const { id } = await match301([anna, bartek]);
    expect(achievementsIn(await liveDarts(id, [S(10), S(10), S(10), MISS, MISS, MISS]))).toEqual([]);

    expect((await undo(t.app, reference)).statusCode).toBe(200);
    expect(achievementsIn(await liveDarts(id, TON))).toEqual([]);
  });
});
