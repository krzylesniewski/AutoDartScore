import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CameraCalibration, HitEvent, MatchListItem } from '@autoscore/schema';
import { HitEvent as HitEventSchema } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ApiClient, SendHitResult } from './api-client.js';
import { runCamera, type RunCameraOptions } from './camera-runner.js';
import type { CameraSource } from './camera-source.js';
import type { Detection, DetectorInput } from './detector.js';
import type { Frame } from './frame.js';

class FakeSource implements CameraSource {
  closed = false;

  constructor(private readonly items: readonly Frame[]) {}

  async *frames(): AsyncGenerator<Frame> {
    yield* this.items;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

// Wartość piksela niesie numer stanu tarczy. isStill w testach porównuje tylko pierwszy bajt.
function frame(timestamp: number, state: number): Frame {
  return { width: 4, height: 2, data: new Uint8Array(24).fill(state), timestamp };
}

const isStill = (a: Frame, b: Frame): boolean => a.data[0] === b.data[0];

// Każda kolejna lotka to nowy stan na dwóch klatkach, czyli jedno zdarzenie settled.
function darts(count: number): Frame[] {
  const frames = [frame(0, 0)];
  for (let i = 1; i <= count; i++) {
    frames.push(frame(i * 1000, i), frame(i * 1000 + 200, i));
  }
  return frames;
}

function listItem(id: string, overrides: Partial<MatchListItem> = {}): MatchListItem {
  return {
    id,
    type: 'match',
    practiceMode: null,
    startingScore: 301,
    legsToWin: 1,
    createdAt: '2026-10-29T18:00:00.000Z',
    status: 'in_progress',
    abandonment: null,
    currentPlayerId: 'p1',
    legIndex: 0,
    players: [{ id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, remaining: 301, legsWon: 0, place: null, dartsThrownInLeg: 0 }],
    freeRun: null,
    checkouts: null,
    winnerId: null,
    placements: [],
    endedAt: null,
    updatedAt: '2026-10-29T18:00:00.000Z',
    ...overrides,
  };
}

class FakeClient implements Pick<ApiClient, 'listUnfinishedMatches' | 'sendHit'> {
  readonly sent: HitEvent[] = [];
  lists = 0;

  constructor(
    private readonly matches: () => MatchListItem[] = () => [listItem('m_1')],
    private readonly reply: (hit: HitEvent) => SendHitResult = () => ({ ok: true, status: 201 }),
  ) {}

  async listUnfinishedMatches(): Promise<MatchListItem[]> {
    this.lists++;
    return this.matches();
  }

  async sendHit(hit: HitEvent): Promise<SendHitResult> {
    this.sent.push(hit);
    return this.reply(hit);
  }
}

function scripted(detections: readonly Detection[]): { detect: (input: DetectorInput) => Promise<Detection>; name: string; inputs: DetectorInput[] } {
  const inputs: DetectorInput[] = [];
  return {
    name: 'scripted',
    inputs,
    async detect(input) {
      inputs.push(input);
      const detection = detections[inputs.length - 1];
      if (detection === undefined) {
        throw new Error('No scripted detection left');
      }
      return detection;
    },
  };
}

const T20: Detection = { kind: 'dart', hit: { segment: 20, multiplier: 3 }, confidence: 0.95, candidates: [] };
const UNREAD: Detection = { kind: 'dart', hit: null, confidence: 0, candidates: [] };
const calibration: CameraCalibration = { imageWidth: 4, imageHeight: 2, points: [{ x: 2, y: 0 }, { x: 4, y: 1 }, { x: 2, y: 2 }, { x: 0, y: 1 }] };

let framesDir: string;
let ids: number;
beforeEach(async () => {
  framesDir = path.join(await mkdtemp(path.join(os.tmpdir(), 'autoscore-runner-')), 'frames');
  ids = 0;
});
afterEach(async () => {
  await rm(path.dirname(framesDir), { recursive: true, force: true });
});

function run(source: CameraSource, detections: readonly Detection[], client: FakeClient, overrides: Partial<RunCameraOptions> = {}) {
  const detector = scripted(detections);
  const lines: string[] = [];
  const errors: string[] = [];
  const result = runCamera({
    source,
    detector,
    calibration,
    client,
    framesDir,
    pendingConfidence: 0.8,
    log: { log: (line: string) => lines.push(line), error: (line: string) => errors.push(line) },
    now: () => new Date('2026-10-29T18:30:00.000Z'),
    newEventId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
    watcher: { isStill },
    ...overrides,
  });
  return { result, detector, lines, errors };
}

describe('runCamera', () => {
  it('sends nothing and writes no files without a game in progress', async () => {
    const client = new FakeClient(() => [listItem('m_1', { status: 'abandoned' })]);
    const { result, lines } = run(new FakeSource(darts(1)), [UNREAD], client);
    await expect(result).resolves.toMatchObject({ sent: 0, skippedNoMatch: 1 });
    expect(client.sent).toEqual([]);
    expect(existsSync(framesDir)).toBe(false);
    expect(lines).toContain('Brak gry w trakcie, lotka nie została wysłana');
  });

  it('continues when the game list cannot be read', async () => {
    let calls = 0;
    const client = new FakeClient(() => {
      calls++;
      if (calls === 1) {
        throw new Error('Cannot reach the server at http://localhost:3000: ECONNREFUSED');
      }
      return [listItem('m_1')];
    });
    const { result, errors } = run(new FakeSource(darts(2)), [T20, T20], client);
    await expect(result).resolves.toMatchObject({ sent: 1, failed: 1 });
    expect(client.sent.map((hit) => hit.sequence)).toEqual([0]);
    expect(errors[0]).toContain('ECONNREFUSED');
  });

  it('sends a confident dart without review and writes no files', async () => {
    const client = new FakeClient();
    const { result, detector, lines } = run(new FakeSource(darts(1)), [T20], client);
    await expect(result).resolves.toEqual({ sent: 1, rejected: 0, failed: 0, skippedNoMatch: 0, removals: 0 });
    expect(client.sent).toEqual([
      {
        eventId: '00000000-0000-4000-8000-000000000001',
        matchId: 'm_1',
        source: 'camera-1',
        sequence: 0,
        segment: 20,
        multiplier: 3,
        confidence: 0.95,
        detectedAt: '2026-10-29T18:30:00.000Z',
      },
    ]);
    expect(HitEventSchema.safeParse(client.sent[0]).success).toBe(true);
    expect(existsSync(framesDir)).toBe(false);
    expect(detector.inputs[0]?.calibration).toBe(calibration);
    expect(lines).toContain('Lotka T20, pewność 0.95, gra m_1');
  });

  it('sends an uncertain dart with sorted candidates and saved frames', async () => {
    const candidates = Array.from({ length: 12 }, (_, i) => ({ segment: i + 1, multiplier: 1 as const, probability: (i + 1) / 100 }));
    const uncertain: Detection = { kind: 'dart', hit: { segment: 5, multiplier: 1 }, confidence: 0.3, candidates };
    const client = new FakeClient();
    const { result, detector } = run(new FakeSource(darts(1)), [uncertain], client);
    await expect(result).resolves.toMatchObject({ sent: 1 });
    const [hit] = client.sent;
    expect(hit).toMatchObject({ segment: 5, multiplier: 1, confidence: 0.3 });
    expect(hit?.review?.reason).toBe('low_confidence');
    expect(hit?.review?.candidates.map((candidate) => candidate.segment)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(hit?.review?.frames).toEqual({
      before: 'm_1/00000000-0000-4000-8000-000000000001-before.jpg',
      after: 'm_1/00000000-0000-4000-8000-000000000001-after.jpg',
    });
    expect(HitEventSchema.safeParse(hit).success).toBe(true);
    expect(existsSync(path.join(framesDir, hit?.review?.frames?.before ?? ''))).toBe(true);
    expect(existsSync(path.join(framesDir, hit?.review?.frames?.after ?? ''))).toBe(true);
    expect(detector.inputs[0]?.before.data[0]).toBe(0);
    expect(detector.inputs[0]?.after.data[0]).toBe(1);
  });

  it('sends a dart without a reading as 0×0 with confidence 0 and frames', async () => {
    const client = new FakeClient();
    const { result, lines } = run(new FakeSource(darts(1)), [UNREAD], client);
    await expect(result).resolves.toMatchObject({ sent: 1 });
    const [hit] = client.sent;
    expect(hit).toMatchObject({ segment: 0, multiplier: 0, confidence: 0, review: { reason: 'low_confidence', candidates: [] } });
    expect(hit?.review?.frames).toBeDefined();
    expect(await readdir(path.join(framesDir, 'm_1'))).toHaveLength(2);
    expect(lines.at(-1)).toContain(`brak odczytu, pewność 0.00, do potwierdzenia, gra m_1, klatki: ${path.join(framesDir, 'm_1')}`);
  });

  it('saves frames for a dart without a reading even with pendingConfidence 0', async () => {
    const client = new FakeClient();
    const { result } = run(new FakeSource(darts(2)), [UNREAD, T20], client, { pendingConfidence: 0 });
    await expect(result).resolves.toMatchObject({ sent: 2 });
    expect(client.sent[0]?.review?.frames).toBeDefined();
    expect(client.sent[1]?.review).toBeUndefined();
    expect(await readdir(path.join(framesDir, 'm_1'))).toHaveLength(2);
  });

  it('sends the review without frames when saving them fails', async () => {
    const blocked = path.join(path.dirname(framesDir), 'file');
    await writeFile(blocked, '');
    const client = new FakeClient();
    const { result, errors } = run(new FakeSource(darts(1)), [UNREAD], client, { framesDir: blocked });
    await expect(result).resolves.toMatchObject({ sent: 1 });
    expect(client.sent[0]?.review).toEqual({ reason: 'low_confidence', candidates: [] });
    expect(errors[0]).toContain('Nie udało się zapisać klatek lotki 00000000-0000-4000-8000-000000000001');
  });

  it('sends nothing for a detector removal', async () => {
    const client = new FakeClient();
    const { result, lines } = run(new FakeSource(darts(1)), [{ kind: 'removal' }], client);
    await expect(result).resolves.toMatchObject({ sent: 0, removals: 0 });
    expect(client.lists).toBe(0);
    expect(client.sent).toEqual([]);
    expect(lines).toContain('Detektor rozpoznał wyjmowanie lotek, nic nie wysłano');
  });

  it('sends nothing for none', async () => {
    const client = new FakeClient();
    await expect(run(new FakeSource(darts(1)), [{ kind: 'none' }], client).result).resolves.toMatchObject({ sent: 0 });
    expect(client.lists).toBe(0);
  });

  it('skips the detector and the API for a long motion', async () => {
    const frames = [frame(0, 0), ...Array.from({ length: 10 }, (_, i) => frame(200 + i * 200, i + 1)), frame(2200, 10)];
    const client = new FakeClient();
    const { result, detector, lines } = run(new FakeSource(frames), [], client);
    await expect(result).resolves.toMatchObject({ removals: 1, sent: 0 });
    expect(detector.inputs).toEqual([]);
    expect(client.lists).toBe(0);
    expect(lines).toContain('Wyjmowanie lotek (ruch 2.0 s), nowa klatka odniesienia');
  });

  it('numbers events 0, 1, 2 in order', async () => {
    const client = new FakeClient();
    await expect(run(new FakeSource(darts(3)), [T20, UNREAD, T20], client).result).resolves.toMatchObject({ sent: 3 });
    expect(client.sent.map((hit) => hit.sequence)).toEqual([0, 1, 2]);
    expect(new Set(client.sent.map((hit) => hit.eventId)).size).toBe(3);
  });

  it('logs a rejection with the status and the code, then continues', async () => {
    let replies = 0;
    const client = new FakeClient(undefined, () => (++replies === 1 ? { ok: false, status: 409, error: 'turn_pending' } : { ok: true, status: 201 }));
    const { result, errors } = run(new FakeSource(darts(2)), [T20, T20], client);
    await expect(result).resolves.toMatchObject({ sent: 1, rejected: 1 });
    expect(errors).toEqual(['Serwer odrzucił lotkę T20 (gra m_1): 409 turn_pending']);
  });

  it('logs a failed send with the event id, then continues', async () => {
    let replies = 0;
    const client = new FakeClient(undefined, () => {
      if (++replies === 1) {
        throw new Error('Cannot reach the server at http://localhost:3000: ECONNREFUSED');
      }
      return { ok: true, status: 201 };
    });
    const { result, errors } = run(new FakeSource(darts(2)), [T20, T20], client);
    await expect(result).resolves.toMatchObject({ sent: 1, failed: 1 });
    expect(errors[0]).toBe('Nie udało się wysłać lotki 00000000-0000-4000-8000-000000000001: Cannot reach the server at http://localhost:3000: ECONNREFUSED');
  });

  it('propagates a detector error and closes the source', async () => {
    const source = new FakeSource(darts(1));
    await expect(run(source, [], new FakeClient()).result).rejects.toThrow('No scripted detection left');
    expect(source.closed).toBe(true);
  });
});
