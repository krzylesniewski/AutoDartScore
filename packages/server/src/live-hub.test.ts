import { describe, expect, it } from 'vitest';
import { createLiveHub, type LiveSocket } from './live-hub.js';

function socket(readyState = 1): LiveSocket & { sent: string[] } {
  const sent: string[] = [];
  return { readyState, sent, send: (data) => void sent.push(data) };
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
});
