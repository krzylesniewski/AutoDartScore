import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ApiError } from '@autoscore/schema';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createToken } from '../auth/credentials.js';
import { migrateToLatest, openDatabase } from '../db/index.js';
import { setup, type TestApp } from '../test-helpers.js';

const password = 'tajne hasło';
const tokenSecret = 's'.repeat(32);
const now = Date.parse('2026-10-20T18:00:00.000Z');
const indexHtml = '<!doctype html><title>AUTO Score</title>';

let t: TestApp | null = null;
let webDir: string | null = null;
afterEach(async () => {
  await t?.close();
  t = null;
  if (webDir !== null) {
    await rm(webDir, { recursive: true, force: true });
    webDir = null;
  }
});

async function createWebDir(files: Record<string, string>): Promise<string> {
  webDir = await mkdtemp(path.join(os.tmpdir(), 'autoscore-web-'));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(webDir, name)), { recursive: true });
    await writeFile(path.join(webDir, name), content);
  }
  return webDir;
}

async function withFront(): Promise<TestApp> {
  const dir = await createWebDir({
    'index.html': indexHtml,
    'assets/index-abc123.js': 'console.log(1);',
    'audio/pl/scores/60.mp3': 'mp3',
    'favicon.svg': '<svg/>',
    '.hidden': 'sekret',
    players: 'plik players',
    health: 'plik health',
  });
  t = await setup({ webDir: dir, auth: { password, tokenSecret }, now: () => now });
  return t;
}

function bearer(): { authorization: string } {
  return { authorization: `Bearer ${createToken(tokenSecret, now + 1000)}` };
}

function errorCode(response: { json(): unknown }): string {
  return ApiError.parse(response.json()).error;
}

describe('without a web dir', () => {
  it('answers GET / with 404', async () => {
    t = await setup();
    const response = await t.app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(404);
    expect(errorCode(response)).toBe('not_found');
  });
});

describe('with a web dir and a password', () => {
  it.each(['/', '/index.html'])('serves index.html at %s without a token and without caching', async (url) => {
    const { app } = await withFront();
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.body).toBe(indexHtml);
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it.each([
    ['/assets/index-abc123.js', 'public, max-age=31536000, immutable'],
    ['/audio/pl/scores/60.mp3', 'public, max-age=604800'],
    ['/favicon.svg', 'no-cache'],
  ])('serves %s without a token with Cache-Control %j', async (url, cacheControl) => {
    const { app } = await withFront();
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe(cacheControl);
  });

  it('answers HEAD on an asset without a token and without a body', async () => {
    const { app } = await withFront();
    const response = await app.inject({ method: 'HEAD', url: '/assets/index-abc123.js' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('keeps API routes ahead of files with the same name', async () => {
    const { app } = await withFront();
    const withoutToken = await app.inject({ method: 'GET', url: '/players' });
    expect(withoutToken.statusCode).toBe(401);
    expect(errorCode(withoutToken)).toBe('unauthorized');

    const withToken = await app.inject({ method: 'GET', url: '/players', headers: bearer() });
    expect(withToken.statusCode).toBe(200);
    expect(withToken.json()).toEqual([]);

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: 'ok' });
  });

  it.each(['/assets/missing.js', '/.hidden'])('answers %s with 401 without a token and 404 with one', async (url) => {
    const { app } = await withFront();
    const withoutToken = await app.inject({ method: 'GET', url });
    expect(withoutToken.statusCode).toBe(401);
    expect(errorCode(withoutToken)).toBe('unauthorized');

    const withToken = await app.inject({ method: 'GET', url, headers: bearer() });
    expect(withToken.statusCode).toBe(404);
    expect(errorCode(withToken)).toBe('not_found');
  });

  it('requires a token for POST /', async () => {
    const { app } = await withFront();
    const response = await app.inject({ method: 'POST', url: '/' });
    expect(response.statusCode).toBe(401);
    expect(errorCode(response)).toBe('unauthorized');
  });
});

describe('without a password', () => {
  it('serves GET / from the web dir', async () => {
    const dir = await createWebDir({ 'index.html': indexHtml });
    t = await setup({ webDir: dir });
    const response = await t.app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(indexHtml);
  });
});

describe('skipped files', () => {
  it.each(['/.git/config', '/odd:name.js'])('has no route for %s', async (url) => {
    const dir = await createWebDir({ 'index.html': indexHtml, '.git/config': 'x', 'odd:name.js': 'x' });
    t = await setup({ webDir: dir });
    const response = await t.app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(404);
    expect(errorCode(response)).toBe('not_found');
  });
});

describe('startup check', () => {
  it.each([
    ['an empty directory', async () => createWebDir({})],
    ['a missing directory', async () => path.join(await createWebDir({}), 'missing')],
  ])('rejects %s', async (_name, makeDir) => {
    const dir = await makeDir();
    const db = openDatabase(':memory:');
    try {
      await migrateToLatest(db);
      await expect(buildApp({ db, webDir: dir })).rejects.toThrow(`Missing index.html in AUTOSCORE_WEB_DIR: ${dir}`);
    } finally {
      await db.destroy();
    }
  });
});
