import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const off = { AUTOSCORE_AUTH: 'off' };

function errorOf(env: NodeJS.ProcessEnv): Error {
  try {
    loadConfig(env);
  } catch (error) {
    return error as Error;
  }
  throw new Error('loadConfig did not throw');
}

describe('loadConfig', () => {
  it('uses the defaults', () => {
    expect(loadConfig({ ...off })).toEqual({
      host: '0.0.0.0',
      port: 3000,
      databasePath: 'autoscore.sqlite',
      auth: null,
      corsOrigins: null,
      webDir: null,
      matchLockMinutes: 5,
    });
  });

  it('reads the overrides', () => {
    expect(loadConfig({ ...off, HOST: '127.0.0.1', PORT: '3999', DATABASE_PATH: 'data/games.sqlite' })).toEqual({
      host: '127.0.0.1',
      port: 3999,
      databasePath: 'data/games.sqlite',
      auth: null,
      corsOrigins: null,
      webDir: null,
      matchLockMinutes: 5,
    });
  });

  it.each(['abc', '-1', '3000.5', '70000', ' 3000'])('rejects PORT %j', (port) => {
    expect(() => loadConfig({ ...off, PORT: port })).toThrow(/Invalid PORT/);
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

  it.each([undefined, '', ' ', 'on', ' on '])('requires login with AUTOSCORE_AUTH %j', (mode) => {
    const env = mode === undefined ? {} : { AUTOSCORE_AUTH: mode };
    expect(loadConfig({ ...env, AUTOSCORE_PASSWORD: 'tajne-haslo', AUTOSCORE_TOKEN_SECRET: secret }).auth).toEqual({
      password: 'tajne-haslo',
      tokenSecret: secret,
    });
  });

  it.each([{}, { AUTOSCORE_PASSWORD: '' }, { AUTOSCORE_AUTH: 'on' }, { AUTOSCORE_AUTH: '', AUTOSCORE_TOKEN_SECRET: secret }])(
    'refuses to start without a password for %j',
    (env) => {
      expect(() => loadConfig(env)).toThrow('Missing AUTOSCORE_PASSWORD (set AUTOSCORE_AUTH=off to run without a password)');
    },
  );

  it.each([{ AUTOSCORE_AUTH: 'off' }, { AUTOSCORE_AUTH: ' off ', AUTOSCORE_TOKEN_SECRET: 'short' }, { AUTOSCORE_AUTH: 'off', AUTOSCORE_PASSWORD: '' }])(
    'turns auth off only when asked for %j',
    (env) => {
      expect(loadConfig(env).auth).toBeNull();
    },
  );

  it.each([{ AUTOSCORE_PASSWORD: 'x' }, { AUTOSCORE_PASSWORD: 'x', AUTOSCORE_TOKEN_SECRET: secret }])(
    'rejects AUTOSCORE_AUTH=off together with a password: %j',
    (env) => {
      const error = errorOf({ ...env, AUTOSCORE_AUTH: 'off' });
      expect(error.message).toBe('AUTOSCORE_AUTH=off conflicts with AUTOSCORE_PASSWORD');
    },
  );

  it.each(['OFF', 'On', 'false', '0', 'yes', 'disabled'])('rejects AUTOSCORE_AUTH %j', (mode) => {
    expect(() => loadConfig({ AUTOSCORE_AUTH: mode, AUTOSCORE_PASSWORD: 'tajne-haslo', AUTOSCORE_TOKEN_SECRET: secret })).toThrow(
      `Invalid AUTOSCORE_AUTH: ${mode}`,
    );
  });

  it.each(['zmien-to-haslo', ' zmien-to-haslo '])('rejects the example password %j without printing it', (password) => {
    const error = errorOf({ AUTOSCORE_PASSWORD: password, AUTOSCORE_TOKEN_SECRET: secret });
    expect(error.message).toBe('Invalid AUTOSCORE_PASSWORD: replace the example value from deploy/autoscore.env.example');
    expect(error.message).not.toContain('zmien-to-haslo');
  });

  it('rejects the password from deploy/autoscore.env.example', () => {
    const example = readFileSync(new URL('../../../deploy/autoscore.env.example', import.meta.url), 'utf8');
    const password = /^AUTOSCORE_PASSWORD=(.*)$/m.exec(example)?.[1];
    expect(password).toBeTruthy();
    expect(() => loadConfig({ AUTOSCORE_PASSWORD: password, AUTOSCORE_TOKEN_SECRET: secret })).toThrow(/^Invalid AUTOSCORE_PASSWORD/);
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
    expect(loadConfig({ ...off, AUTOSCORE_CORS_ORIGIN: value }).corsOrigins).toBeNull();
  });

  it('reads a list with spaces and skips empty entries', () => {
    expect(loadConfig({ ...off, AUTOSCORE_CORS_ORIGIN: ' https://front.example , http://localhost:5173,, ' }).corsOrigins).toEqual([
      'https://front.example',
      'http://localhost:5173',
    ]);
  });

  it.each(['https://front.example/', 'https://front.example/app', 'front.example', '*', 'https://FRONT.example', 'https://front.example:443'])(
    'rejects the entry %j',
    (entry) => {
      expect(() => loadConfig({ ...off, AUTOSCORE_CORS_ORIGIN: `https://ok.example,${entry}` })).toThrow(`Invalid AUTOSCORE_CORS_ORIGIN: ${entry}`);
    },
  );
});

describe('loadConfig web dir', () => {
  it.each([{}, { AUTOSCORE_WEB_DIR: '' }, { AUTOSCORE_WEB_DIR: '  ' }])('turns serving the front off for %j', (env) => {
    expect(loadConfig({ ...off, ...env }).webDir).toBeNull();
  });

  it('keeps an absolute path', () => {
    expect(loadConfig({ ...off, AUTOSCORE_WEB_DIR: ' /srv/autoscore/web/dist ' }).webDir).toBe(path.resolve('/srv/autoscore/web/dist'));
  });

  it('resolves a relative path against the working directory', () => {
    expect(loadConfig({ ...off, AUTOSCORE_WEB_DIR: 'rel/dist' }).webDir).toBe(path.resolve('rel/dist'));
  });
});

describe('loadConfig match lock', () => {
  it.each([
    [{}, 5],
    [{ AUTOSCORE_MATCH_LOCK_MINUTES: '' }, 5],
    [{ AUTOSCORE_MATCH_LOCK_MINUTES: '0' }, 0],
    [{ AUTOSCORE_MATCH_LOCK_MINUTES: '15' }, 15],
    [{ AUTOSCORE_MATCH_LOCK_MINUTES: '525600' }, 525_600],
  ])('reads %j as %i minutes', (env, minutes) => {
    expect(loadConfig({ ...off, ...env }).matchLockMinutes).toBe(minutes);
  });

  it.each(['abc', '-1', '2.5', ' 5', '525601'])('rejects %j', (value) => {
    expect(() => loadConfig({ ...off, AUTOSCORE_MATCH_LOCK_MINUTES: value })).toThrow(`Invalid AUTOSCORE_MATCH_LOCK_MINUTES: ${value}`);
  });
});
