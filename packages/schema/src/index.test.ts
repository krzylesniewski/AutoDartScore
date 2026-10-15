import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index.js';

describe('schema', () => {
  it('exports the package name', () => {
    expect(PACKAGE_NAME).toBe('@autoscore/schema');
  });
});
