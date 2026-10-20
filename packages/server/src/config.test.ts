import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses the defaults', () => {
    expect(loadConfig({})).toEqual({ host: '0.0.0.0', port: 3000, databasePath: 'autoscore.sqlite', auth: null, corsOrigins: null, webDir: null });
  });

  it('reads the overrides', () => {
    expect(loadConfig({ HOST: '127.0.0.1', PORT: '3999', DATABASE_PATH: 'data/games.sqlite' })).toEqual({
      host: '127.0.0.1',
      port: 3999,
      databasePath: 'data/games.sqlite',
      auth: null,
      corsOrigins: null,
      webDir: null,
    });
  });

  it.each(['abc', '-1', '3000.5', '70000', ' 3000'])('rejects PORT %j', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/Invalid PORT/);
  });
});

describe('loadConfig auth', () => {
  const secret = 'a'.repeat(32);

  it('reads the password and the secret', () => {
    expect(loadConfig({ AUTOSCORE_PASSWORD: ' tajne hasło ', AUTOSCORE_TOKEN_SECRET: secret }).auth).toEqual({
      password: ' tajne hasło ',
      tokenSecret: secret,
    });
  });

  it.each([{}, { AUTOSCORE_PASSWORD: '' }, { AUTOSCORE_PASSWORD: '', AUTOSCORE_TOKEN_SECRET: 'short' }])('turns auth off for %j', (env) => {
    expect(loadConfig(env).auth).toBeNull();
  });

  it.each([{ AUTOSCORE_PASSWORD: 'x' }, { AUTOSCORE_PASSWORD: 'x', AUTOSCORE_TOKEN_SECRET: '' }])('requires a secret with a password: %j', (env) => {
    expect(() => loadConfig(env)).toThrow('Missing AUTOSCORE_TOKEN_SECRET');
  });

  it('rejects a secret shorter than 32 characters without printing it', () => {
    expect(() => loadConfig({ AUTOSCORE_PASSWORD: 'tajne-haslo', AUTOSCORE_TOKEN_SECRET: 'b'.repeat(31) })).toThrow(
      /^Invalid AUTOSCORE_TOKEN_SECRET: at least 32 characters$/,
    );
  });
});

describe('loadConfig CORS', () => {
  it.each(['', ' ', ' , ,'])('turns CORS off for %j', (value) => {
    expect(loadConfig({ AUTOSCORE_CORS_ORIGIN: value }).corsOrigins).toBeNull();
  });

  it('reads a list with spaces and skips empty entries', () => {
    expect(loadConfig({ AUTOSCORE_CORS_ORIGIN: ' https://front.example , http://localhost:5173,, ' }).corsOrigins).toEqual([
      'https://front.example',
      'http://localhost:5173',
    ]);
  });

  it.each(['https://front.example/', 'https://front.example/app', 'front.example', '*', 'https://FRONT.example', 'https://front.example:443'])(
    'rejects the entry %j',
    (entry) => {
      expect(() => loadConfig({ AUTOSCORE_CORS_ORIGIN: `https://ok.example,${entry}` })).toThrow(`Invalid AUTOSCORE_CORS_ORIGIN: ${entry}`);
    },
  );
});

describe('loadConfig web dir', () => {
  it.each([{}, { AUTOSCORE_WEB_DIR: '' }, { AUTOSCORE_WEB_DIR: '  ' }])('turns serving the front off for %j', (env) => {
    expect(loadConfig(env).webDir).toBeNull();
  });

  it('keeps an absolute path', () => {
    expect(loadConfig({ AUTOSCORE_WEB_DIR: ' /srv/autoscore/web/dist ' }).webDir).toBe(path.resolve('/srv/autoscore/web/dist'));
  });

  it('resolves a relative path against the working directory', () => {
    expect(loadConfig({ AUTOSCORE_WEB_DIR: 'rel/dist' }).webDir).toBe(path.resolve('rel/dist'));
  });
});
