import { randomUUID } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';

const TOKEN_KEY = 'autoscore.token';

export async function useToken(context: BrowserContext, token: string): Promise<void> {
  await context.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), { key: TOKEN_KEY, value: token });
}

// Imiona są unikalne bez wielkości liter, a --repeat-each używa tej samej bazy.
export function uniqueName(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}
