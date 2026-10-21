import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { avatarColorClass } from './avatar-color';

// W jsdom new URL(..., import.meta.url) nie daje ścieżki file:, a import ?raw pliku .css zwraca pusty tekst.
const theme = readFileSync(resolve(import.meta.dirname, '../../../../design/theme.css'), 'utf8');

function token(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i').exec(theme)?.[1];
}

// Względna luminancja według WCAG 2.x.
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

describe('avatarColorClass', () => {
  it.each([
    [1, 'bg-(--color-avatar-1)'],
    [7, 'bg-(--color-avatar-7)'],
    [16, 'bg-(--color-avatar-16)'],
  ])('maps color %i to %s', (color, className) => {
    expect(avatarColorClass(color)).toBe(className);
  });

  it.each([0, 17, -1, 1.5])('falls back to color 1 for %d', (color) => {
    expect(avatarColorClass(color)).toBe('bg-(--color-avatar-1)');
  });
});

describe('avatar color tokens', () => {
  const colors = Array.from({ length: 16 }, (_, index) => index + 1);

  it('defines exactly --color-avatar-1 to --color-avatar-16', () => {
    const names = [...theme.matchAll(/--color-avatar-(\d+):/g)].map((match) => Number(match[1]));
    expect(names).toEqual(colors);
  });

  it.each(colors)('gives text on --color-avatar-%i a contrast of at least 4.5:1', (color) => {
    const background = token(`color-avatar-${color}`);
    const text = token('color-on-avatar');
    expect(background).toBeDefined();
    expect(text).toBeDefined();
    expect(contrast(background ?? '', text ?? '')).toBeGreaterThanOrEqual(4.5);
  });
});
