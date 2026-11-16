import { expect, test } from '@playwright/test';

// Bez tokenu aplikacja pokazuje ekran logowania z fokusem w polu hasła. „Zaloguj” jest nieaktywne przy pustym polu,
// więc test wpisuje znak, żeby Tab przeniósł fokus na przycisk, a nie poza stronę.
test('keyboard focus has a solid outline in forced-colors mode', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  const password = page.getByLabel('Hasło');
  await expect(password).toBeFocused();
  await page.keyboard.type('x');

  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveAccessibleName('Zaloguj');
  await expect(focused).toHaveCSS('outline-style', 'solid');
  await expect(focused).toHaveCSS('outline-width', '2px');
});
