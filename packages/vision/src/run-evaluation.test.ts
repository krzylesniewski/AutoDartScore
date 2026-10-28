import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encode } from 'jpeg-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Detection, Detector, DetectorInput } from './detector.js';
import { loadFixtureSession } from './fixtures.js';
import { runEvaluation } from './run-evaluation.js';

let dir: string;
let invalidCount = 0;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function jpeg(width: number, height: number): Buffer {
  return encode({ data: Buffer.alloc(width * height * 4, 128), width, height }, 90).data;
}

async function writeSession(name: string, calibration?: unknown): Promise<string> {
  const sessionDir = join(dir, name);
  await mkdir(sessionDir);
  await writeFile(join(sessionDir, 'frame.jpg'), jpeg(32, 16));
  await writeFile(
    join(sessionDir, 'labels.json'),
    JSON.stringify({
      session: name,
      events: [
        { id: '01', before: 'frame.jpg', after: 'frame.jpg', expected: { kind: 'dart', segment: 20, multiplier: 1 } },
        { id: '02', before: 'frame.jpg', after: 'frame.jpg', expected: { kind: 'none' } },
      ],
    }),
  );
  if (calibration !== undefined) {
    await writeFile(join(sessionDir, 'calibration.json'), JSON.stringify(calibration));
  }
  return sessionDir;
}

function fakeDetector(detections: readonly unknown[], inputs: DetectorInput[] = []): Detector {
  let call = 0;
  return {
    name: 'fake',
    detect(input) {
      inputs.push(input);
      return Promise.resolve(detections[call++] as Detection);
    },
  };
}

const NONE = { kind: 'none' };

describe('runEvaluation', () => {
  it('runs the detector on each event and summarizes the results', async () => {
    const session = await loadFixtureSession(await writeSession('ok'));
    const inputs: DetectorInput[] = [];
    const detector = fakeDetector(
      [{ kind: 'dart', hit: null, confidence: 0.2, candidates: [{ segment: 20, multiplier: 1, probability: 0.6 }] }, NONE],
      inputs,
    );
    const report = await runEvaluation([session], detector, { threshold: 0.8 });
    expect(report.detector).toBe('fake');
    expect(report.totals).toEqual({ events: 2, correct: 1, pending: 1, wrong: 0, unscored: 0 });
    expect(report.events.map((e) => e.outcome)).toEqual(['pending', 'correct']);
    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.before).toMatchObject({ width: 32, height: 16 });
    expect(inputs[0]?.calibration).toBeNull();
  });

  it('passes the session calibration to the detector', async () => {
    const calibration = {
      imageWidth: 32,
      imageHeight: 16,
      points: [
        { x: 16, y: 1 },
        { x: 30, y: 8 },
        { x: 16, y: 15 },
        { x: 2, y: 8 },
      ],
    };
    const session = await loadFixtureSession(await writeSession('calibrated', calibration));
    const inputs: DetectorInput[] = [];
    const report = await runEvaluation(
      [session],
      fakeDetector([{ kind: 'dart', hit: { segment: 20, multiplier: 1 }, confidence: 0.9, candidates: [] }, NONE], inputs),
      { threshold: 0.8 },
    );
    expect(inputs[0]?.calibration).toEqual(calibration);
    expect(report.hits).toMatchObject({ scored: 1, correct: 1 });
  });

  it('rejects frames that do not match the calibration size', async () => {
    const calibration = {
      imageWidth: 1920,
      imageHeight: 1080,
      points: [
        { x: 900, y: 200 },
        { x: 1300, y: 540 },
        { x: 960, y: 900 },
        { x: 600, y: 540 },
      ],
    };
    const session = await loadFixtureSession(await writeSession('mismatch', calibration));
    await expect(runEvaluation([session], fakeDetector([NONE, NONE]), { threshold: 0.8 })).rejects.toThrow(
      'Session mismatch, event 01: Frame 32x16 does not match calibration 1920x1080',
    );
  });

  it.each([
    ['confidence above 1', { kind: 'dart', hit: null, confidence: 1.5, candidates: [] }, 'confidence'],
    ['infinite confidence', { kind: 'dart', hit: null, confidence: Infinity, candidates: [] }, 'confidence'],
    ['an invalid hit', { kind: 'dart', hit: { segment: 25, multiplier: 3 }, confidence: 0.9, candidates: [] }, 'hit'],
    [
      'an invalid candidate',
      { kind: 'dart', hit: null, confidence: 0.5, candidates: [{ segment: 0, multiplier: 1, probability: 0.5 }] },
      'candidates[0]',
    ],
    [
      'a candidate probability above 1',
      { kind: 'dart', hit: null, confidence: 0.5, candidates: [{ segment: 20, multiplier: 1, probability: 2 }] },
      'candidates[0].probability',
    ],
    ['an unknown kind', { kind: 'bounce' }, 'kind'],
  ])('stops on %s and names the event', async (_, detection, field) => {
    const session = await loadFixtureSession(await writeSession(`invalid-${++invalidCount}`));
    const run = runEvaluation([session], fakeDetector([NONE, detection]), { threshold: 0.8 });
    await expect(run).rejects.toThrow(`Session ${session.name}, event 02: Invalid detection from fake`);
    await expect(run).rejects.toThrow(`→ at ${field}`);
  });

  it('stops on a detector error and names the event', async () => {
    const session = await loadFixtureSession(await writeSession('throws'));
    const detector: Detector = { name: 'broken', detect: () => Promise.reject(new Error('model missing')) };
    await expect(runEvaluation([session], detector, { threshold: 0.8 })).rejects.toThrow(
      'Session throws, event 01: model missing',
    );
  });
});
