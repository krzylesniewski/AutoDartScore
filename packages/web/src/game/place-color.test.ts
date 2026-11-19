import { describe, expect, it } from 'vitest';
import { placeColor } from './place-color';

describe('placeColor', () => {
  it('gives the medal tokens to places 1-3 and the muted text to the rest', () => {
    expect([1, 2, 3, 4, 16].map(placeColor)).toEqual([
      'text-(--color-gold)',
      'text-(--color-silver)',
      'text-(--color-bronze)',
      'text-(--color-text-muted)',
      'text-(--color-text-muted)',
    ]);
  });
});
