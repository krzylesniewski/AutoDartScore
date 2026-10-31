import { describe, expect, it } from 'vitest';
import type { Detection } from './detector.js';
import { formatReport, hitLabel, isPending, scoreEvent, summarize } from './evaluation.js';
import type { EventResult } from './evaluation.js';
import type { ExpectedEvent } from './fixtures.js';

const S20: ExpectedEvent = { kind: 'dart', segment: 20, multiplier: 1 };
const NONE: ExpectedEvent = { kind: 'none' };
const REMOVAL: ExpectedEvent = { kind: 'removal' };

function dart(segment: number, multiplier: 0 | 1 | 2 | 3, confidence = 0.95): Detection {
  return { kind: 'dart', hit: { segment, multiplier }, confidence, candidates: [] };
}

const UNREAD: Detection = { kind: 'dart', hit: null, confidence: 0.99, candidates: [] };
const CALIBRATED = { calibrated: true, threshold: 0.8 };
const UNCALIBRATED = { calibrated: false, threshold: 0.8 };

describe('isPending', () => {
  it('is true for a dart without a reading, whatever its confidence', () => {
    expect(isPending(UNREAD, 0.8)).toBe(true);
  });

  it('is true for a dart below the threshold and false at it', () => {
    expect(isPending(dart(20, 1, 0.79), 0.8)).toBe(true);
    expect(isPending(dart(20, 1, 0.8), 0.8)).toBe(false);
  });

  it('is false for removal and none', () => {
    expect(isPending({ kind: 'removal' }, 0.8)).toBe(false);
    expect(isPending({ kind: 'none' }, 0.8)).toBe(false);
  });
});

describe('scoreEvent', () => {
  it.each([
    ['none', NONE, { kind: 'none' }, 'correct'],
    ['none', NONE, { kind: 'removal' }, 'wrong'],
    ['none', NONE, UNREAD, 'wrong'],
    ['removal', REMOVAL, { kind: 'removal' }, 'correct'],
    ['removal', REMOVAL, dart(20, 1, 0.1), 'wrong'],
    ['dart', S20, { kind: 'none' }, 'wrong'],
    ['dart', S20, { kind: 'removal' }, 'wrong'],
  ] as const)('expected %s, detected %j gives %s', (_, expected, detection, outcome) => {
    expect(scoreEvent(expected, detection, CALIBRATED)).toBe(outcome);
  });

  it('counts a dart without a reading as pending', () => {
    expect(scoreEvent(S20, UNREAD, CALIBRATED)).toBe('pending');
    expect(scoreEvent(S20, UNREAD, UNCALIBRATED)).toBe('pending');
  });

  it('counts a dart below the threshold as pending, even with the right hit', () => {
    expect(scoreEvent(S20, dart(20, 1, 0.5), CALIBRATED)).toBe('pending');
  });

  it('compares a confident dart with the label in a calibrated session', () => {
    expect(scoreEvent(S20, dart(20, 1), CALIBRATED)).toBe('correct');
    expect(scoreEvent(S20, dart(20, 3), CALIBRATED)).toBe('wrong');
    expect(scoreEvent(S20, dart(5, 1), CALIBRATED)).toBe('wrong');
  });

  it('leaves a confident dart unscored in an uncalibrated session', () => {
    expect(scoreEvent(S20, dart(20, 1), UNCALIBRATED)).toBe('unscored');
    expect(scoreEvent(S20, dart(5, 1), UNCALIBRATED)).toBe('unscored');
  });
});

describe('hitLabel', () => {
  it.each([
    [0, 0, 'Miss'],
    [25, 1, '25'],
    [25, 2, 'Bull'],
    [20, 1, 'S20'],
    [16, 2, 'D16'],
    [19, 3, 'T19'],
  ] as const)('%i×%i is %s', (segment, multiplier, label) => {
    expect(hitLabel({ segment, multiplier })).toBe(label);
  });
});

describe('summarize and formatReport', () => {
  const T19: ExpectedEvent = { kind: 'dart', segment: 19, multiplier: 3 };
  const results: EventResult[] = [
    // Sesje podane w odwrotnej kolejności: raport sortuje je po nazwie.
    { session: 'session-b', calibrated: false, id: '01', expected: S20, detection: dart(20, 1) },
    { session: 'session-b', calibrated: false, id: '02', expected: S20, detection: { kind: 'none' } },
    { session: 'session-b', calibrated: false, id: '03', expected: REMOVAL, detection: UNREAD },
    { session: 'session-a', calibrated: true, id: '01', expected: S20, detection: dart(20, 1) },
    { session: 'session-a', calibrated: true, id: '02', expected: S20, detection: dart(20, 1, 0.4) },
    { session: 'session-a', calibrated: true, id: '03', expected: T19, detection: UNREAD },
    { session: 'session-a', calibrated: true, id: '04', expected: T19, detection: dart(7, 3) },
    { session: 'session-a', calibrated: true, id: '05', expected: NONE, detection: { kind: 'none' } },
  ];
  const report = summarize(results, { detector: 'fake', threshold: 0.8 });

  it('counts totals and sessions sorted by name', () => {
    expect(report.detector).toBe('fake');
    expect(report.threshold).toBe(0.8);
    expect(report.totals).toEqual({ events: 8, correct: 2, pending: 2, wrong: 3, unscored: 1 });
    expect(report.sessions).toEqual([
      { name: 'session-a', calibrated: true, events: 5, correct: 2, pending: 2, wrong: 1, unscored: 0 },
      { name: 'session-b', calibrated: false, events: 3, correct: 0, pending: 0, wrong: 2, unscored: 1 },
    ]);
  });

  it('keeps file order within a session', () => {
    expect(report.events.map(({ session, id, outcome }) => `${session}/${id} ${outcome}`)).toEqual([
      'session-a/01 correct',
      'session-a/02 pending',
      'session-a/03 pending',
      'session-a/04 wrong',
      'session-a/05 correct',
      'session-b/01 unscored',
      'session-b/02 wrong',
      'session-b/03 wrong',
    ]);
  });

  it('counts kinds in the order dart, removal, none with zeros', () => {
    expect(Object.keys(report.kinds)).toEqual(['dart', 'removal', 'none']);
    expect(report.kinds).toEqual({
      dart: { expected: 6, correct: 5, detectedAs: { dart: 5, removal: 0, none: 1 } },
      removal: { expected: 1, correct: 0, detectedAs: { dart: 1, removal: 0, none: 0 } },
      none: { expected: 1, correct: 1, detectedAs: { dart: 0, removal: 0, none: 1 } },
    });
  });

  it('scores hits of calibrated sessions only and counts skipped darts', () => {
    expect(report.hits).toEqual({
      scored: 4,
      correct: 1,
      pending: 2,
      wrong: 1,
      skippedNoCalibration: 2,
      byHit: {
        S20: { expected: 2, correct: 1, pending: 1, wrong: 0 },
        T19: { expected: 2, correct: 0, pending: 1, wrong: 1 },
      },
    });
  });

  it('formats the summary in Polish', () => {
    expect(formatReport(report)).toBe(
      [
        'Detektor: fake, próg pewności 0.8',
        'Ogółem (8 zdarzeń): poprawne 2, do potwierdzenia 2, błędne 3, bez oceny 1',
        'session-a (z kalibracją): poprawne 2, do potwierdzenia 2, błędne 1',
        'session-b (bez kalibracji): poprawne 0, do potwierdzenia 0, błędne 2, bez oceny 1',
        'Rodzaj zdarzenia:',
        '  dart     5/6   (dart 5, none 1)',
        '  removal  0/1   (dart 1)',
        '  none     1/1   (none 1)',
        'Trafienia (4 lotki z kalibracją): poprawne 1, do potwierdzenia 2, błędne 1',
        '  S20   1/2   (do potwierdzenia 1, błędne 0)',
        '  T19   0/2   (do potwierdzenia 1, błędne 1)',
        '  bez kalibracji: 2 lotki bez oceny trafienia',
      ].join('\n'),
    );
  });

  it('formats a report without calibrated sessions', () => {
    const uncalibrated = summarize(
      results.filter((r) => !r.calibrated),
      { detector: 'fake', threshold: 0.5 },
    );
    expect(formatReport(uncalibrated)).toContain('Trafienia: brak sesji z kalibracją, 2 lotki bez oceny trafienia');
    expect(formatReport(summarize([results[2] as EventResult], { detector: 'fake', threshold: 0.5 }))).toContain(
      'Ogółem (1 zdarzenie): poprawne 0, do potwierdzenia 0, błędne 1\n',
    );
  });
});
