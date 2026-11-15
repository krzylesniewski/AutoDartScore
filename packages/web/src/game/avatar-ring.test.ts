import { describe, expect, it } from 'vitest';
import { avatarRingClasses } from './avatar-ring';

describe('avatarRingClasses', () => {
  it.each([
    [1, 'ring-(--color-avatar-1)', 'inset-ring-(--color-avatar-1)'],
    [7, 'ring-(--color-avatar-7)', 'inset-ring-(--color-avatar-7)'],
    [16, 'ring-(--color-avatar-16)', 'inset-ring-(--color-avatar-16)'],
  ])('maps color %i to its ring classes', (color, ring, insetRing) => {
    expect(avatarRingClasses(color)).toEqual({ ring, insetRing });
  });

  it.each([0, 17])('falls back to color 1 for %i', (color) => {
    expect(avatarRingClasses(color)).toEqual({ ring: 'ring-(--color-avatar-1)', insetRing: 'inset-ring-(--color-avatar-1)' });
  });
});
