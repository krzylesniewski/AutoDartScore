import { describe, expect, it } from 'vitest';
import { activityDay, formatActivity, formatClock } from './activity-date';

const now = new Date(2026, 9, 18, 19, 30);

function iso(year: number, month: number, day: number, hour = 12, minute = 0): string {
  return new Date(year, month, day, hour, minute).toISOString();
}

describe('formatActivity', () => {
  it('shows the time for today', () => {
    expect(formatActivity(iso(2026, 9, 18, 8, 5), now)).toBe('dziś 08:05');
    expect(formatActivity(iso(2026, 9, 18, 0, 0), now)).toBe('dziś 00:00');
  });

  it('shows wczoraj for the previous day', () => {
    expect(formatActivity(iso(2026, 9, 17, 23, 59), now)).toBe('wczoraj');
    expect(formatActivity(iso(2026, 9, 17, 0, 0), now)).toBe('wczoraj');
  });

  it('crosses a month and a year for wczoraj', () => {
    expect(formatActivity(iso(2026, 8, 30), new Date(2026, 9, 1, 10))).toBe('wczoraj');
    expect(formatActivity(iso(2025, 11, 31), new Date(2026, 0, 1, 10))).toBe('wczoraj');
  });

  it('shows the day and month earlier in the same year', () => {
    expect(formatActivity(iso(2026, 9, 16), now)).toBe('16.10');
    expect(formatActivity(iso(2026, 0, 2), now)).toBe('02.01');
  });

  it('adds the year for another year', () => {
    expect(formatActivity(iso(2025, 9, 18), now)).toBe('18.10.2025');
  });
});

describe('formatClock', () => {
  it('pads the local hours and minutes', () => {
    expect(formatClock(iso(2026, 9, 18, 8, 5))).toBe('08:05');
    expect(formatClock(iso(2026, 9, 18, 0, 0))).toBe('00:00');
  });
});

describe('activityDay', () => {
  it('shows Dziś for today', () => {
    expect(activityDay(iso(2026, 9, 18, 0, 0), now)).toBe('Dziś');
    expect(activityDay(iso(2026, 9, 18, 19, 29), now)).toBe('Dziś');
  });

  it('shows Wczoraj for the previous day', () => {
    expect(activityDay(iso(2026, 9, 17, 23, 59), now)).toBe('Wczoraj');
    expect(activityDay(iso(2026, 9, 17, 0, 0), now)).toBe('Wczoraj');
  });

  it('crosses a month and a year for Wczoraj', () => {
    expect(activityDay(iso(2026, 8, 30), new Date(2026, 9, 1, 10))).toBe('Wczoraj');
    expect(activityDay(iso(2025, 11, 31), new Date(2026, 0, 1, 10))).toBe('Wczoraj');
  });

  it('shows the day and month earlier in the same year', () => {
    expect(activityDay(iso(2026, 9, 16), now)).toBe('16.10');
    expect(activityDay(iso(2026, 0, 2), now)).toBe('02.01');
  });

  it('adds the year for another year', () => {
    expect(activityDay(iso(2025, 9, 18), now)).toBe('18.10.2025');
  });
});
