import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadFixtureSession, loadFixtureSessions } from './fixtures.js';

const FIXTURES = resolve(import.meta.dirname, '../../../fixtures');

let dir: string;
let sessionCount = 0;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function event(id: string, expected: unknown): Record<string, unknown> {
  return { id, before: `${id}-before.jpg`, after: `${id}-after.jpg`, expected };
}

function labels(name: string, fourth: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session: name,
    events: [
      event('01', { kind: 'none' }),
      event('02', { kind: 'dart', turn: 1, segment: 20, multiplier: 1 }),
      event('03', { kind: 'removal' }),
      { ...event('04', { kind: 'dart', segment: 0, multiplier: 0 }), ...fourth },
    ],
  };
}

// Pliki klatek nie są dekodowane przy wczytaniu sesji, więc wystarczy, że istnieją.
async function writeSession(
  options: { labels?: (name: string) => unknown; labelsText?: string; calibration?: unknown; skipFrame?: string } = {},
): Promise<{ sessionDir: string; labelsPath: string }> {
  sessionCount += 1;
  const name = `session-${sessionCount}`;
  const sessionDir = join(dir, name);
  await mkdir(sessionDir);
  for (const id of ['01', '02', '03', '04']) {
    for (const side of ['before', 'after']) {
      const file = `${id}-${side}.jpg`;
      if (file !== options.skipFrame) {
        await writeFile(join(sessionDir, file), 'frame');
      }
    }
  }
  const labelsPath = join(sessionDir, 'labels.json');
  await writeFile(labelsPath, options.labelsText ?? JSON.stringify((options.labels ?? labels)(name)));
  if (options.calibration !== undefined) {
    await writeFile(join(sessionDir, 'calibration.json'), JSON.stringify(options.calibration));
  }
  return { sessionDir, labelsPath };
}

async function loadError(sessionDir: string): Promise<string> {
  try {
    await loadFixtureSession(sessionDir);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error(`Expected ${sessionDir} to fail`);
}

describe('loadFixtureSession on fixtures/session-01', () => {
  it('reads all events with absolute frame paths and no calibration', async () => {
    const session = await loadFixtureSession(join(FIXTURES, 'session-01'));
    expect(session.name).toBe('session-01');
    expect(session.dir).toBe(join(FIXTURES, 'session-01'));
    expect(session.calibration).toBeNull();
    expect(session.events).toHaveLength(21);

    const kinds = session.events.map((e) => e.expected.kind);
    expect(kinds.filter((k) => k === 'dart')).toHaveLength(9);
    expect(kinds.filter((k) => k === 'removal')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'none')).toHaveLength(10);

    const miss = session.events.find((e) => e.id === '07');
    expect(miss?.expected).toMatchObject({ kind: 'dart', segment: 0, multiplier: 0 });
    expect(miss?.afterTime).toBeGreaterThan(0);

    for (const e of session.events) {
      await expect(access(e.beforePath)).resolves.toBeUndefined();
      await expect(access(e.afterPath)).resolves.toBeUndefined();
    }
  });
});

describe('loadFixtureSessions', () => {
  it('loads session-01 from fixtures/ and skips README.md', async () => {
    const sessions = await loadFixtureSessions(FIXTURES);
    expect(sessions.map((s) => s.name)).toEqual(['session-01']);
  });

  it('sorts sessions by name and skips directories without labels.json', async () => {
    const root = join(dir, 'many');
    await mkdir(root);
    for (const name of ['b', 'a']) {
      await mkdir(join(root, name));
      await writeFile(join(root, name, 'x.jpg'), 'frame');
      await writeFile(
        join(root, name, 'labels.json'),
        JSON.stringify({ session: name, events: [{ id: '1', before: 'x.jpg', after: 'x.jpg', expected: { kind: 'none' } }] }),
      );
    }
    await mkdir(join(root, 'empty'));
    await writeFile(join(root, 'README.md'), '# notes');
    expect((await loadFixtureSessions(root)).map((s) => s.name)).toEqual(['a', 'b']);
  });

  it('rejects a directory without any session', async () => {
    const root = join(dir, 'none');
    await mkdir(join(root, 'empty'), { recursive: true });
    await expect(loadFixtureSessions(root)).rejects.toThrow(`No fixture sessions in ${root}`);
  });
});

describe('loadFixtureSession validation', () => {
  it('rejects invalid JSON with the file path', async () => {
    const { sessionDir, labelsPath } = await writeSession({ labelsText: '{ "session": ' });
    expect(await loadError(sessionDir)).toContain(`Invalid JSON in ${labelsPath}`);
  });

  it('rejects 25×3 at the expected object, because the Hit refine has no path', async () => {
    const { sessionDir, labelsPath } = await writeSession({
      labels: (name) => labels(name, { expected: { kind: 'dart', segment: 25, multiplier: 3 } }),
    });
    const message = await loadError(sessionDir);
    expect(message).toContain(labelsPath);
    expect(message).toContain('Invalid segment and multiplier combination');
    expect(message).toMatch(/→ at events\[3\]\.expected$/m);
  });

  it('rejects 0×1', async () => {
    const { sessionDir } = await writeSession({
      labels: (name) => labels(name, { expected: { kind: 'dart', segment: 0, multiplier: 1 } }),
    });
    expect(await loadError(sessionDir)).toContain('Invalid segment and multiplier combination');
  });

  it('rejects a multiplier of the wrong type', async () => {
    const { sessionDir, labelsPath } = await writeSession({
      labels: (name) => labels(name, { expected: { kind: 'dart', segment: 20, multiplier: '1' } }),
    });
    const message = await loadError(sessionDir);
    expect(message).toContain(labelsPath);
    expect(message).toContain('→ at events[3].expected.multiplier');
  });

  it('rejects an unknown kind', async () => {
    const { sessionDir, labelsPath } = await writeSession({
      labels: (name) => labels(name, { expected: { kind: 'bounce' } }),
    });
    const message = await loadError(sessionDir);
    expect(message).toContain(labelsPath);
    expect(message).toContain('→ at events[3].expected.kind');
  });

  it('rejects a duplicate event id', async () => {
    const { sessionDir, labelsPath } = await writeSession({ labels: (name) => labels(name, { id: '02' }) });
    const message = await loadError(sessionDir);
    expect(message).toContain(labelsPath);
    expect(message).toContain('Duplicate event id "02"');
    expect(message).toContain('→ at events[3].id');
  });

  it.each(['../x.jpg', 'sub/x.jpg', 'sub\\x.jpg'])('rejects the frame name %s', async (file) => {
    const { sessionDir, labelsPath } = await writeSession({ labels: (name) => labels(name, { before: file }) });
    const message = await loadError(sessionDir);
    expect(message).toContain(labelsPath);
    expect(message).toContain('plain file name');
    expect(message).toContain('→ at events[3].before');
  });

  it('rejects a missing frame file', async () => {
    const { sessionDir, labelsPath } = await writeSession({ skipFrame: '04-after.jpg' });
    const message = await loadError(sessionDir);
    expect(message).toContain(labelsPath);
    expect(message).toContain(`Frame file not found: ${join(sessionDir, '04-after.jpg')}`);
    expect(message).toContain('→ at events[3].after');
  });

  it('rejects a session name that does not match the directory', async () => {
    const { sessionDir, labelsPath } = await writeSession({ labels: () => labels('session-other') });
    const message = await loadError(sessionDir);
    expect(message).toContain(labelsPath);
    expect(message).toContain('"session-other" does not match directory');
    expect(message).toContain('→ at session');
  });

  it('rejects an invalid calibration.json with its path', async () => {
    const { sessionDir } = await writeSession({
      calibration: { imageWidth: 1920, imageHeight: 1080, points: [{ x: 1, y: 1 }] },
    });
    const message = await loadError(sessionDir);
    expect(message).toContain(join(sessionDir, 'calibration.json'));
    expect(message).toContain('→ at points');
  });

  it('parses a valid calibration.json', async () => {
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
    const { sessionDir } = await writeSession({ calibration });
    const session = await loadFixtureSession(sessionDir);
    expect(session.calibration).toEqual(calibration);
    expect(session.events.map((e) => e.id)).toEqual(['01', '02', '03', '04']);
    expect(session.events[3]?.beforePath).toBe(join(sessionDir, '04-before.jpg'));
  });

  it('strips unknown keys instead of rejecting them', async () => {
    const { sessionDir } = await writeSession({ labels: (name) => ({ ...labels(name), extra: true }) });
    await expect(loadFixtureSession(sessionDir)).resolves.toMatchObject({ events: { length: 4 } });
  });
});
