import { expect, test } from '@playwright/test';
import type { Player } from '@autoscore/schema';
import { FINISHING_DARTS, createMatchByApi, createPlayerByApi, loginByApi, postThrowsByApi } from './helpers/api';
import { currentThrower, keypadKey, throwerRow, waitForKeypad } from './helpers/game';
import { expectInViewport, expectNoHorizontalScroll, expectSameBox, keypadBox } from './helpers/layout';
import { uniqueName, useToken } from './helpers/session';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

let token = '';
let players: readonly [Player, Player];

// Jedna zakończona gra, żeby ekran statystyk nie był pusty.
test.beforeAll(async ({ playwright }, testInfo) => {
  const { baseURL } = testInfo.project.use;
  const api = await playwright.request.newContext(baseURL === undefined ? {} : { baseURL });
  try {
    token = await loginByApi(api);
    players = [await createPlayerByApi(api, token, uniqueName('Ewa')), await createPlayerByApi(api, token, uniqueName('Iza'))];
    const finished = await createMatchByApi(api, token, [players[0].id, players[1].id]);
    await postThrowsByApi(api, token, finished.id, FINISHING_DARTS);
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ context }) => {
  await useToken(context, token);
});

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('new game screen has no horizontal scroll', async ({ page }) => {
      await page.goto('/#/');
      await expect(page.getByRole('button', { name: 'Start gry' })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test('stats screen has no horizontal scroll', async ({ page }) => {
      await page.goto('/#/stats');
      await expect(page.getByRole('link', { name: players[0].name }).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test('game screen keeps the keypad in view and in place', async ({ page, request }) => {
      const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
      await page.goto(`/#/matches/${match.id}`);
      await waitForKeypad(page);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      await expectNoHorizontalScroll(page);
      const before = await keypadBox(page);
      await expectInViewport(before, page);

      const { other } = await currentThrower(page, [players[0].name, players[1].name]);
      await keypadKey(page, '1').click();
      await expect(throwerRow(page).getByText('300', { exact: true })).toBeVisible();
      expectSameBox(await keypadBox(page), before);

      await keypadKey(page, '1').click();
      await keypadKey(page, '1').click();
      await expect(throwerRow(page)).toContainText(other);
      const after = await keypadBox(page);
      expectSameBox(after, before);
      await expectInViewport(after, page);
    });
  });
}
