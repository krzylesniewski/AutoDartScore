import type { LiveMessage, MatchSnapshot } from '@autoscore/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAnnouncer, type Announcement, type Announcer, type Speaker } from './index.js';
import { afterEach, vi } from 'vitest';
import type { EffectPlayer, SoundEffect } from './index.js';

const MATCH_ID = 'm_1';
// Stały wybór wariantu, żeby nagrania bust i zwycięzcy były przewidywalne.
const firstVariant = () => 0;

class FakeSpeaker implements Speaker {
  calls: string[] = [];

  speak(announcement: Announcement): void {
    this.calls.push(`speak:${announcement.clip ?? ''}|${announcement.text}`);
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
  announcer = createAnnouncer(speaker, undefined, firstVariant);
});

describe('createAnnouncer', () => {
  it('speaks a full throw batch once, after state_updated', () => {
    announcer.handle(throwRegistered(5));
    announcer.handle(turnCompleted(5, 100));
    expect(speaker.calls).toEqual([]);
    announcer.handle(stateUpdated(5));
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/100.mp3|sto']);
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
    expect(speaker.calls).toEqual(['cancel', 'speak:events/bust_1.mp3|Bust']);
  });

  it('speaks the same with an achievement in the batch', () => {
    const achievement: LiveMessage = { type: 'achievement', matchId: MATCH_ID, eventSeq: 5, playerId: 'anna', kind: 'turn_record', value: 100, previous: 60 };
    send([turnCompleted(5, 100), achievement, stateUpdated(5)]);
    const withAchievement = speaker.calls;
    speaker = new FakeSpeaker();
    announcer = createAnnouncer(speaker, undefined, firstVariant);
    send([turnCompleted(5, 100), stateUpdated(5)]);
    expect(withAchievement).toEqual(speaker.calls);
    expect(withAchievement).toEqual(['cancel', 'speak:scores/100.mp3|sto']);
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
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/100.mp3|sto', 'cancel', 'speak:events/bust_1.mp3|Bust']);
  });

  it('passes the injected random to the clip choice', () => {
    announcer = createAnnouncer(speaker, undefined, () => 0.999);
    send([throwRegistered(5), bust(5), stateUpdated(5)]);
    expect(speaker.calls).toEqual(['cancel', 'speak:events/bust_3.mp3|Bust']);
  });

  it('cancels on stop and still speaks a batch handled after it', () => {
    announcer.handle(turnCompleted(5, 100));
    announcer.stop();
    expect(speaker.calls).toEqual(['cancel']);
    announcer.handle(stateUpdated(5));
    expect(speaker.calls).toEqual(['cancel']);
    send(turnBatch(6, 45));
    expect(speaker.calls).toEqual(['cancel', 'cancel', 'speak:scores/45.mp3|czterdzieści pięć']);
  });
});

class FakeEffectPlayer implements EffectPlayer {
  calls: string[] = [];

  constructor(private readonly durationMs: number) {}

  play(effect: SoundEffect): number {
    this.calls.push(`play:${effect}`);
    return this.durationMs;
  }

  stop(): void {
    this.calls.push('stop');
  }
}

const EFFECT_MS = 500;

const legWon = (eventSeq: number): LiveMessage => ({ type: 'leg_won', matchId: MATCH_ID, eventSeq, playerId: 'anna', legIndex: 0, checkout: 40, dartsThrown: 15 });
const matchWon = (eventSeq: number): LiveMessage => ({ type: 'match_won', matchId: MATCH_ID, eventSeq, playerId: 'anna', legsWon: { anna: 2, bartek: 0 } });
const bustBatch = (eventSeq: number): LiveMessage[] => [throwRegistered(eventSeq), bust(eventSeq), stateUpdated(eventSeq)];

describe('createAnnouncer with effects', () => {
  let effects: FakeEffectPlayer;

  beforeEach(() => {
    vi.useFakeTimers();
    effects = new FakeEffectPlayer(EFFECT_MS);
    announcer = createAnnouncer(speaker, effects, firstVariant);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays the effect first and speaks after it ends', () => {
    send(bustBatch(5));
    expect(effects.calls).toEqual(['stop', 'play:bust']);
    expect(speaker.calls).toEqual(['cancel']);
    vi.advanceTimersByTime(EFFECT_MS - 1);
    expect(speaker.calls).toEqual(['cancel']);
    vi.advanceTimersByTime(1);
    expect(speaker.calls).toEqual(['cancel', 'speak:events/bust_1.mp3|Bust']);
  });

  it('plays the long fanfare before Zwycięzca', () => {
    send([throwRegistered(5), turnCompleted(5, 40), legWon(5), matchWon(5), stateUpdated(5)]);
    expect(effects.calls).toEqual(['stop', 'play:fanfare_long']);
    vi.advanceTimersByTime(EFFECT_MS);
    expect(speaker.calls).toEqual(['cancel', 'speak:events/winner_1.mp3|Zwycięzca']);
  });

  it('plays no effect on a plain turn and speaks at once', () => {
    send(turnBatch(5, 100));
    expect(effects.calls).toEqual(['stop']);
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/100.mp3|sto']);
  });

  it('speaks at once when the player returns 0', () => {
    announcer = createAnnouncer(speaker, new FakeEffectPlayer(0), firstVariant);
    send(bustBatch(5));
    expect(speaker.calls).toEqual(['cancel', 'speak:events/bust_1.mp3|Bust']);
  });

  it('stops the effect and drops the pending speech on throw_undone', () => {
    send(bustBatch(5));
    announcer.handle({ type: 'throw_undone', matchId: MATCH_ID, eventSeq: 6, throwId: 't_5' });
    expect(effects.calls).toEqual(['stop', 'play:bust', 'stop']);
    vi.advanceTimersByTime(EFFECT_MS * 2);
    expect(speaker.calls).toEqual(['cancel', 'cancel']);
  });

  it('stops the effect and drops the pending speech on stop', () => {
    send(bustBatch(5));
    announcer.stop();
    expect(effects.calls).toEqual(['stop', 'play:bust', 'stop']);
    vi.advanceTimersByTime(EFFECT_MS * 2);
    expect(speaker.calls).toEqual(['cancel', 'cancel']);
  });

  it('cancels the pending speech and effect when the next announcement arrives', () => {
    send(bustBatch(5));
    vi.advanceTimersByTime(EFFECT_MS / 2);
    send(turnBatch(6, 45));
    expect(effects.calls).toEqual(['stop', 'play:bust', 'stop']);
    expect(speaker.calls).toEqual(['cancel', 'cancel', 'speak:scores/45.mp3|czterdzieści pięć']);
    vi.advanceTimersByTime(EFFECT_MS * 2);
    expect(speaker.calls).toEqual(['cancel', 'cancel', 'speak:scores/45.mp3|czterdzieści pięć']);
  });

  it('keeps the pending speech and effect through a mid-turn batch', () => {
    send(bustBatch(5));
    send([throwRegistered(6), stateUpdated(6)]);
    expect(effects.calls).toEqual(['stop', 'play:bust']);
    vi.advanceTimersByTime(EFFECT_MS);
    expect(speaker.calls).toEqual(['cancel', 'speak:events/bust_1.mp3|Bust']);
  });
});
