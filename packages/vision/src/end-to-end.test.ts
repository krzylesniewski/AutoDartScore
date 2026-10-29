import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '@autoscore/server/app';
import { migrateToLatest, openDatabase } from '@autoscore/server/db';
import { MatchSnapshot, Player, ReviewQueue, type CameraCalibration, type HitEvent } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiClient } from './api-client.js';
import { runCamera } from './camera-runner.js';
import type { Detection, Detector, DetectorInput } from './detector.js';
import { FRAME_BYTES_PER_PIXEL } from './frame.js';
import { VideoFileSource } from './video-file-source.js';

const WIDTH = 320;
const HEIGHT = 180;
const TIMEOUT_MS = 60_000;

type Block = readonly [x: number, y: number, size: number];

const DART_A: Block = [60, 40, 40];
const DART_B: Block = [140, 60, 40];
const DART_C: Block = [220, 100, 40];
const DART_D: Block = [100, 120, 40];

function image(blocks: readonly Block[]): Uint8Array {
  const data = new Uint8Array(WIDTH * HEIGHT * FRAME_BYTES_PER_PIXEL).fill(150);
  for (const [bx, by, size] of blocks) {
    for (let y = by; y < by + size; y++) {
      data.fill(20, (y * WIDTH + bx) * FRAME_BYTES_PER_PIXEL, (y * WIDTH + bx + size) * FRAME_BYTES_PER_PIXEL);
    }
  }
  return data;
}

const EMPTY = image([]);

// 5 kl./s: wbicie lotki to jedna klatka ruchu, wyjmowanie to 10 różnych klatek, czyli ponad 2 s ruchu.
function script(): Uint8Array[] {
  const repeat = (data: Uint8Array, times: number): Uint8Array[] => Array.from({ length: times }, () => data);
  const hand = Array.from({ length: 10 }, (_, i) => image([DART_A, DART_B, DART_C, [i * 25, 50, 80]]));
  return [
    ...repeat(EMPTY, 3),
    ...repeat(image([DART_A]), 3),
    ...repeat(image([DART_A, DART_B]), 3),
    ...repeat(image([DART_A, DART_B, DART_C]), 3),
    ...hand,
    ...repeat(EMPTY, 3),
    ...repeat(image([DART_D]), 3),
  ];
}

// FFV1 jest bezstratny, więc klatki wracają z pliku bajt w bajt, z pts co 0,2 s.
function writeVideo(file: string, frames: readonly Uint8Array[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      'ffmpeg',
      ['-hide_banner', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${WIDTH}x${HEIGHT}`, '-r', '5', '-i', '-', '-c:v', 'ffv1', '-y', file],
      { stdio: ['pipe', 'ignore', 'pipe'] },
    );
    let stderr = '';
    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`))));
    for (const frame of frames) {
      ffmpeg.stdin.write(frame);
    }
    ffmpeg.stdin.end();
  });
}

const calibration: CameraCalibration = {
  imageWidth: WIDTH,
  imageHeight: HEIGHT,
  points: [
    { x: 160, y: 10 },
    { x: 240, y: 90 },
    { x: 160, y: 170 },
    { x: 80, y: 90 },
  ],
};

function scripted(detections: readonly Detection[]): Detector & { readonly inputs: DetectorInput[] } {
  const inputs: DetectorInput[] = [];
  return {
    name: 'scripted',
    inputs,
    async detect(input) {
      inputs.push(input);
      return detections[inputs.length - 1] ?? { kind: 'none' };
    },
  };
}

const T20: Detection = { kind: 'dart', hit: { segment: 20, multiplier: 3 }, confidence: 0.95, candidates: [] };
const S5_UNSURE: Detection = {
  kind: 'dart',
  hit: { segment: 5, multiplier: 1 },
  confidence: 0.3,
  candidates: [
    { segment: 12, multiplier: 1, probability: 0.45 },
    { segment: 5, multiplier: 1, probability: 0.48 },
  ],
};

const quiet = { log: () => undefined, error: () => undefined };

let workDir: string;
let close: () => Promise<void>;
let url: string;

beforeEach(async () => {
  workDir = await mkdtemp(path.join(os.tmpdir(), 'autoscore-e2e-'));
  const db = openDatabase(':memory:');
  await migrateToLatest(db);
  const app = await buildApp({ db, random: () => 0 });
  await app.listen({ host: '127.0.0.1', port: 0 });
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  close = async () => {
    await app.close();
    await db.destroy();
  };
});

afterEach(async () => {
  await close();
  await rm(workDir, { recursive: true, force: true });
});

async function api<T>(method: string, route: string, body?: unknown): Promise<{ status: number; json: T }> {
  const response = await fetch(`${url}${route}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  return { status: response.status, json: (await response.json()) as T };
}

async function newGame(): Promise<{ matchId: string; first: string; second: string }> {
  const players: string[] = [];
  for (const name of ['Anna', 'Bartek']) {
    const { status, json } = await api('POST', '/players', { name });
    expect(status).toBe(201);
    players.push(Player.parse(json).id);
  }
  const [first = '', second = ''] = players;
  const created = await api('POST', '/matches', { type: 'match', playerIds: [first, second], startingScore: 301, bestOf: 1 });
  expect(created.status).toBe(201);
  return { matchId: MatchSnapshot.parse(created.json).id, first, second };
}

describe('camera to game end to end', () => {
  it(
    'plays a recording into the game in progress',
    async () => {
      const { matchId, first, second } = await newGame();
      expect((await api('PUT', '/cameras/camera-1/calibration', calibration)).status).toBe(200);
      const video = path.join(workDir, 'session.mkv');
      await writeVideo(video, script());
      const framesDir = path.join(workDir, 'frames');
      const detector = scripted([T20, T20, T20, S5_UNSURE]);
      const client = createApiClient({ api: { url, password: null }, retryDelaysMs: [] });

      const summary = await runCamera({
        source: new VideoFileSource(video),
        detector,
        calibration: await client.getCalibration('camera-1'),
        client,
        framesDir,
        pendingConfidence: 0.8,
        log: quiet,
      });

      expect(summary).toEqual({ sent: 4, rejected: 0, failed: 0, skippedNoMatch: 0, removals: 1 });
      expect(detector.inputs).toHaveLength(4);
      expect(detector.inputs.map((input) => input.calibration)).toEqual(Array.from({ length: 4 }, () => calibration));
      expect(Buffer.from(detector.inputs[3]?.before.data ?? []).equals(EMPTY)).toBe(true);
      expect(Buffer.from(detector.inputs[3]?.after.data ?? []).equals(image([DART_D]))).toBe(true);

      const state = MatchSnapshot.parse((await api('GET', `/matches/${matchId}`)).json);
      expect(state.players.map((player) => [player.id, player.remaining])).toEqual([
        [first, 121],
        [second, 301],
      ]);
      expect(state.currentPlayerId).toBe(second);
      expect(state.awaitingReview).toBe(true);

      const queue = ReviewQueue.parse((await api('GET', `/matches/${matchId}/review-queue`)).json);
      expect(queue.throws).toHaveLength(1);
      const [pending] = queue.throws;
      expect(pending).toMatchObject({ source: 'camera-1', sequence: 3, status: 'pending', reading: { segment: 5, multiplier: 1 } });
      expect(pending?.review?.reason).toBe('low_confidence');
      expect(pending?.review?.candidates).toEqual([
        { segment: 5, multiplier: 1, probability: 0.48 },
        { segment: 12, multiplier: 1, probability: 0.45 },
      ]);
      const frames = pending?.review?.frames;
      expect(frames).toBeDefined();
      expect(existsSync(path.join(framesDir, frames?.before ?? ''))).toBe(true);
      expect(existsSync(path.join(framesDir, frames?.after ?? ''))).toBe(true);
    },
    TIMEOUT_MS,
  );

  it(
    'retries a lost response with the same event id and stores the dart once',
    async () => {
      const { matchId, first } = await newGame();
      const posts: { body: string; status: number | null }[] = [];
      const lossy: typeof fetch = async (input, init) => {
        const response = await fetch(input, init);
        if (String(input).endsWith('/throws')) {
          posts.push({ body: String(init?.body), status: posts.length === 0 ? null : response.status });
          if (posts.length === 1) {
            throw new TypeError('fetch failed', { cause: new Error('socket hang up') });
          }
        }
        return response;
      };
      const delays: number[] = [];
      const client = createApiClient({
        api: { url, password: null },
        fetch: lossy,
        sleep: async (ms) => {
          delays.push(ms);
        },
        retryDelaysMs: [10],
      });
      const hit: HitEvent = {
        eventId: '6f1c1b7e-3c1a-4c7e-9a52-0d0f5a1d2b3c',
        matchId,
        source: 'camera-1',
        sequence: 0,
        segment: 20,
        multiplier: 3,
        confidence: 0.95,
        detectedAt: '2026-10-29T18:30:00.000Z',
      };

      await expect(client.sendHit(hit)).resolves.toEqual({ ok: true, status: 200 });
      expect(delays).toEqual([10]);
      expect(posts).toHaveLength(2);
      expect(posts[1]?.body).toBe(posts[0]?.body);
      expect(posts[1]?.status).toBe(200);

      const state = MatchSnapshot.parse((await api('GET', `/matches/${matchId}`)).json);
      expect(state.lastTurnThrows).toHaveLength(1);
      expect(state.players.find((player) => player.id === first)?.dartsThrownInLeg).toBe(1);
      expect(state.players.find((player) => player.id === first)?.remaining).toBe(241);
    },
    TIMEOUT_MS,
  );
});
