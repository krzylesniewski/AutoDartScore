import { expect, type Locator, type Page } from '@playwright/test';
import { keypadRegion } from './layout';

export function scoreboard(page: Page): Locator {
  return page.getByRole('region', { name: 'Wyniki' });
}

export function throwerRow(page: Page): Locator {
  return scoreboard(page).locator('li[aria-current="true"]');
}

export function playerRow(page: Page, name: string): Locator {
  return scoreboard(page).getByRole('listitem').filter({ hasText: name });
}

export function keypadKey(page: Page, name: string): Locator {
  return keypadRegion(page).getByRole('button', { name, exact: true });
}

// Klawiatura działa dopiero przy otwartym WebSockecie, a skróty wpisane wcześniej przepadają bez błędu.
export async function waitForKeypad(page: Page): Promise<void> {
  await expect(keypadKey(page, '20')).toBeEnabled();
}

// Spacja i Enter na przycisku spoza klawiatury należą do przeglądarki.
export async function blur(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

export async function pressKeys(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

// Kto zaczyna, losuje serwer, więc rzucającego odczytujemy z paska wyników.
export async function currentThrower(page: Page, names: readonly [string, string]): Promise<{ thrower: string; other: string }> {
  const text = (await throwerRow(page).textContent()) ?? '';
  const [first, second] = names;
  if (text.includes(first) === text.includes(second)) {
    throw new Error(`Cannot tell the thrower from the row text: ${text}`);
  }
  return text.includes(first) ? { thrower: first, other: second } : { thrower: second, other: first };
}
