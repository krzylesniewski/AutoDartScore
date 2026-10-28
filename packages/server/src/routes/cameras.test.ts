import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError, CameraCalibration, LoginResponse } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { setup, type TestApp } from '../test-helpers.js';

const calibration: CameraCalibration = {
  imageWidth: 1920,
  imageHeight: 1080,
  points: [
    { x: 960.5, y: 200.25 },
    { x: 1500, y: 540 },
    { x: 960, y: 900 },
    { x: 420, y: 540 },
  ],
};

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

let t: TestApp | null = null;
let dir: string | null = null;
afterEach(async () => {
  await t?.close();
  t = null;
  if (dir !== null) {
    await rm(dir, { recursive: true, force: true });
    dir = null;
  }
});

function getCalibration(app: FastifyInstance, cameraId = 'camera-1', headers: Record<string, string> = {}) {
  return app.inject({ method: 'GET', url: `/cameras/${cameraId}/calibration`, headers });
}

function putCalibration(app: FastifyInstance, payload: object, cameraId = 'camera-1', headers: Record<string, string> = {}) {
  return app.inject({ method: 'PUT', url: `/cameras/${cameraId}/calibration`, payload, headers });
}

function getSnapshot(app: FastifyInstance, cameraId = 'camera-1', headers: Record<string, string> = {}) {
  return app.inject({ method: 'GET', url: `/cameras/${cameraId}/snapshot`, headers });
}

function putSnapshot(app: FastifyInstance, payload: Buffer | string, contentType = 'image/jpeg', headers: Record<string, string> = {}) {
  return app.inject({ method: 'PUT', url: '/cameras/camera-1/snapshot', payload, headers: { 'content-type': contentType, ...headers } });
}

function errorCode(response: { json(): unknown }): string {
  return ApiError.parse(response.json()).error;
}

async function calibrationRows(app: TestApp, cameraId: string) {
  return app.db.selectFrom('camera_calibrations').select(['seq', 'p1_x']).where('camera_id', '=', cameraId).orderBy('seq').execute();
}

describe('camera calibration', () => {
  it('gives 404 before any calibration was saved', async () => {
    t = await setup();
    const response = await getCalibration(t.app);
    expect(response.statusCode).toBe(404);
    expect(errorCode(response)).toBe('not_found');
  });

  it('returns the saved calibration', async () => {
    t = await setup();
    const saved = await putCalibration(t.app, calibration);
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual(calibration);

    const response = await getCalibration(t.app);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(calibration);
  });

  it('keeps every save and returns the latest one', async () => {
    t = await setup();
    const second = { ...calibration, points: [{ x: 10, y: 20 }, ...calibration.points.slice(1)] };
    expect((await putCalibration(t.app, calibration)).statusCode).toBe(200);
    expect((await putCalibration(t.app, second)).statusCode).toBe(200);

    expect((await getCalibration(t.app)).json()).toEqual(second);
    expect(await calibrationRows(t, 'camera-1')).toEqual([
      { seq: 1, p1_x: 960.5 },
      { seq: 2, p1_x: 10 },
    ]);
  });

  it.each([
    ['a point outside the image', { ...calibration, points: [{ x: 1921, y: 10 }, ...calibration.points.slice(1)] }],
    ['3 points', { ...calibration, points: calibration.points.slice(0, 3) }],
    ['no points', { imageWidth: 1920, imageHeight: 1080 }],
  ])('rejects %s', async (_, payload) => {
    t = await setup();
    const response = await putCalibration(t.app, payload);
    expect(response.statusCode).toBe(400);
    expect(errorCode(response)).toBe('invalid_request');
    expect((await getCalibration(t.app)).statusCode).toBe(404);
  });

  it.each(['Camera-1', 'camera_1', '-camera', 'a'.repeat(33)])('rejects the camera id %j on every route', async (id) => {
    t = await setup();
    const responses = [
      await getCalibration(t.app, id),
      await putCalibration(t.app, calibration, id),
      await getSnapshot(t.app, id),
      await t.app.inject({ method: 'PUT', url: `/cameras/${id}/snapshot`, payload: jpeg, headers: { 'content-type': 'image/jpeg' } }),
    ];
    for (const response of responses) {
      expect(response.statusCode).toBe(400);
      expect(errorCode(response)).toBe('invalid_request');
    }
  });

  it('keeps cameras apart', async () => {
    t = await setup();
    expect((await putCalibration(t.app, calibration, 'camera-2')).statusCode).toBe(200);
    expect((await getCalibration(t.app, 'camera-1')).statusCode).toBe(404);
    expect((await getCalibration(t.app, 'camera-2')).json()).toEqual(calibration);
  });

  it('survives a restart with a file database', async () => {
    dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
    const path = join(dir, 'games.sqlite');
    const first = await setup({ path });
    expect((await putCalibration(first.app, calibration)).statusCode).toBe(200);
    await first.close();

    t = await setup({ path });
    const response = await getCalibration(t.app);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(calibration);
  });
});

describe('camera snapshot', () => {
  it('gives 404 before any snapshot was sent', async () => {
    t = await setup();
    const response = await getSnapshot(t.app);
    expect(response.statusCode).toBe(404);
    expect(errorCode(response)).toBe('not_found');
  });

  it('returns the sent bytes as a JPEG that is not cached', async () => {
    t = await setup();
    const sent = await putSnapshot(t.app, jpeg);
    expect(sent.statusCode).toBe(204);
    expect(sent.body).toBe('');

    const response = await getSnapshot(t.app);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/jpeg');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.rawPayload.equals(jpeg)).toBe(true);
    expect((await getSnapshot(t.app, 'camera-2')).statusCode).toBe(404);
  });

  it('replaces the previous snapshot', async () => {
    t = await setup();
    const next = Buffer.concat([jpeg, Buffer.from([1, 2, 3])]);
    await putSnapshot(t.app, jpeg);
    expect((await putSnapshot(t.app, next)).statusCode).toBe(204);
    expect((await getSnapshot(t.app)).rawPayload.equals(next)).toBe(true);
  });

  it.each([
    ['non-JPEG bytes', Buffer.from('not a jpeg'), 'image/jpeg'],
    ['a truncated JPEG header', Buffer.from([0xff, 0xd8]), 'image/jpeg'],
    ['a JSON body', JSON.stringify({ jpeg: 'ffd8ff' }), 'application/json'],
    ['an empty body', Buffer.alloc(0), 'image/jpeg'],
    ['another content type', jpeg, 'application/octet-stream'],
  ])('rejects %s', async (_, payload, contentType) => {
    t = await setup();
    const response = await putSnapshot(t.app, payload, contentType);
    expect(response.statusCode).toBe(400);
    expect(errorCode(response)).toBe('invalid_request');
    expect((await getSnapshot(t.app)).statusCode).toBe(404);
  });

  it('names the problem for a body that is not a JPEG', async () => {
    t = await setup();
    const response = await putSnapshot(t.app, Buffer.from('not a jpeg'));
    expect(ApiError.parse(response.json()).message).toContain('Body is not a JPEG image');
  });

  it('accepts 8 MiB and rejects a larger body', async () => {
    t = await setup();
    const limit = 8 * 1024 * 1024;
    const atLimit = Buffer.concat([jpeg, Buffer.alloc(limit - jpeg.length)]);
    expect((await putSnapshot(t.app, atLimit)).statusCode).toBe(204);

    const tooLarge = Buffer.concat([atLimit, Buffer.alloc(1)]);
    const response = await putSnapshot(t.app, tooLarge);
    expect(response.statusCode).toBe(400);
    expect(errorCode(response)).toBe('invalid_request');
    expect((await getSnapshot(t.app)).rawPayload.length).toBe(limit);
  });
});

describe('camera routes with a password', () => {
  const password = 'tajne hasło';

  async function withAuth(): Promise<{ app: FastifyInstance; authorization: string }> {
    t = await setup({ auth: { password, tokenSecret: 's'.repeat(32) } });
    const login = await t.app.inject({ method: 'POST', url: '/auth/login', payload: { password } });
    expect(login.statusCode).toBe(200);
    return { app: t.app, authorization: `Bearer ${LoginResponse.parse(login.json()).token}` };
  }

  it('needs a token on all four routes', async () => {
    const { app } = await withAuth();
    const responses = [await putSnapshot(app, jpeg), await getSnapshot(app), await putCalibration(app, calibration), await getCalibration(app)];
    for (const response of responses) {
      expect(response.statusCode).toBe(401);
      expect(errorCode(response)).toBe('unauthorized');
    }
  });

  it('works with a token from the login', async () => {
    const { app, authorization } = await withAuth();
    const headers = { authorization };
    expect((await putSnapshot(app, jpeg, 'image/jpeg', headers)).statusCode).toBe(204);
    const snapshot = await getSnapshot(app, 'camera-1', headers);
    expect(snapshot.statusCode).toBe(200);
    expect(snapshot.rawPayload.equals(jpeg)).toBe(true);
    expect((await putCalibration(app, calibration, 'camera-1', headers)).statusCode).toBe(200);
    expect((await getCalibration(app, 'camera-1', headers)).json()).toEqual(calibration);
  });
});
