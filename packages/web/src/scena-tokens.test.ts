import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: number;
  fontWeight: number;
  letterSpacing?: string;
}

interface TokensJson {
  [group: string]: unknown;
  type: {
    families: { display: string; body: string };
    groups: { family: 'display' | 'body'; styles: TypeStyle[] }[];
  };
}

// W jsdom import ?raw pliku .css zwraca pusty tekst, więc pliki czytamy z dysku.
const css = readFileSync(resolve(import.meta.dirname, '../../../design/scena/tokens.css'), 'utf8');
const scena = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../design/scena/tokens.json'), 'utf8')) as TokensJson;

const groups = ['color', 'shadow', 'radius', 'spacing', 'opacity'];
const tokens = groups.flatMap((group) => (scena[group] as { tokens?: { name: string; value: string }[] } | undefined)?.tokens ?? []);
const families = Object.entries(scena.type.families);
const styles = scena.type.groups.flatMap((group) => group.styles.map((style) => ({ ...style, family: group.family })));

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function occurrences(declaration: string): number {
  return css.match(new RegExp(`(^|[\\s{;])${escape(declaration)}`, 'gm'))?.length ?? 0;
}

function ruleOf(name: string): Map<string, string> | null {
  const body = new RegExp(`(?:^|\\s)\\.${escape(name)}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  if (body === undefined) {
    return null;
  }
  const declarations = body
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      const colon = part.indexOf(':');
      return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as const;
    });
  return new Map(declarations);
}

describe('design/scena/tokens.css', () => {
  it('has 67 tokens, 2 font families and 21 type styles in tokens.json', () => {
    expect(tokens).toHaveLength(67);
    expect(families).toHaveLength(2);
    expect(styles).toHaveLength(21);
  });

  it.each(tokens.map((token) => [token.name, token.value]))('declares --%s once with the value from tokens.json', (name, value) => {
    expect(occurrences(`--${name}: ${value};`)).toBe(1);
  });

  it.each(families)('declares --font-%s with the family from tokens.json', (name, value) => {
    expect(occurrences(`--font-${name}: ${value};`)).toBe(1);
  });

  it('declares no other custom properties', () => {
    const declared = Array.from(css.matchAll(/(--[\w-]+)\s*:/g), (match) => match[1]).sort();
    const expected = [...tokens.map((token) => `--${token.name}`), ...families.map(([name]) => `--font-${name}`)].sort();
    expect(declared).toHaveLength(69);
    expect(declared).toEqual(expected);
  });

  it.each(styles.map((style) => [style.name, style]))('has a .%s rule matching tokens.json', (name, style) => {
    const expected = new Map([
      ['font-family', `var(--font-${style.family})`],
      ['font-size', style.fontSize],
      ['line-height', String(style.lineHeight)],
      ['font-weight', String(style.fontWeight)],
    ]);
    if (style.letterSpacing !== undefined) {
      expected.set('letter-spacing', style.letterSpacing);
    }
    const rule = ruleOf(name);
    expect(rule && Object.fromEntries(rule)).toEqual(Object.fromEntries(expected));
  });
});
