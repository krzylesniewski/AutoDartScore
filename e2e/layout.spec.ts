import { expect, test, type Locator, type Page, type WebSocketRoute } from '@playwright/test';
import type { Hit, Player } from '@autoscore/schema';
import { FINISHING_DARTS, MISS, abandonMatchByApi, createMatchByApi, createPlayerByApi, createPracticeByApi, frequentHitsByApi, loginByApi, postThrowsByApi } from './helpers/api';
import { currentThrower, keypadKey, scoreboard, throwerRow, waitForKeypad } from './helpers/game';
import { boxOf, expectInViewport, expectNoHorizontalScroll, expectNoOverlap, expectSameBox, keypadBox } from './helpers/layout';
import { uniqueName, useToken } from './helpers/session';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

// Poniżej lg (1024 px) historia tur otwiera się przyciskiem „Tury”, a od lg stoi stale w lewej kolumnie.
const LG = 1024;

const T20: Hit = { segment: 20, multiplier: 3 };

// Z 301 zaczynający ma po sześciu rzutkach 121, po T20 zostaje mu 61 z trasą zamknięcia, a drugie T20 zostawia 1, czyli bust.
const BEFORE_BUST: readonly Hit[] = [...FINISHING_DARTS.slice(0, 6), T20];

// Dziesięć tur po trzy pudła: w obu tabelach historii jest więcej wierszy, niż mieści się bez przewijania.
const TEN_MISSED_TURNS: readonly Hit[] = Array.from({ length: 30 }, () => MISS);

let token = '';
let players: readonly [Player, Player];
let finishedId = '';

// Jedna zakończona gra, żeby ekran statystyk nie był pusty, a widok końca meczu miał co pokazać.
test.beforeAll(async ({ playwright }, testInfo) => {
  const { baseURL } = testInfo.project.use;
  const api = await playwright.request.newContext(baseURL === undefined ? {} : { baseURL });
  try {
    token = await loginByApi(api);
    players = [await createPlayerByApi(api, token, uniqueName('Ewa')), await createPlayerByApi(api, token, uniqueName('Iza'))];
    const finished = await createMatchByApi(api, token, [players[0].id, players[1].id]);
    await postThrowsByApi(api, token, finished.id, FINISHING_DARTS);
    finishedId = finished.id;
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ context }) => {
  await useToken(context, token);
});

async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function expectBoxInViewport(page: Page, control: Locator): Promise<void> {
  await expect(control).toBeVisible();
  await expectInViewport(await boxOf(control), page);
}

// Czy element leży w poziomie w obrębie najbliższego przodka, który przewija się w poziomie.
async function insideHorizontalScroll(element: Locator): Promise<boolean> {
  return element.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    let scroller = node.parentElement;
    while (scroller && scroller.scrollWidth <= scroller.clientWidth) {
      scroller = scroller.parentElement;
    }
    if (!scroller) {
      return true;
    }
    const box = scroller.getBoundingClientRect();
    return rect.left >= box.left - 1 && rect.right <= box.right + 1;
  });
}

// Najbliższy przodek z overflow-y auto albo scroll, czyli kontener, w którym element się przewija.
async function verticalScroller(element: Locator): Promise<{ bottom: number; holdsScoreboard: boolean; holdsKeypad: boolean } | null> {
  return element.evaluate((node) => {
    let scroller = node.parentElement;
    while (scroller && !['auto', 'scroll'].includes(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    if (!scroller) {
      return null;
    }
    return {
      bottom: scroller.getBoundingClientRect().bottom,
      holdsScoreboard: scroller.contains(document.querySelector('[aria-label="Wyniki"]')),
      holdsKeypad: scroller.contains(document.querySelector('[aria-label="Klawiatura rzutek"]')),
    };
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('new game screen has no horizontal scroll', async ({ page }) => {
      await page.goto('/#/');
      await expect(page.getByRole('heading', { level: 1, name: 'Nowa gra' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start gry' })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test('stats screen has no horizontal scroll', async ({ page }) => {
      await page.goto('/#/stats');
      await expect(page.getByRole('link', { name: players[0].name }).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test('player stats card has no horizontal scroll', async ({ page }) => {
      await page.goto(`/#/stats/${players[0].id}`);
      await expect(page.getByRole('region', { name: players[0].name })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test('history screen has no horizontal scroll', async ({ page }) => {
      await page.goto('/#/history');
      await expect(page.getByText(players[0].name).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test('settings screen opens from the nav, shows the status texts and has no horizontal scroll', async ({ page }) => {
      await page.goto('/#/history');
      await page.getByRole('navigation').getByRole('link', { name: 'Ustawienia' }).click();
      await expect(page.getByRole('link', { name: 'Ustawienia' })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByText('Kamera: brak')).toBeVisible();
      await expect(page.getByText(/^Głos: /)).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test('end-of-match view has no horizontal scroll and keeps its buttons in view', async ({ page }) => {
      await page.goto(`/#/matches/${finishedId}`);
      await expect(page.getByRole('button', { name: 'Rewanż', exact: true })).toBeVisible();
      await fontsReady(page);
      await expectNoHorizontalScroll(page);
      for (const control of [page.getByRole('button', { name: 'Rewanż', exact: true }), page.getByRole('link', { name: 'Nowy mecz', exact: true })]) {
        await expectBoxInViewport(page, control);
        // Próbne kliknięcie sprawdza, że nakładka ze statusem nie przykrywa przycisku, i niczego nie zmienia.
        await control.click({ trial: true });
      }
    });

    test('checkout practice has no horizontal scroll and keeps its actions in view', async ({ page, request }) => {
      const practice = await createPracticeByApi(request, token, players[0].id, { practiceMode: 'checkouts', checkoutRange: '2-50' });
      await page.goto(`/#/matches/${practice.id}`);
      const success = page.getByRole('button', { name: 'Udało się', exact: true });
      await expect(success).toBeEnabled();
      await fontsReady(page);

      await expectNoHorizontalScroll(page);
      for (const name of ['Udało się', 'Nie udało się']) {
        const result = page.getByRole('button', { name, exact: true });
        await expectBoxInViewport(page, result);
        expect((await boxOf(result)).height).toBeGreaterThanOrEqual(56);
      }
      const results = await boxOf(success);
      const skip = await boxOf(page.getByRole('button', { name: 'Nowa końcówka', exact: true }));
      const undo = await boxOf(page.getByRole('button', { name: 'Cofnij', exact: true }));
      expect(Math.abs(skip.y - undo.y)).toBeLessThanOrEqual(1);
      expect(skip.y).toBeGreaterThanOrEqual(results.y + results.height);

      await success.click();
      await expect(page.getByText('Brak prób')).toHaveCount(0);
      expectSameBox(await boxOf(success), results);
    });

    test('bust shows the banner without moving or covering the keypad', async ({ page, request }) => {
      const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
      await page.goto(`/#/matches/${match.id}`);
      await waitForKeypad(page);
      await fontsReady(page);
      await expect(keypadKey(page, '20')).toHaveCSS('touch-action', 'manipulation');
      const before = await keypadBox(page);

      await postThrowsByApi(request, token, match.id, BEFORE_BUST);
      await expect(page.getByRole('button', { name: /^Zamknięcie/ })).toBeVisible();
      expectSameBox(await keypadBox(page), before);

      await postThrowsByApi(request, token, match.id, [T20]);
      const banner = page.getByRole('status').locator('p').filter({ hasText: 'Bust' });
      await expect(banner).toBeVisible();
      expectNoOverlap(await boxOf(banner), await keypadBox(page));
      expectSameBox(await keypadBox(page), before);
    });

    test('grid keypad stays in view and in place', async ({ page, context, request }) => {
      await context.addInitScript(() => window.localStorage.setItem('autoscore.keypadLayout', 'grid'));
      const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
      await page.goto(`/#/matches/${match.id}`);
      await waitForKeypad(page);
      await fontsReady(page);
      // Klawisze koła mają pozycję w stylu inline, a siatka nie.
      await expect(keypadKey(page, '20')).not.toHaveAttribute('style', /left/);
      await expect(keypadKey(page, '20')).toHaveCSS('touch-action', 'manipulation');

      await expectNoHorizontalScroll(page);
      const before = await keypadBox(page);
      await expectInViewport(before, page);

      await keypadKey(page, '1').click();
      await expect(throwerRow(page).getByText('300', { exact: true })).toBeVisible();
      expectSameBox(await keypadBox(page), before);
    });

    test('connection notice does not move the keypad', async ({ page, request }) => {
      // Pierwsze połączenie idzie do serwera, a po zerwaniu każde kolejne kończy się od razu, więc komunikat zostaje.
      let cut = false;
      const sockets: WebSocketRoute[] = [];
      await page.routeWebSocket(/\/live$/, (socket) => {
        if (cut) {
          void socket.close();
          return;
        }
        socket.connectToServer();
        sockets.push(socket);
      });
      const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
      await page.goto(`/#/matches/${match.id}`);
      await waitForKeypad(page);
      await fontsReady(page);
      const before = await keypadBox(page);

      cut = true;
      for (const socket of sockets) {
        await socket.close();
      }
      await expect(page.getByText('Brak połączenia z serwerem. Łączę ponownie…')).toBeVisible();
      expectSameBox(await keypadBox(page), before);
    });

    test('Solo 501 history starts at the current turn without horizontal scroll', async ({ page, request }) => {
      const solo = await createPracticeByApi(request, token, players[0].id, { practiceMode: 'solo_501' });
      await page.goto(`/#/matches/${solo.id}`);
      await waitForKeypad(page);
      await postThrowsByApi(request, token, solo.id, TEN_MISSED_TURNS);
      if (viewport.width < LG) {
        await page.getByRole('button', { name: 'Tury' }).click();
      }
      const table = page.getByRole('table', { name: 'Przebieg lega' });
      await expect(table.getByRole('columnheader')).toHaveCount(12);
      const current = table.getByRole('cell').filter({ hasText: 'rzuca teraz' });
      await expect(current).toBeVisible();
      expect(await insideHorizontalScroll(current)).toBe(true);
      await expectNoHorizontalScroll(page);
    });

    if (viewport.width < LG) {
      test('Tury swaps the scoreboard for the turn history without moving the keypad', async ({ page, request }) => {
        const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
        await page.goto(`/#/matches/${match.id}`);
        await waitForKeypad(page);
        await fontsReady(page);
        await postThrowsByApi(request, token, match.id, TEN_MISSED_TURNS);
        // Panel jest jeszcze ukryty, a role pomijają ukryte elementy, więc wiersz szukamy po atrybucie.
        const current = page.locator('tr[aria-current="true"]');
        await expect(current.locator('th')).toHaveText('6');
        const before = await keypadBox(page);

        await page.getByRole('button', { name: 'Tury' }).click();
        await expect(page.getByRole('heading', { name: 'Historia tur · Leg 1' })).toBeVisible();
        await expect(scoreboard(page)).toBeHidden();
        await expect(current).toBeInViewport();
        const open = await keypadBox(page);
        expectSameBox(open, before);
        await expectInViewport(open, page);

        await page.getByRole('button', { name: 'Zamknij historię tur' }).click();
        await expect(scoreboard(page)).toBeVisible();
        expectSameBox(await keypadBox(page), before);
      });
    } else {
      test('turn history stays in view from lg and the menu toggle hides without menu actions', async ({ page, request }) => {
        const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
        await page.goto(`/#/matches/${match.id}`);
        await waitForKeypad(page);
        await postThrowsByApi(request, token, match.id, TEN_MISSED_TURNS);
        await expect(page.getByRole('heading', { name: 'Historia tur · Leg 1' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Tury' })).toBeHidden();
        await expect(page.getByRole('button', { name: 'Menu gry' })).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectInViewport(await keypadBox(page), page);

        // Lewa kolumna przewija się sama: jej przewijany kontener trzyma pasek wyników bez klawiatury i kończy się w oknie.
        const heading = page.getByRole('heading', { name: 'Historia tur · Leg 1' });
        const column = await verticalScroller(heading);
        expect(column).not.toBeNull();
        expect(column?.holdsScoreboard).toBe(true);
        expect(column?.holdsKeypad).toBe(false);
        expect(column?.bottom).toBeLessThanOrEqual(viewport.height + 1);
        expect(await page.evaluate(() => (document.scrollingElement ? document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight : 0))).toBeLessThanOrEqual(1);
        const current = page.locator('tr[aria-current="true"]');
        await current.scrollIntoViewIfNeeded();
        await expect(current).toBeInViewport();
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        expect((await boxOf(page.locator('section[id]').filter({ has: heading }))).height).toBeGreaterThanOrEqual(260);

        const { thrower } = await currentThrower(page, [players[0].name, players[1].name]);
        const abandoner = thrower === players[0].name ? players[0] : players[1];
        await abandonMatchByApi(request, token, match.id, abandoner.id);
        await page.reload();
        await expect(page.getByRole('button', { name: 'Wznów mecz' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Menu gry' })).toBeHidden();
      });
    }

    for (const layout of ['ring', 'grid'] as const) {
      test(`frequent hits keep the ${layout} keypad in place with and without hits`, async ({ page, context, request }) => {
        if (layout === 'grid') {
          await context.addInitScript(() => window.localStorage.setItem('autoscore.keypadLayout', 'grid'));
        }
        // Nowi gracze: jeden ma trafienia z treningu, drugi żadnych. Kto by nie zaczął, klawiatura pokazuje oba stany bloku.
        const withHits = await createPlayerByApi(request, token, uniqueName('Ola'));
        const withoutHits = await createPlayerByApi(request, token, uniqueName('Jan'));
        const practice = await createPracticeByApi(request, token, withHits.id, { practiceMode: 'solo_501' });
        await postThrowsByApi(request, token, practice.id, [T20, T20, T20]);
        expect(await frequentHitsByApi(request, token, withHits.id)).not.toHaveLength(0);
        expect(await frequentHitsByApi(request, token, withoutHits.id)).toHaveLength(0);

        const match = await createMatchByApi(request, token, [withHits.id, withoutHits.id]);
        const row = page.getByRole('group', { name: /^Najczęstsze/ });
        // W siatce rząd stoi przy każdej szerokości, a w kole tylko od lg.
        const rowShown = layout === 'grid' || viewport.width >= LG;
        const expectRow = async (thrower: string) => {
          if (thrower === withHits.name && rowShown) {
            await expect(row).toBeVisible();
          } else {
            await expect(row).toHaveCount(0);
          }
        };
        const hitsLoaded = () => page.waitForResponse((response) => response.url().includes('/frequent-hits'));

        const firstHits = hitsLoaded();
        await page.goto(`/#/matches/${match.id}`);
        await waitForKeypad(page);
        await firstHits;
        await fontsReady(page);
        const { thrower, other } = await currentThrower(page, [withHits.name, withoutHits.name]);
        await expectRow(thrower);
        const before = await keypadBox(page);
        await expectInViewport(before, page);
        // Od lg w kole rząd stoi nad Miss w kolumnie obok koła, więc bez stałego bloku zmieniłby wysokość Miss, a nie klawiatury.
        const missBefore = await boxOf(keypadKey(page, 'Miss'));

        const nextHits = hitsLoaded();
        await postThrowsByApi(request, token, match.id, [MISS, MISS, MISS]);
        await nextHits;
        await expect(throwerRow(page)).toContainText(other);
        await expectRow(other);
        expectSameBox(await keypadBox(page), before);
        expectSameBox(await boxOf(keypadKey(page, 'Miss')), missBefore);
      });
    }

    test('game menu opens over the keypad and Porzuć mecz can be clicked', async ({ page, request }) => {
      const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
      await page.goto(`/#/matches/${match.id}`);
      await waitForKeypad(page);
      const abandon = page.getByRole('button', { name: 'Porzuć mecz' });
      await expect(abandon).toBeHidden();

      await page.getByRole('button', { name: 'Menu gry' }).click();
      await abandon.click();
      const dialog = page.getByRole('dialog', { name: 'Porzucić mecz?' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Anuluj' }).click();
      await expect(dialog).toBeHidden();
    });

    test('game screen keeps the keypad in view and in place', async ({ page, request }) => {
      const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
      await page.goto(`/#/matches/${match.id}`);
      await waitForKeypad(page);
      await fontsReady(page);

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
