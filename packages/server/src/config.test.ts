import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses the defaults', () => {
    expect(loadConfig({})).toEqual({ host: '0.0.0.0', port: 3000, databasePath: 'autoscore.sqlite' });
  });

  it('reads the overrides', () => {
    expect(loadConfig({ HOST: '127.0.0.1', PORT: '3999', DATABASE_PATH: 'data/games.sqlite' })).toEqual({
      host: '127.0.0.1',
      port: 3999,
      databasePath: 'data/games.sqlite',
    });
  });

  it.each(['abc', '-1', '3000.5', '70000', ' 3000'])('rejects PORT %j', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/Invalid PORT/);
  });
});
