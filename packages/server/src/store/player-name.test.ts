import { describe, expect, it } from 'vitest';
import { normalizePlayerName } from './player-name.js';

describe('normalizePlayerName', () => {
  it.each([
    ['  Anna  ', 'anna'],
    ['ANNA', 'anna'],
    ['Anna   Maria', 'anna maria'],
    ['anna maria', 'anna maria'],
    ['ŁUKASZ', 'łukasz'],
  ])('turns %j into %j', (name, normalized) => {
    expect(normalizePlayerName(name)).toBe(normalized);
  });
});
