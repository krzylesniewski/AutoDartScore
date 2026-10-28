import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { encode } from 'jpeg-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Detector } from './detector.js';
import { parseEvalArgs, runEvalCommand } from './eval-command.js';

let dir: string;
let fixturesDir: string;

const fake: Detector = {
  name: 'fake',
  detect: ({ after }) =>
    Promise.resolve(
      (after.data[0] ?? 0) > 128
        ? { kind: 'dart', hit: { segment: 20, multiplier: 1 }, confidence: 0.9, candidates: [] }
        : { kind: 'none' },
    ),
};
const DETECTORS = { fake };

function jpeg(value: number): Buffer {
  return encode({ data: Buffer.alloc(32 * 16 * 4, value), width: 32, height: 16 }, 90).data;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
  fixturesDir = join(dir, 'fixtures');
  const sessionDir = join(fixturesDir, 'session-x');
  await mkdir(sessionDir, { recursive: true });
  await writeFile(join(fixturesDir, 'README.md'), '# notes');
  await writeFile(join(sessionDir, 'dark.jpg'), jpeg(40));
  await writeFile(join(sessionDir, 'light.jpg'), jpeg(220));
  await writeFile(
    join(sessionDir, 'labels.json'),
    JSON.stringify({
      session: 'session-x',
      events: [
        { id: '01', before: 'dark.jpg', after: 'light.jpg', expected: { kind: 'dart', segment: 20, multiplier: 1 } },
        { id: '02', before: 'dark.jpg', after: 'dark.jpg', expected: { kind: 'none' } },
        { id: '03', before: 'dark.jpg', after: 'light.jpg', expected: { kind: 'removal' } },
      ],
    }),
  );
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function silent(): { lines: string[]; log(line: string): void } {
  const lines: string[] = [];
  return { lines, log: (line) => lines.push(line) };
}

describe('parseEvalArgs', () => {
  it('defaults to the baseline, the repo fixtures/ and the 0.8 threshold', () => {
    const options = parseEvalArgs([]);
    expect(options.detector.name).toBe('baseline');
    expect(options.fixturesDir).toBe(resolve(import.meta.dirname, '../../../fixtures'));
    expect(options.threshold).toBe(0.8);
    expect(options.jsonPath).toBeNull();
  });

  it('resolves relative paths from the cwd', () => {
    const options = parseEvalArgs(['--fixtures', 'set', '--json', 'out/report.json', '--threshold', '0.5']);
    expect(options.fixturesDir).toBe(resolve('set'));
    expect(options.jsonPath).toBe(resolve('out/report.json'));
    expect(options.threshold).toBe(0.5);
  });

  it('accepts the threshold bounds', () => {
    expect(parseEvalArgs(['--threshold', '0']).threshold).toBe(0);
    expect(parseEvalArgs(['--threshold=1']).threshold).toBe(1);
  });

  it('rejects an unknown detector and lists the available ones', () => {
    expect(() => parseEvalArgs(['--detector', 'nope'])).toThrow('Unknown detector "nope". Available: baseline');
    expect(() => parseEvalArgs(['--detector', 'toString'])).toThrow('Unknown detector "toString"');
  });

  it.each(['2', '-0.1', 'abc', '', 'NaN', 'Infinity'])('rejects the threshold %j', (value) => {
    expect(() => parseEvalArgs([`--threshold=${value}`])).toThrow(`Invalid --threshold ${JSON.stringify(value)}`);
  });

  it('rejects an unknown flag and a positional argument', () => {
    expect(() => parseEvalArgs(['--bogus'])).toThrow("Unknown option '--bogus'");
    expect(() => parseEvalArgs(['fixtures'])).toThrow('Unexpected argument');
  });
});

describe('runEvalCommand', () => {
  it('prints the summary and writes the same report as JSON', async () => {
    const jsonPath = join(dir, 'report.json');
    const out = silent();
    const report = await runEvalCommand(
      ['--detector', 'fake', '--fixtures', fixturesDir, '--json', jsonPath],
      out,
      DETECTORS,
    );

    expect(out.lines[0]).toContain('Ogółem (3 zdarzenia): poprawne 1, do potwierdzenia 0, błędne 1, bez oceny 1');
    expect(out.lines[1]).toBe(`Raport JSON: ${jsonPath}`);

    const text = await readFile(jsonPath, 'utf8');
    expect(text).toBe(`${JSON.stringify(report, null, 2)}\n`);
    const json = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual(['detector', 'threshold', 'totals', 'sessions', 'kinds', 'hits', 'events']);
    expect(json.events).toHaveLength(3);
    expect(json.hits).toMatchObject({ scored: 0, skippedNoCalibration: 1 });
    expect(text).not.toContain(dir);
  });

  it('writes byte-identical JSON on two runs', async () => {
    const first = join(dir, 'first.json');
    const second = join(dir, 'second.json');
    await runEvalCommand(['--detector', 'fake', '--fixtures', fixturesDir, '--json', first], silent(), DETECTORS);
    await runEvalCommand(['--detector', 'fake', '--fixtures', fixturesDir, '--json', second], silent(), DETECTORS);
    expect(await readFile(second)).toEqual(await readFile(first));
  });

  it('fails on an unknown detector, a bad threshold and an unknown flag', async () => {
    await expect(runEvalCommand(['--detector', 'baseline'], silent(), DETECTORS)).rejects.toThrow(
      'Unknown detector "baseline". Available: fake',
    );
    await expect(runEvalCommand(['--detector', 'fake', '--threshold', '1.5'], silent(), DETECTORS)).rejects.toThrow('Invalid --threshold');
    await expect(runEvalCommand(['--compare', 'old.json'], silent(), DETECTORS)).rejects.toThrow(
      "Unknown option '--compare'",
    );
  });

  it('fails on a fixtures directory without sessions', async () => {
    const empty = join(dir, 'empty');
    await mkdir(empty);
    await expect(runEvalCommand(['--detector', 'fake', '--fixtures', empty], silent(), DETECTORS)).rejects.toThrow('No fixture sessions');
  });
});

describe('eval-cli', () => {
  it('prints the error to stderr and exits with code 1', async () => {
    const run = promisify(execFile)(process.execPath, ['--import', 'jiti/register', 'src/eval-cli.ts', '--detector', 'nope'], {
      cwd: resolve(import.meta.dirname, '..'),
    });
    await expect(run).rejects.toMatchObject({ code: 1, stderr: 'Unknown detector "nope". Available: baseline\n' });
  });
});
