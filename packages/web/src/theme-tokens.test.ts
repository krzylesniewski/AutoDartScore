import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// W jsdom import ?raw pliku .css zwraca pusty tekst, więc pliki czytamy z dysku.
const theme = readFileSync(resolve(import.meta.dirname, '../../../design/theme.css'), 'utf8');
const scena = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../design/scena/tokens.json'), 'utf8')) as Record<
  string,
  { tokens?: { name: string; value: string }[] }
>;

const groups = ['color', 'shadow', 'radius', 'spacing', 'opacity'];
const tokens = groups.flatMap((group) => scena[group]?.tokens ?? []);

describe('design/theme.css', () => {
  it('declares all 67 Scena tokens', () => {
    expect(tokens).toHaveLength(67);
  });

  it.each(tokens.map((token) => [token.name, token.value]))('declares --%s with the value from tokens.json', (name, value) => {
    const declarations = theme.split('\n').filter((line) => line.trim().startsWith(`--${name}:`));
    expect(declarations).toHaveLength(1);
    expect(declarations[0]?.trim()).toMatch(new RegExp(`^--${name}: ${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`));
  });

  it('declares every custom property once', () => {
    const names = Array.from(theme.matchAll(/^\s*(--[\w-]+)\s*:/gm), (match) => match[1]);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    expect(duplicates).toEqual([]);
  });

  it('keeps theme A tokens as aliases of Scena tokens', () => {
    expect(theme).toContain('--color-surface-header: var(--color-surface-softer);');
    expect(theme).toContain('--color-surface-button: var(--color-surface-soft);');
    expect(theme).toContain('--color-surface-active: var(--color-surface-raised);');
    expect(theme).toContain('--color-border-subtle: var(--color-border);');
    expect(theme).toContain('--color-border-strong: var(--color-border);');
  });

  it('keeps the border width and the button height', () => {
    expect(theme).toContain('--border-width: 2px;');
    expect(theme).toContain('--button-height: 56px;');
  });
});
