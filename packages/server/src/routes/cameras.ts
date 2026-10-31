import { CameraCalibration, CameraId } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { invalidRequest, notFound } from '../errors.js';
import type { CameraStore } from '../store/camera-store.js';

export interface CameraRouteOptions {
  readonly store: CameraStore;
  readonly now: () => number;
}

interface CameraParams {
  Params: { cameraId: string };
}

export const SNAPSHOT_BODY_LIMIT = 8 * 1024 * 1024;

const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function cameraId(params: { cameraId: string }): string {
  const parsed = CameraId.safeParse(params.cameraId);
  if (!parsed.success) {
    throw invalidRequest(parsed.error.issues.map((issue) => ({ ...issue, path: ['cameraId', ...issue.path] })));
  }
  return parsed.data;
}

// Domyślny parser JSON podaje obiekt, a brak body to undefined, więc wystarczy sprawdzić Buffer i nagłówek JPEG.
function isJpeg(body: unknown): body is Buffer {
  return Buffer.isBuffer(body) && body.length >= JPEG_MAGIC.length && JPEG_MAGIC.every((byte, i) => body[i] === byte);
}

// Rejestrowane przez app.register, więc parser image/jpeg działa tylko w tych trasach.
// Klatka jest tylko w pamięci: po restarcie serwera GET daje 404, dopóki vision nie wyśle nowej.
export async function cameraRoutes(app: FastifyInstance, { store, now }: CameraRouteOptions): Promise<void> {
  const snapshots = new Map<string, Buffer>();

  app.addContentTypeParser('image/jpeg', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  app.put<CameraParams>('/cameras/:cameraId/snapshot', { bodyLimit: SNAPSHOT_BODY_LIMIT }, async (request, reply) => {
    const id = cameraId(request.params);
    if (!isJpeg(request.body)) {
      throw invalidRequest([{ path: [], message: 'Body is not a JPEG image' }]);
    }
    snapshots.set(id, request.body);
    return reply.code(204).send();
  });

  app.get<CameraParams>('/cameras/:cameraId/snapshot', async (request, reply) => {
    const id = cameraId(request.params);
    const snapshot = snapshots.get(id);
    if (snapshot === undefined) {
      throw notFound(`Snapshot of camera ${id}`);
    }
    return reply.header('content-type', 'image/jpeg').header('cache-control', 'no-store').send(snapshot);
  });

  app.get<CameraParams>('/cameras/:cameraId/calibration', async (request) => {
    const id = cameraId(request.params);
    const calibration = await store.findCalibration(id);
    if (calibration === null) {
      throw notFound(`Calibration of camera ${id}`);
    }
    return calibration;
  });

  app.put<CameraParams>('/cameras/:cameraId/calibration', async (request) => {
    const id = cameraId(request.params);
    const parsed = CameraCalibration.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return store.saveCalibration(id, parsed.data, now());
  });
}
