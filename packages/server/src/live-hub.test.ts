import { describe, expect, it, vi, type Mock } from 'vitest';
import { LIVE_MAX_BUFFERED_BYTES, createLiveHub, sendTo, type LiveSocket } from './live-hub.js';

function socket(readyState = 1, bufferedAmount = 0): LiveSocket & { sent: string[]; terminate: Mock<() => void> } {
  const sent: string[] = [];
  return { readyState, bufferedAmount, sent, send: (data) => void sent.push(data), terminate: vi.fn<() => void>() };
}

describe('createLiveHub', () => {
  const message = { type: 'throw_undone', matchId: 'm1', eventSeq: 1, throwId: 't1' } as const;

  it('publishes only to open subscribers of the match', () => {
    const hub = createLiveHub();
    const open = socket();
    const closing = socket(2);
    const other = socket();
    hub.subscribe('m1', open);
    hub.subscribe('m1', closing);
    hub.subscribe('m2', other);
    hub.publish('m1', [message]);
    expect(open.sent).toEqual([JSON.stringify(message)]);
    expect(closing.sent).toEqual([]);
    expect(other.sent).toEqual([]);
  });

  it('stops publishing after unsubscribe', () => {
    const hub = createLiveHub();
    const subscriber = socket();
    const unsubscribe = hub.subscribe('m1', subscriber);
    unsubscribe();
    hub.publish('m1', [message]);
    expect(subscriber.sent).toEqual([]);
  });

  it('terminates a subscriber with more than LIVE_MAX_BUFFERED_BYTES unsent', () => {
    const hub = createLiveHub();
    const slow = socket(1, LIVE_MAX_BUFFERED_BYTES + 1);
    hub.subscribe('m1', slow);
    hub.publish('m1', [message]);
    sendTo(slow, [message]);
    expect(slow.sent).toEqual([]);
    expect(slow.terminate).toHaveBeenCalled();
  });

  it('keeps sending to a subscriber at exactly LIVE_MAX_BUFFERED_BYTES unsent', () => {
    const hub = createLiveHub();
    const busy = socket(1, LIVE_MAX_BUFFERED_BYTES);
    hub.subscribe('m1', busy);
    hub.publish('m1', [message]);
    sendTo(busy, [message]);
    expect(busy.sent).toEqual([JSON.stringify(message), JSON.stringify(message)]);
    expect(busy.terminate).not.toHaveBeenCalled();
  });
});
