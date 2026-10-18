import type { LiveMessage, MatchSnapshot } from '@autoscore/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAnnouncer, type Announcer, type Speaker } from './index.js';

const MATCH_ID = 'm_1';

class FakeSpeaker implements Speaker {
  calls: string[] = [];

  speak(text: string): void {
    this.calls.push(`speak:${text}`);
  }

  cancel(): void {
    this.calls.push('cancel');
  }
}

// Announcer nie zagląda do snapshotu, więc wystarczy pusta atrapa.
const state = {} as MatchSnapshot;

const stateUpdated = (eventSeq: number): LiveMessage => ({ type: 'state_updated', matchId: MATCH_ID, eventSeq, state });
const throwRegistered = (eventSeq: number): LiveMessage => ({
  type: 'throw_registered',
  matchId: MATCH_ID,
  eventSeq,
  throw: {
    id: `t_${eventSeq}`,
    eventId: `e_${eventSeq}`,
    matchId: MATCH_ID,
    source: 'keypad',
    sequence: eventSeq,
    segment: 20,
    multiplier: 3,
    confidence: 1,
    detectedAt: '2026-10-15T18:30:12.345Z',
    receivedAt: '2026-10-15T18:30:12.345Z',
  },
});
const turnCompleted = (eventSeq: number, total: number): LiveMessage => ({
  type: 'turn_completed',
  matchId: MATCH_ID,
  eventSeq,
  playerId: 'anna',
  legIndex: 0,
  turnIndex: 1,
  darts: [{ segment: 20, multiplier: 3 }],
  total,
  remaining: 301,
});
const bust = (eventSeq: number): LiveMessage => ({
  type: 'bust',
  matchId: MATCH_ID,
  eventSeq,
  playerId: 'anna',
  legIndex: 0,
  turnIndex: 1,
  darts: [{ segment: 20, multiplier: 3 }],
  remaining: 40,
});

function turnBatch(eventSeq: number, total: number): LiveMessage[] {
  return [throwRegistered(eventSeq), turnCompleted(eventSeq, total), stateUpdated(eventSeq)];
}

let speaker: FakeSpeaker;
let announcer: Announcer;

function send(messages: LiveMessage[]): void {
  for (const message of messages) {
    announcer.handle(message);
  }
}

beforeEach(() => {
  speaker = new FakeSpeaker();
  announcer = createAnnouncer(speaker);
});

describe('createAnnouncer', () => {
  it('speaks a full throw batch once, after state_updated', () => {
    announcer.handle(throwRegistered(5));
    announcer.handle(turnCompleted(5, 100));
    expect(speaker.calls).toEqual([]);
    announcer.handle(stateUpdated(5));
    expect(speaker.calls).toEqual(['cancel', 'speak:sto']);
  });

  it('stays silent on a mid-turn batch', () => {
    send([throwRegistered(5), stateUpdated(5)]);
    expect(speaker.calls).toEqual([]);
  });

  it('stays silent on a connect state_updated', () => {
    announcer.handle(stateUpdated(4));
    expect(speaker.calls).toEqual([]);
  });

  it('drops buffered events when state_updated has another eventSeq', () => {
    send([turnCompleted(5, 100), stateUpdated(6)]);
    expect(speaker.calls).toEqual([]);
    announcer.handle(stateUpdated(5));
    expect(speaker.calls).toEqual([]);
  });

  it('drops buffered events when events with another eventSeq arrive', () => {
    send([turnCompleted(5, 100), bust(6), stateUpdated(6)]);
    expect(speaker.calls).toEqual(['cancel', 'speak:Bust']);
  });

  it('cancels and drops the buffer on throw_undone', () => {
    announcer.handle(turnCompleted(5, 100));
    announcer.handle({ type: 'throw_undone', matchId: MATCH_ID, eventSeq: 6, throwId: 't_5' });
    expect(speaker.calls).toEqual(['cancel']);
    announcer.handle(stateUpdated(5));
    expect(speaker.calls).toEqual(['cancel']);
  });

  it('cancels the previous announcement before speaking the next one', () => {
    send(turnBatch(5, 100));
    send([throwRegistered(6), bust(6), stateUpdated(6)]);
    expect(speaker.calls).toEqual(['cancel', 'speak:sto', 'cancel', 'speak:Bust']);
  });

  it('cancels on stop and still speaks a batch handled after it', () => {
    announcer.handle(turnCompleted(5, 100));
    announcer.stop();
    expect(speaker.calls).toEqual(['cancel']);
    announcer.handle(stateUpdated(5));
    expect(speaker.calls).toEqual(['cancel']);
    send(turnBatch(6, 45));
    expect(speaker.calls).toEqual(['cancel', 'cancel', 'speak:czterdzieści pięć']);
  });
});
