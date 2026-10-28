import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Detector } from './detector.js';
import { DETECTORS } from './detectors.js';
import { DEFAULT_PENDING_CONFIDENCE, formatReport } from './evaluation.js';
import type { EvaluationReport } from './evaluation.js';
import { loadFixtureSessions } from './fixtures.js';
import { runEvaluation } from './run-evaluation.js';

// Od położenia pliku, a nie od cwd, żeby domyślny zestaw działał z każdego katalogu.
export const DEFAULT_FIXTURES_DIR = resolve(import.meta.dirname, '../../../fixtures');
const DEFAULT_DETECTOR = 'baseline';

export interface EvalOptions {
  readonly detector: Detector;
  readonly fixturesDir: string;
  readonly threshold: number;
  readonly jsonPath: string | null;
}

// Ścieżki względne liczą się od cwd, pod pnpm --filter to packages/vision.
export function parseEvalArgs(
  argv: readonly string[],
  detectors: Readonly<Record<string, Detector>> = DETECTORS,
): EvalOptions {
  const { values } = parseArgs({
    args: [...argv],
    strict: true,
    allowPositionals: false,
    options: {
      detector: { type: 'string' },
      fixtures: { type: 'string' },
      threshold: { type: 'string' },
      json: { type: 'string' },
    },
  });
  return {
    detector: findDetector(values.detector ?? DEFAULT_DETECTOR, detectors),
    fixturesDir: values.fixtures === undefined ? DEFAULT_FIXTURES_DIR : resolve(values.fixtures),
    threshold: values.threshold === undefined ? DEFAULT_PENDING_CONFIDENCE : parseThreshold(values.threshold),
    jsonPath: values.json === undefined ? null : resolve(values.json),
  };
}

// Błędne detekcje nie są błędem komendy. Błąd oznacza, że ewaluacja się nie odbyła.
export async function runEvalCommand(
  argv: readonly string[],
  out: { log(line: string): void },
  detectors: Readonly<Record<string, Detector>> = DETECTORS,
): Promise<EvaluationReport> {
  const options = parseEvalArgs(argv, detectors);
  const sessions = await loadFixtureSessions(options.fixturesDir);
  const report = await runEvaluation(sessions, options.detector, { threshold: options.threshold });
  out.log(formatReport(report));
  if (options.jsonPath !== null) {
    await writeFile(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    out.log(`Raport JSON: ${options.jsonPath}`);
  }
  return report;
}

function findDetector(name: string, detectors: Readonly<Record<string, Detector>>): Detector {
  const detector = Object.hasOwn(detectors, name) ? detectors[name] : undefined;
  if (detector === undefined) {
    throw new Error(`Unknown detector ${JSON.stringify(name)}. Available: ${Object.keys(detectors).join(', ')}`);
  }
  return detector;
}

function parseThreshold(value: string): number {
  const threshold = Number(value);
  if (value.trim() === '' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error(`Invalid --threshold ${JSON.stringify(value)}: expected a number from 0 to 1`);
  }
  return threshold;
}
