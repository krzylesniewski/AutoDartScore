import type { AchievementKind, LiveMessage, MatchSnapshot } from '@autoscore/schema';
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
    this.calls.push(`speak:${announcement.parts.map((part) => `${part.clip ?? ''}|${part.text}`).join(' + ')}`);
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

const achievement = (eventSeq: number, kind: AchievementKind): LiveMessage => ({
  type: 'achievement',
  matchId: MATCH_ID,
  eventSeq,
  playerId: 'anna',
  kind,
  value: 140,
  previous: kind.startsWith('first_') ? null : 100,
});

const reviewedThrow = (status: 'confirmed' | 'pending') => ({
  id: 't_5',
  sequence: 5,
  source: 'camera-1',
  confidence: 0.5,
  reading: { segment: 20, multiplier: 3 } as const,
  value: { segment: 20, multiplier: 3 } as const,
  status,
  scoring: status === 'pending' ? ('waiting' as const) : ('counted' as const),
  review: { reason: 'low_confidence' as const, flaggedBy: 'system' as const, candidates: [], resolved: null },
});
const throwFlagged = (eventSeq: number): LiveMessage => ({ type: 'throw_flagged', matchId: MATCH_ID, eventSeq, throw: reviewedThrow('pending') });
const throwVerified = (eventSeq: number): LiveMessage => ({ type: 'throw_verified', matchId: MATCH_ID, eventSeq, throw: reviewedThrow('confirmed') });

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

  it('speaks the achievement parts after the main part', () => {
    send([throwRegistered(5), turnCompleted(5, 140), achievement(5, 'first_140'), achievement(5, 'turn_record'), stateUpdated(5)]);
    expect(speaker.calls).toEqual([
      'cancel',
      'speak:scores/140.mp3|sto czterdzieści + events/first_140.mp3|Pierwsze sto czterdzieści + events/achievement_turn_record.mp3|Nowy rekord tury',
    ]);
  });

  it('speaks the zero comment after zero', () => {
    announcer = createAnnouncer(speaker, undefined, firstVariant, { zeroComments: () => true });
    send(turnBatch(5, 0));
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/0.mp3|zero + events/zero_1.mp3|Tarcza wisi trochę wyżej']);
  });

  it('speaks only zero without options', () => {
    send(turnBatch(5, 0));
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/0.mp3|zero']);
  });

  it('reads the zeroComments getter at each flush', () => {
    let zeroComments = false;
    announcer = createAnnouncer(speaker, undefined, firstVariant, { zeroComments: () => zeroComments });
    send(turnBatch(5, 0));
    zeroComments = true;
    send(turnBatch(6, 0));
    expect(speaker.calls).toEqual([
      'cancel',
      'speak:scores/0.mp3|zero',
      'cancel',
      'speak:scores/0.mp3|zero + events/zero_1.mp3|Tarcza wisi trochę wyżej',
    ]);
  });

  it('drops an achievement with another eventSeq', () => {
    send([achievement(4, 'turn_record'), throwRegistered(5), turnCompleted(5, 100), achievement(6, 'checkout_record'), stateUpdated(5)]);
    expect(speaker.calls).toEqual([]);
    send(turnBatch(7, 100));
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/100.mp3|sto']);
  });

  it('drops achievements buffered before an event with another eventSeq', () => {
    send([achievement(4, 'turn_record'), throwRegistered(5), turnCompleted(5, 100), stateUpdated(5)]);
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/100.mp3|sto']);
  });

  it('cancels the running announcement on throw_undone', () => {
    send([turnCompleted(5, 140), achievement(5, 'turn_record'), stateUpdated(5)]);
    announcer.handle({ type: 'throw_undone', matchId: MATCH_ID, eventSeq: 6, throwId: 't_5' });
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/140.mp3|sto czterdzieści + events/achievement_turn_record.mp3|Nowy rekord tury', 'cancel']);
  });

  it('does not cancel the running announcement on a later state_updated without an announcement', () => {
    send([turnCompleted(5, 140), achievement(5, 'turn_record'), stateUpdated(5)]);
    send([throwRegistered(6), stateUpdated(6)]);
    send([throwRegistered(7), stateUpdated(7)]);
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/140.mp3|sto czterdzieści + events/achievement_turn_record.mp3|Nowy rekord tury']);
  });

  it('cancels and drops the buffer on throw_undone', () => {
    announcer.handle(turnCompleted(5, 100));
    announcer.handle({ type: 'throw_undone', matchId: MATCH_ID, eventSeq: 6, throwId: 't_5' });
    expect(speaker.calls).toEqual(['cancel']);
    announcer.handle(stateUpdated(5));
    expect(speaker.calls).toEqual(['cancel']);
  });

  it('stays silent on throw_flagged and throw_verified alone', () => {
    send([throwRegistered(5), throwFlagged(5), stateUpdated(5)]);
    send([throwFlagged(6), stateUpdated(6)]);
    send([throwVerified(7), stateUpdated(7)]);
    expect(speaker.calls).toEqual([]);
  });

  it('does not cancel the running announcement on throw_flagged', () => {
    send(turnBatch(5, 100));
    send([throwFlagged(6), stateUpdated(6)]);
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/100.mp3|sto']);
  });

  it('speaks the turn once after a verification', () => {
    send([throwVerified(7), turnCompleted(7, 140)]);
    expect(speaker.calls).toEqual([]);
    announcer.handle(stateUpdated(7));
    expect(speaker.calls).toEqual(['cancel', 'speak:scores/140.mp3|sto czterdzieści']);
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
