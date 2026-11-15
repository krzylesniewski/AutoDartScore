import { expect, test, type Page } from '@playwright/test';
import { PASSWORD } from './env';
import { blur, currentThrower, keypadKey, playerRow, pressKeys, throwerRow, waitForKeypad } from './helpers/game';
import { keypadRegion } from './helpers/layout';
import { uniqueName } from './helpers/session';

test.use({ viewport: { width: 1280, height: 800 } });

function dartSlot(page: Page, index: number) {
  return page.getByRole('listitem', { name: `Rzutka ${index}` });
}

async function addPlayer(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: '+ Nowy gracz' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nowy gracz' });
  await dialog.getByLabel('Imię').fill(name);
  await dialog.getByRole('button', { name: 'Dodaj', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name, pressed: true })).toBeVisible();
}

function statValue(page: Page, term: string) {
  return page.locator('dt').filter({ hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
}

test('plays a 1v1 game through the UI on the production configuration', async ({ page, context, request }) => {
  const anonymous = await request.get('/players');
  expect(anonymous.status()).toBe(401);

  await page.goto('/');
  await page.getByLabel('Hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Zaloguj' }).click();

  await page.getByRole('button', { name: /^Mecz 1v1/ }).click();
  const names = [uniqueName('Ala'), uniqueName('Ola')] as const;
  await addPlayer(page, names[0]);
  await addPlayer(page, names[1]);
  await page.getByRole('button', { name: 'Start gry' }).click();
  await expect(page).toHaveURL(/#\/matches\/[^/]+$/);
  const matchId = new URL(page.url()).hash.replace('#/matches/', '');

  const page2 = await context.newPage();
  const socket = page2.waitForEvent('websocket');
  await page2.goto(page.url());
  expect((await socket).url()).toContain(`/matches/${matchId}/live`);

  await waitForKeypad(page);
  await waitForKeypad(page2);
  const { thrower: x, other: y } = await currentThrower(page, names);

  // Tura 1 (X): T20 klawiszami na ekranie, pomyłka cofnięta, potem dwa razy T20 skrótami.
  await keypadKey(page, 'T').click();
  await keypadKey(page, '20').click();
  await expect(dartSlot(page, 1)).toContainText('T20');
  await keypadKey(page, '5').click();
  await expect(dartSlot(page, 2)).toContainText('5');
  const undo = keypadRegion(page).getByRole('button', { name: 'Cofnij' });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(dartSlot(page, 2)).toContainText('czeka na rzutkę');
  await expect(dartSlot(page, 1)).toContainText('T20');

  await blur(page);
  await pressKeys(page, ['t', '2', '0', 't', '2', '0']);
  await expect(playerRow(page, x).getByText('121', { exact: true })).toBeVisible();
  await expect(playerRow(page2, x).getByText('121', { exact: true })).toBeVisible();

  // Tura 2 (Y): Miss spacją i reszta tury jednym przyciskiem.
  await expect(throwerRow(page)).toContainText(y);
  await page.keyboard.press('Space');
  await expect(dartSlot(page, 1)).toContainText('Miss');
  await keypadRegion(page).getByRole('button', { name: 'Reszta Miss' }).click();
  await expect(throwerRow(page)).toContainText(x);
  await expect(playerRow(page, y).getByText('301', { exact: true })).toBeVisible();

  // Tura 3 (X): 121 zamknięte przez T20, T11, D14.
  await blur(page);
  await pressKeys(page, ['t', '2', '0', 't', '1', '1', 'd', '1', '4']);
  await expect(page.getByText('Mecz zakończony')).toBeVisible();
  await expect(page.getByText(`${x} wygrywa`)).toBeVisible();
  await expect(page2.getByText('Mecz zakończony')).toBeVisible();

  await page.getByRole('link', { name: 'Zapisz i wyjdź' }).click();
  await page.getByRole('link', { name: 'Statystyki', exact: true }).click();
  await page.getByRole('link', { name: x }).first().click();
  await expect(page).toHaveURL(/#\/stats\/[^/]+$/);
  await expect(statValue(page, 'Najwyższe zamknięcie')).toHaveText('121');
  await expect.poll(async () => Number(await statValue(page, '180').textContent())).toBeGreaterThanOrEqual(1);
});
