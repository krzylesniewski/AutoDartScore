import { describe, expect, it } from 'vitest';
import { snapshot } from '../test/snapshots';
import { durationSeconds, formatDuration, gameElapsedMs, legElapsedMs, spokenDuration } from './leg-clock';

const START = '2026-10-21T18:00:00.000Z';
const at = (seconds: number) => Date.parse(START) + seconds * 1000;
const iso = (seconds: number) => new Date(at(seconds)).toISOString();

describe('legElapsedMs', () => {
  it('is 0 before the first dart of the leg', () => {
    expect(legElapsedMs(snapshot({ legStartedAt: null }), at(100))).toBe(0);
  });

  it('runs on the device clock in a game in progress and leaves out the pauses', () => {
    expect(legElapsedMs(snapshot({ legStartedAt: START }), at(41))).toBe(41_000);
    expect(legElapsedMs(snapshot({ legStartedAt: START, legPausedMs: 30_000 }), at(100))).toBe(70_000);
  });

  it('stops at the abandonment', () => {
    const state = snapshot({ status: 'abandoned', abandonment: { playerId: 'p1', reason: null, at: iso(60) }, legStartedAt: START, legPausedMs: 10_000 });
    expect(legElapsedMs(state, at(500))).toBe(50_000);
  });

  it('stops at the end of a practice', () => {
    const state = snapshot({ type: 'practice', practiceMode: 'free_run', status: 'ended', endedAt: iso(90), legStartedAt: START });
    expect(legElapsedMs(state, at(500))).toBe(90_000);
  });

  it('stops at the finishing dart', () => {
    expect(legElapsedMs(snapshot({ finished: true, finishedAt: iso(75), legStartedAt: START }), at(500))).toBe(75_000);
  });

  it('is 0 when the device clock is behind the server', () => {
    expect(legElapsedMs(snapshot({ legStartedAt: START }), at(-5))).toBe(0);
  });
});

describe('gameElapsedMs', () => {
  it('is the time from the first to the finishing dart without the pauses', () => {
    expect(gameElapsedMs(snapshot({ startedAt: START, finishedAt: iso(900), pausedMs: 120_000 }))).toBe(780_000);
  });

  it('is null without a start or an end', () => {
    expect(gameElapsedMs(snapshot({ startedAt: null, finishedAt: iso(900) }))).toBeNull();
    expect(gameElapsedMs(snapshot({ startedAt: START, finishedAt: null }))).toBeNull();
  });
});

describe('durationSeconds', () => {
  it('rounds down to whole seconds', () => {
    expect(durationSeconds(41_999)).toBe(41);
    expect(durationSeconds(0)).toBe(0);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [41, '0:41'],
    [599, '9:59'],
    [600, '10:00'],
    [12 * 60 + 34, '12:34'],
    [3723, '1:02:03'],
    [36_000, '10:00:00'],
  ])('formats %i s as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe('spokenDuration', () => {
  it.each([
    [0, '0 min 0 s'],
    [41, '0 min 41 s'],
    [12 * 60 + 34, '12 min 34 s'],
    [3723, '1 godz. 2 min 3 s'],
  ])('reads %i s as %s', (seconds, text) => {
    expect(spokenDuration(seconds)).toBe(text);
  });
});
