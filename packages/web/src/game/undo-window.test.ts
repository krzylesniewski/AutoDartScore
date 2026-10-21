import { describe, expect, it } from 'vitest';
import { formatCountdown, undoWindow } from './undo-window';

const UNTIL = '2026-10-21T20:05:00.000Z';
const until = Date.parse(UNTIL);

describe('undoWindow', () => {
  it('counts down in a finished game before editableUntil', () => {
    expect(undoWindow({ finished: true, editableUntil: UNTIL }, until - 252_000)).toEqual({ locked: false, secondsLeft: 252 });
    expect(undoWindow({ finished: true, editableUntil: UNTIL }, until - 251_500)).toEqual({ locked: false, secondsLeft: 252 });
  });

  it('still counts one millisecond before editableUntil', () => {
    expect(undoWindow({ finished: true, editableUntil: UNTIL }, until - 1)).toEqual({ locked: false, secondsLeft: 1 });
  });

  it('locks at editableUntil and after it', () => {
    expect(undoWindow({ finished: true, editableUntil: UNTIL }, until)).toEqual({ locked: true, secondsLeft: null });
    expect(undoWindow({ finished: true, editableUntil: UNTIL }, until + 60_000)).toEqual({ locked: true, secondsLeft: null });
  });

  it('gives a plain undo without editableUntil or in a game in progress', () => {
    expect(undoWindow({ finished: true, editableUntil: null }, until)).toEqual({ locked: false, secondsLeft: null });
    expect(undoWindow({ finished: false, editableUntil: null }, until)).toEqual({ locked: false, secondsLeft: null });
    expect(undoWindow({ finished: false, editableUntil: UNTIL }, until)).toEqual({ locked: false, secondsLeft: null });
  });
});

describe('formatCountdown', () => {
  it.each([
    [252, '4:12'],
    [1, '0:01'],
    [59, '0:59'],
    [300, '5:00'],
    [3600, '60:00'],
  ])('formats %i seconds as %s', (seconds, text) => {
    expect(formatCountdown(seconds)).toBe(text);
  });
});
