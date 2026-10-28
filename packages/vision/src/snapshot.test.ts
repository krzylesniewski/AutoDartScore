import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { CameraSource } from './camera-source.js';
import type { Frame } from './frame.js';
import { captureFrame, sendSnapshot } from './snapshot.js';

class FakeSource implements CameraSource {
  closed = false;
  yielded = 0;

  constructor(private readonly timestamps: readonly number[]) {}

  async *frames(): AsyncGenerator<Frame> {
    for (const timestamp of this.timestamps) {
      this.yielded += 1;
      yield { width: 2, height: 1, data: new Uint8Array(6), timestamp };
    }
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class FailingSource extends FakeSource {
  override async *frames(): AsyncGenerator<Frame> {
    yield* [];
    throw new Error('ffmpeg exited with code 1');
  }
}

describe('captureFrame', () => {
  it('takes the first frame at least settleMs after the first one', async () => {
    const source = new FakeSource([0, 1000, 2500, 3000]);
    expect((await captureFrame(source, { settleMs: 2000 })).timestamp).toBe(2500);
    expect(source.yielded).toBe(3);
    expect(source.closed).toBe(true);
  });

  it('counts the settle time from the first timestamp, not from zero', async () => {
    const source = new FakeSource([5000, 6000, 7000]);
    expect((await captureFrame(source, { settleMs: 2000 })).timestamp).toBe(7000);
  });

  it('takes the first frame with settleMs 0', async () => {
    const source = new FakeSource([0, 1000, 2500]);
    expect((await captureFrame(source, { settleMs: 0 })).timestamp).toBe(0);
    expect(source.yielded).toBe(1);
    expect(source.closed).toBe(true);
  });

  it('takes the last frame when the source ends before the settle time', async () => {
    const source = new FakeSource([0, 1000]);
    expect((await captureFrame(source, { settleMs: 2000 })).timestamp).toBe(1000);
    expect(source.closed).toBe(true);
  });

  it('rejects a source without frames', async () => {
    const source = new FakeSource([]);
    await expect(captureFrame(source, { settleMs: 0 })).rejects.toThrow('Camera gave no frame');
    expect(source.closed).toBe(true);
  });

  it('closes the source when it fails', async () => {
    const source = new FailingSource([]);
    await expect(captureFrame(source, { settleMs: 0 })).rejects.toThrow('ffmpeg exited with code 1');
    expect(source.closed).toBe(true);
  });
});

interface Recorded {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: Buffer;
}

type Responder = (request: Recorded) => { status: number; body?: unknown };

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
const password = 'tajne hasło';
const token = 'token-123';

let server: Server | null = null;
afterEach(async () => {
  const running = server;
  server = null;
  await new Promise<void>((resolve) => (running ? running.close(() => resolve()) : resolve()));
});

async function startServer(respond: Responder): Promise<{ url: string; requests: Recorded[] }> {
  const requests: Recorded[] = [];
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const recorded = { method: req.method ?? '', url: req.url ?? '', headers: req.headers, body: Buffer.concat(chunks) };
      requests.push(recorded);
      const { status, body } = respond(recorded);
      if (body === undefined) {
        res.writeHead(status).end();
        return;
      }
      res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    });
  });
  const running = server;
  await new Promise<void>((resolve) => running.listen(0, '127.0.0.1', resolve));
  const { port } = running.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, requests };
}

const loginOk = { token, expiresAt: '2026-10-29T18:00:00.000Z' };

function serverWithPassword(snapshotStatus = 204): Responder {
  return (request) => {
    if (request.url === '/auth/login') {
      const sent = JSON.parse(request.body.toString()) as { password?: string };
      return sent.password === password ? { status: 200, body: loginOk } : { status: 401, body: { error: 'invalid_password', message: 'Invalid password' } };
    }
    if (request.headers.authorization !== `Bearer ${token}`) {
      return { status: 401, body: { error: 'unauthorized', message: 'Missing or invalid token' } };
    }
    return snapshotStatus === 204 ? { status: 204 } : { status: snapshotStatus, body: { error: 'internal_error', message: 'Internal server error' } };
  };
}

describe('sendSnapshot', () => {
  it('sends one PUT with the JPEG and no token without a password', async () => {
    const { url, requests } = await startServer(() => ({ status: 204 }));
    await sendSnapshot({ api: { url, password: null }, cameraId: 'camera-1', jpeg });
    expect(requests).toHaveLength(1);
    const [put] = requests;
    expect(put?.method).toBe('PUT');
    expect(put?.url).toBe('/cameras/camera-1/snapshot');
    expect(put?.headers['content-type']).toBe('image/jpeg');
    expect(put?.headers.authorization).toBeUndefined();
    expect(put?.body.equals(Buffer.from(jpeg))).toBe(true);
  });

  it('logs in first and sends the token with a password', async () => {
    const { url, requests } = await startServer(serverWithPassword());
    await sendSnapshot({ api: { url, password }, cameraId: 'camera-1', jpeg });
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual(['POST /auth/login', 'PUT /cameras/camera-1/snapshot']);
    expect(requests[0]?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(requests[0]?.body.toString() ?? '')).toEqual({ password });
    expect(requests[1]?.headers.authorization).toBe(`Bearer ${token}`);
    expect(requests[1]?.body.equals(Buffer.from(jpeg))).toBe(true);
  });

  it('rejects a wrong password without repeating it', async () => {
    const { url, requests } = await startServer(serverWithPassword());
    const wrong = 'zle-haslo-42';
    const result = sendSnapshot({ api: { url, password: wrong }, cameraId: 'camera-1', jpeg });
    await expect(result).rejects.toThrow('Login failed: invalid AUTOSCORE_PASSWORD');
    await expect(result).rejects.toThrow(expect.objectContaining({ message: expect.not.stringContaining(wrong) }));
    expect(requests).toHaveLength(1);
  });

  it('rejects a locked login with the status and the error code', async () => {
    const { url } = await startServer(() => ({ status: 429, body: { error: 'too_many_attempts', message: 'Too many failed logins' } }));
    await expect(sendSnapshot({ api: { url, password }, cameraId: 'camera-1', jpeg })).rejects.toThrow('Login failed: HTTP 429 too_many_attempts');
  });

  it('rejects a failed PUT with the status and the error code', async () => {
    const { url } = await startServer(serverWithPassword(500));
    const result = sendSnapshot({ api: { url, password }, cameraId: 'camera-1', jpeg });
    await expect(result).rejects.toThrow('Snapshot upload failed: HTTP 500 internal_error');
    await expect(result).rejects.toThrow(expect.objectContaining({ message: expect.not.stringContaining(password) }));
  });

  it('rejects a PUT without a JSON error with the status', async () => {
    const { url } = await startServer(() => ({ status: 502 }));
    await expect(sendSnapshot({ api: { url, password: null }, cameraId: 'camera-1', jpeg })).rejects.toThrow('Snapshot upload failed: HTTP 502');
  });

  it('names the server it cannot reach', async () => {
    const { url } = await startServer(() => ({ status: 204 }));
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
    await expect(sendSnapshot({ api: { url, password: null }, cameraId: 'camera-1', jpeg })).rejects.toThrow(`Cannot reach the server at ${url}: connect ECONNREFUSED`);
  });

  it('names the error code when the network error has no message', async () => {
    const refused = Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' });
    const fake: typeof fetch = async () => {
      throw new TypeError('fetch failed', { cause: refused });
    };
    await expect(sendSnapshot({ api: { url: 'http://localhost:3999', password: null }, cameraId: 'camera-1', jpeg, fetch: fake })).rejects.toThrow(
      'Cannot reach the server at http://localhost:3999: ECONNREFUSED',
    );
  });

  it('uses the injected fetch', async () => {
    const calls: string[] = [];
    const fake: typeof fetch = async (input, init) => {
      calls.push(`${init?.method} ${String(input)}`);
      return new Response(null, { status: 204 });
    };
    await sendSnapshot({ api: { url: 'http://camera-host:3000', password: null }, cameraId: 'camera-1', jpeg, fetch: fake });
    expect(calls).toEqual(['PUT http://camera-host:3000/cameras/camera-1/snapshot']);
  });
});
