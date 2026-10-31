import { BULL_SEGMENT, MISS_SEGMENT } from '@autoscore/schema';
import type { Hit } from '@autoscore/schema';
import type { Detection } from './detector.js';
import type { ExpectedEvent } from './fixtures.js';

// Robocza wartość z planu. Serwer dostanie własną zmienną AUTOSCORE_PENDING_CONFIDENCE.
export const DEFAULT_PENDING_CONFIDENCE = 0.8;

export type Outcome = 'correct' | 'pending' | 'wrong' | 'unscored';
export type EventKind = ExpectedEvent['kind'];

const KINDS: readonly EventKind[] = ['dart', 'removal', 'none'];
const MULTIPLIER_PREFIX: Readonly<Record<number, string>> = { 1: 'S', 2: 'D', 3: 'T' };

export interface EventResult {
  readonly session: string;
  readonly calibrated: boolean;
  readonly id: string;
  readonly expected: ExpectedEvent;
  readonly detection: Detection;
}

export interface OutcomeTotals {
  readonly events: number;
  readonly correct: number;
  readonly pending: number;
  readonly wrong: number;
  readonly unscored: number;
}

export interface SessionSummary extends OutcomeTotals {
  readonly name: string;
  readonly calibrated: boolean;
}

export interface KindSummary {
  readonly expected: number;
  readonly correct: number;
  readonly detectedAs: Readonly<Record<EventKind, number>>;
}

export interface HitCounts {
  readonly expected: number;
  readonly correct: number;
  readonly pending: number;
  readonly wrong: number;
}

// scored, correct, pending, wrong i byHit liczą tylko lotki z sesji z kalibracją.
export interface HitSummary {
  readonly scored: number;
  readonly correct: number;
  readonly pending: number;
  readonly wrong: number;
  readonly skippedNoCalibration: number;
  readonly byHit: Readonly<Record<string, HitCounts>>;
}

export interface EventReport {
  readonly session: string;
  readonly id: string;
  readonly expected: ExpectedEvent;
  readonly detection: Detection;
  readonly outcome: Outcome;
}

// Bez znaczników czasu i ścieżek, żeby dwa przebiegi na tym samym kodzie dały identyczny JSON.
export interface EvaluationReport {
  readonly detector: string;
  readonly threshold: number;
  readonly totals: OutcomeTotals;
  readonly sessions: readonly SessionSummary[];
  readonly kinds: Readonly<Record<EventKind, KindSummary>>;
  readonly hits: HitSummary;
  readonly events: readonly EventReport[];
}

export interface ScoreContext {
  readonly calibrated: boolean;
  readonly threshold: number;
}

export function isPending(detection: Detection, threshold: number): boolean {
  return detection.kind === 'dart' && (detection.hit === null || detection.confidence < threshold);
}

// Trafienie oceniamy tylko z kalibracją. Bez niej pewna lotka nie ma z czym się porównać.
export function scoreEvent(expected: ExpectedEvent, detection: Detection, context: ScoreContext): Outcome {
  if (expected.kind !== 'dart') {
    return detection.kind === expected.kind ? 'correct' : 'wrong';
  }
  if (detection.kind !== 'dart') {
    return 'wrong';
  }
  if (detection.hit === null || isPending(detection, context.threshold)) {
    return 'pending';
  }
  if (!context.calibrated) {
    return 'unscored';
  }
  return detection.hit.segment === expected.segment && detection.hit.multiplier === expected.multiplier
    ? 'correct'
    : 'wrong';
}

export function hitLabel(hit: Hit): string {
  if (hit.segment === MISS_SEGMENT) {
    return 'Miss';
  }
  if (hit.segment === BULL_SEGMENT) {
    return hit.multiplier === 2 ? 'Bull' : '25';
  }
  return `${MULTIPLIER_PREFIX[hit.multiplier] ?? '?'}${hit.segment}`;
}

export function summarize(
  results: readonly EventResult[],
  options: { readonly detector: string; readonly threshold: number },
): EvaluationReport {
  const { threshold } = options;
  const events = sortBySession(results).map((result) => ({
    result,
    outcome: scoreEvent(result.expected, result.detection, { calibrated: result.calibrated, threshold }),
  }));

  const sessions = new Map<string, { calibrated: boolean; totals: MutableTotals }>();
  const totals = emptyTotals();
  const kinds = Object.fromEntries(
    KINDS.map((kind) => [kind, { expected: 0, correct: 0, detectedAs: { dart: 0, removal: 0, none: 0 } }]),
  ) as Record<EventKind, { expected: number; correct: number; detectedAs: Record<EventKind, number> }>;
  const hits = { scored: 0, correct: 0, pending: 0, wrong: 0, skippedNoCalibration: 0 };
  const byHit: Record<string, MutableHitCounts> = {};

  for (const { result, outcome } of events) {
    const session = sessions.get(result.session) ?? { calibrated: result.calibrated, totals: emptyTotals() };
    sessions.set(result.session, session);
    count(session.totals, outcome);
    count(totals, outcome);

    const kind = kinds[result.expected.kind];
    kind.expected++;
    kind.detectedAs[result.detection.kind]++;
    if (result.detection.kind === result.expected.kind) {
      kind.correct++;
    }

    if (result.expected.kind !== 'dart') {
      continue;
    }
    if (!result.calibrated) {
      hits.skippedNoCalibration++;
      continue;
    }
    const label = hitLabel(result.expected);
    const counts = byHit[label] ?? { expected: 0, correct: 0, pending: 0, wrong: 0 };
    byHit[label] = counts;
    counts.expected++;
    hits.scored++;
    if (outcome === 'correct' || outcome === 'pending' || outcome === 'wrong') {
      counts[outcome]++;
      hits[outcome]++;
    }
  }

  return {
    detector: options.detector,
    threshold,
    totals,
    sessions: [...sessions].map(([name, { calibrated, totals: sessionTotals }]) => ({
      name,
      calibrated,
      ...sessionTotals,
    })),
    kinds,
    hits: { ...hits, byHit },
    events: events.map(({ result, outcome }) => ({
      session: result.session,
      id: result.id,
      expected: result.expected,
      detection: result.detection,
      outcome,
    })),
  };
}

export function formatReport(report: EvaluationReport): string {
  const lines = [
    `Detektor: ${report.detector}, próg pewności ${report.threshold}`,
    `Ogółem (${plural(report.totals.events, 'zdarzenie', 'zdarzenia', 'zdarzeń')}): ${formatTotals(report.totals)}`,
  ];
  for (const session of report.sessions) {
    const calibration = session.calibrated ? 'z kalibracją' : 'bez kalibracji';
    lines.push(`${session.name} (${calibration}): ${formatTotals(session)}`);
  }

  lines.push('Rodzaj zdarzenia:');
  for (const kind of KINDS) {
    const { expected, correct, detectedAs } = report.kinds[kind];
    const detected = KINDS.filter((other) => detectedAs[other] > 0)
      .sort((a, b) => detectedAs[b] - detectedAs[a])
      .map((other) => `${other} ${detectedAs[other]}`)
      .join(', ');
    lines.push(`  ${kind.padEnd(8)} ${`${correct}/${expected}`.padEnd(5)}${detected === '' ? '' : ` (${detected})`}`.trimEnd());
  }

  const { hits } = report;
  const skipped = plural(hits.skippedNoCalibration, 'lotka', 'lotki', 'lotek');
  if (!report.sessions.some((session) => session.calibrated)) {
    lines.push(
      hits.skippedNoCalibration > 0
        ? `Trafienia: brak sesji z kalibracją, ${skipped} bez oceny trafienia`
        : 'Trafienia: brak sesji z kalibracją',
    );
    return lines.join('\n');
  }
  lines.push(
    `Trafienia (${plural(hits.scored, 'lotka', 'lotki', 'lotek')} z kalibracją): ` +
      `poprawne ${hits.correct}, do potwierdzenia ${hits.pending}, błędne ${hits.wrong}`,
  );
  for (const [label, counts] of Object.entries(hits.byHit)) {
    lines.push(
      `  ${label.padEnd(5)} ${`${counts.correct}/${counts.expected}`.padEnd(5)} ` +
        `(do potwierdzenia ${counts.pending}, błędne ${counts.wrong})`,
    );
  }
  if (hits.skippedNoCalibration > 0) {
    lines.push(`  bez kalibracji: ${skipped} bez oceny trafienia`);
  }
  return lines.join('\n');
}

interface MutableTotals {
  events: number;
  correct: number;
  pending: number;
  wrong: number;
  unscored: number;
}

interface MutableHitCounts {
  expected: number;
  correct: number;
  pending: number;
  wrong: number;
}

function emptyTotals(): MutableTotals {
  return { events: 0, correct: 0, pending: 0, wrong: 0, unscored: 0 };
}

function count(totals: MutableTotals, outcome: Outcome): void {
  totals.events++;
  totals[outcome]++;
}

// Stabilne sortowanie: sesje po nazwie bez locale, zdarzenia w kolejności z pliku.
function sortBySession(results: readonly EventResult[]): EventResult[] {
  return [...results].sort((a, b) => (a.session < b.session ? -1 : a.session > b.session ? 1 : 0));
}

function formatTotals(totals: OutcomeTotals): string {
  const text = `poprawne ${totals.correct}, do potwierdzenia ${totals.pending}, błędne ${totals.wrong}`;
  return totals.unscored > 0 ? `${text}, bez oceny ${totals.unscored}` : text;
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) {
    return `${n} ${one}`;
  }
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  return `${n} ${lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many}`;
}
