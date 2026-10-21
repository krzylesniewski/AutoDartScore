import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { defaultPlayerColor } from './player-color.js';

describe('defaultPlayerColor', () => {
  it.each([
    ['p1', 2],
    ['p2', 3],
    ['anna', 15],
  ])('gives %s the color %i', (id, color) => {
    expect(defaultPlayerColor(id)).toBe(color);
  });

  it('stays within 1-16 for many ids', () => {
    const ids = [...Array.from({ length: 500 }, () => randomUUID()), ...Array.from({ length: 100 }, (_, index) => `p${index}`), 'ż', '🎯'];
    for (const id of ids) {
      const color = defaultPlayerColor(id);
      expect(Number.isInteger(color)).toBe(true);
      expect(color).toBeGreaterThanOrEqual(1);
      expect(color).toBeLessThanOrEqual(16);
    }
  });

  it('gives the same color on every call', () => {
    const id = randomUUID();
    const color = defaultPlayerColor(id);
    for (let call = 0; call < 10; call++) {
      expect(defaultPlayerColor(id)).toBe(color);
    }
  });
});
