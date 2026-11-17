import { expect, test, type Locator, type Page, type WebSocketRoute } from '@playwright/test';
import type { Hit, Player } from '@autoscore/schema';
import {
  FINISHING_DARTS,
  MISS,
  abandonMatchByApi,
  createCasualByApi,
  createMatchByApi,
  createPlayerByApi,
  createPracticeByApi,
  frequentHitsByApi,
  loginByApi,
  postThrowsByApi,
} from './helpers/api';
import { currentThrower, keypadKey, scoreboard, throwerRow, waitForKeypad } from './helpers/game';
import { boxOf, expectInViewport, expectNoHorizontalScroll, expectNoOverlap, expectSameBox, keypadBox, type Box } from './helpers/layout';
import { uniqueName, useToken } from './helpers/session';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

// Poniżej lg (1024 px) historia tur otwiera się przyciskiem „Tury”, a od lg stoi stale w lewej kolumnie.
const LG = 1024;
const XL = 1280;

// Dolny odstęp strony pod dokiem: 12 px, od sm 28 px.
const BOTTOM_GAP = 28;

// Niższe niż okno porzucenia meczu, żeby jego panel musiał się przewijać.
const SHORT_HEIGHT = 400;

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

// sr-only zostawia elementowi pudełko 1×1, które Playwright uznaje za widoczne, więc liczy się też rozmiar.
async function expectReadable(element: Locator): Promise<void> {
  await expect(element).toBeVisible();
  const box = await boxOf(element);
  expect(box.width).toBeGreaterThan(2);
  expect(box.height).toBeGreaterThan(2);
}

// Nakładki ze statusem leżą nad treścią, więc nie mogą łapać kliknięć.
async function expectStatusOverlaysPassClicks(page: Page): Promise<void> {
  const overlays = await page
    .locator('[role="status"]')
    .evaluateAll((nodes) =>
      nodes.filter((node) => getComputedStyle(node).position === 'absolute').map((node) => getComputedStyle(node).pointerEvents),
    );
  expect(overlays.length).toBeGreaterThan(0);
  expect(overlays.filter((value) => value !== 'none')).toEqual([]);
}

// Pierścienie w rogu panelu okna wystają poza niego. Panel je przycina, więc nie da się go przewinąć w bok.
async function expectClippedSideways(panel: Locator): Promise<void> {
  expect(['hidden', 'clip']).toContain(await panel.evaluate((node) => getComputedStyle(node).overflowX));
}

// Czy element leży w widocznej części najbliższego przodka z overflow auto albo scroll w danej osi.
async function insideScrollContainer(element: Locator, axis: 'x' | 'y'): Promise<boolean> {
  return element.evaluate((node, along) => {
    const overflow = (candidate: Element) =>
      along === 'x' ? getComputedStyle(candidate).overflowX : getComputedStyle(candidate).overflowY;
    let scroller = node.parentElement;
    while (scroller && !['auto', 'scroll'].includes(overflow(scroller))) {
      scroller = scroller.parentElement;
    }
    if (!scroller) {
      return false;
    }
    const rect = node.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    return along === 'x'
      ? rect.left >= box.left - 1 && rect.right <= box.right + 1
      : rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
  }, axis);
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
      await expectReadable(page.getByRole('heading', { level: 1, name: 'Nowa gra' }));
      await expect(page.getByRole('button', { name: 'Start gry' })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    // Tylko otwiera kreator. Utworzony turniej przekierowałby #/tournaments w innych testach tej samej bazy.
    test('tournament wizard keeps Rozpocznij turniej in view without horizontal scroll', async ({ page }) => {
      await page.goto('/#/tournaments/new');
      await expect(page.getByRole('button', { name: 'Turniej', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: players[0].name, exact: true })).toBeVisible();
      await fontsReady(page);
      await expectBoxInViewport(page, page.getByRole('button', { name: 'Rozpocznij turniej' }));
      await expect(page.getByRole('button', { name: 'Start gry' })).toHaveCount(0);
      await expectNoHorizontalScroll(page);
    });

    test('tournaments screen shows Nowy turniej without horizontal scroll', async ({ page }) => {
      await page.goto('/#/tournaments');
      await expect(page.getByRole('heading', { level: 1, name: 'Turnieje' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Nowy turniej' })).toBeVisible();
      await expect(page.getByText('Ładowanie…')).toBeHidden();
      await expectNoHorizontalScroll(page);
    });

    test('main navigation keeps its five links in one row, each at least 44 px tall', async ({ page }) => {
      await page.goto('/#/');
      const links = page.getByRole('navigation', { name: 'Główna nawigacja' }).getByRole('link');
      await expect(links).toHaveText(['Nowa gra', 'Turniej', 'Statystyki', 'Historia', 'Ustawienia']);
      await fontsReady(page);
      const boxes = await Promise.all((await links.all()).map((link) => boxOf(link)));
      const top = boxes[0]?.y ?? 0;
      for (const box of boxes) {
        expect(Math.abs(box.y - top)).toBeLessThanOrEqual(1);
        expect(box.height).toBeGreaterThanOrEqual(44);
        await expectInViewport(box, page);
      }
      await expectNoHorizontalScroll(page);
    });

    test('new player dialog keeps its 44 px color swatches inside the dialog', async ({ page }) => {
      await page.goto('/#/');
      await page.getByRole('button', { name: '+ Nowy gracz' }).click();
      const dialog = page.getByRole('dialog', { name: 'Nowy gracz' });
      await expect(dialog).toBeVisible();
      const panel = dialog.locator(':scope > div');
      const panelBox = await boxOf(panel);
      const swatches = dialog.getByRole('group', { name: 'Kolor' }).getByRole('radio');
      await expect(swatches).toHaveCount(16);
      for (const swatch of await swatches.all()) {
        const box = await boxOf(swatch);
        expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(panelBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
      }
      await expectClippedSideways(panel);
      await expectNoHorizontalScroll(page);
      await dialog.getByRole('button', { name: 'Anuluj' }).click();
      await expect(dialog).toBeHidden();
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
      await expectReadable(page.getByText('Kamera: brak'));
      await expectReadable(page.getByText(/^Głos: /));
      for (const name of ['Koło', 'Siatka']) {
        const card = page.locator('label').filter({ has: page.getByRole('radio', { name }) });
        expect((await boxOf(card)).height).toBeGreaterThanOrEqual(44);
      }
      await expectNoHorizontalScroll(page);
    });

    test('end-of-match view has no horizontal scroll and keeps its buttons in view', async ({ page }) => {
      await page.goto(`/#/matches/${finishedId}`);
      await expect(page.getByRole('button', { name: 'Rewanż', exact: true })).toBeVisible();
      await fontsReady(page);
      await expectNoHorizontalScroll(page);
      for (const control of [
        page.getByRole('button', { name: 'Rewanż', exact: true }),
        page.getByRole('link', { name: 'Nowy mecz', exact: true }),
      ]) {
        await expectBoxInViewport(page, control);
        // Próbne kliknięcie sprawdza, że nakładka ze statusem nie przykrywa przycisku, i niczego nie zmienia.
        await control.click({ trial: true });
      }
      await expectStatusOverlaysPassClicks(page);
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
        // Próbne kliknięcie sprawdza, że nic nie przykrywa przycisku, i nie zapisuje próby.
        await result.click({ trial: true });
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
      // Wiersze paska wyników mają stałą wysokość, także z linią zbitych punktów i ostatniej tury.
      const board = await boxOf(scoreboard(page));

      await postThrowsByApi(request, token, match.id, BEFORE_BUST);
      const card = page.getByRole('button', { name: /^Zamknięcie/ });
      await expect(card).toBeVisible();
      expectSameBox(await keypadBox(page), before);
      expect(Math.abs((await boxOf(scoreboard(page))).height - board.height)).toBeLessThanOrEqual(1);
      // Etykieta z liczbą rzutek mieści się na karcie dopiero od xl, a poniżej stoi krótka.
      const [shown, hidden] =
        viewport.width >= XL
          ? [card.getByText(/^Zamknięcie w /), card.getByText('Zamknięcie', { exact: true })]
          : [card.getByText('Zamknięcie', { exact: true }), card.getByText(/^Zamknięcie w /)];
      await expectReadable(shown);
      await expect(hidden).toBeHidden();

      await postThrowsByApi(request, token, match.id, [T20]);
      const banner = page.getByRole('status').locator('p').filter({ hasText: 'Bust' });
      await expect(banner).toBeVisible();
      const bannerBox = await boxOf(banner);
      const keypad = await keypadBox(page);
      expectNoOverlap(bannerBox, keypad);
      expect(bannerBox.y + bannerBox.height).toBeLessThanOrEqual(keypad.y + 1);
      expectSameBox(keypad, before);
      expect(Math.abs((await boxOf(scoreboard(page))).height - board.height)).toBeLessThanOrEqual(1);
      await expectStatusOverlaysPassClicks(page);
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
      expect(await insideScrollContainer(current, 'x')).toBe(true);
      await expectNoHorizontalScroll(page);
    });

    test('Free run history starts at the current approach without horizontal scroll', async ({ page, request }) => {
      const session = await createPracticeByApi(request, token, players[0].id, { practiceMode: 'free_run' });
      await page.goto(`/#/matches/${session.id}`);
      await waitForKeypad(page);
      await postThrowsByApi(request, token, session.id, TEN_MISSED_TURNS);
      // Panel poniżej lg jest jeszcze ukryty, a role pomijają ukryte elementy, więc wiersz szukamy po atrybucie.
      const current = page.locator('tr[aria-current="true"]');
      await expect(current.locator('th')).toHaveText('11');
      if (viewport.width < LG) {
        await page.getByRole('button', { name: 'Tury' }).click();
      }
      await expect(page.getByRole('table', { name: 'Przebieg sesji' })).toBeVisible();
      expect(await insideScrollContainer(current, 'y')).toBe(true);
      await expectNoHorizontalScroll(page);
    });

    if (viewport.width < LG) {
      test('Tury swaps the scoreboard for the turn history without moving the keypad', async ({ page, request }) => {
        const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
        await page.goto(`/#/matches/${match.id}`);
        await waitForKeypad(page);
        await fontsReady(page);
        // Po dziesięciu turach znów rzuca zaczynający, więc BEFORE_BUST zostawia mu w trakcie tury 61 z trasą zamknięcia.
        await postThrowsByApi(request, token, match.id, [...TEN_MISSED_TURNS, ...BEFORE_BUST]);
        // Panel jest jeszcze ukryty, a role pomijają ukryte elementy, więc wiersz szukamy po atrybucie.
        const current = page.locator('tr[aria-current="true"]');
        await expect(current.locator('th')).toHaveText('7');
        // Otwarty panel zajmuje miejsce paska wyników, panelu tury, karty zamknięcia i statystyk meczu.
        const swapped = [
          scoreboard(page),
          page.getByText('w tej turze'),
          page.getByRole('button', { name: /^Zamknięcie/ }),
          page.getByRole('table', { name: 'Statystyki meczu' }),
        ];
        for (const part of swapped) {
          await expect(part).toBeVisible();
        }
        const before = await keypadBox(page);

        await page.getByRole('button', { name: 'Tury' }).click();
        await expect(page.getByRole('heading', { name: 'Historia tur · Leg 1' })).toBeVisible();
        for (const part of swapped) {
          await expect(part).toBeHidden();
        }
        await expect(current).toBeInViewport();
        const open = await keypadBox(page);
        expectSameBox(open, before);
        await expectInViewport(open, page);

        await page.getByRole('button', { name: 'Zamknij historię tur' }).click();
        for (const part of swapped) {
          await expect(part).toBeVisible();
        }
        expectSameBox(await keypadBox(page), before);
      });
    } else {
      test('turn history stays in view from lg and the menu toggle hides without menu actions', async ({ page, request }) => {
        const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
        await page.goto(`/#/matches/${match.id}`);
        await waitForKeypad(page);
        await postThrowsByApi(request, token, match.id, TEN_MISSED_TURNS);
        const current = page.locator('tr[aria-current="true"]');
        await expect(current.locator('th')).toHaveText('6');
        await expect(page.getByRole('heading', { name: 'Historia tur · Leg 1' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Tury' })).toBeHidden();
        await expect(page.getByRole('button', { name: 'Zamknij historię tur' })).toBeHidden();
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
        expect(
          await page.evaluate(() =>
            document.scrollingElement ? document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight : 0,
          ),
        ).toBeLessThanOrEqual(1);
        // Tabela historii przewija się od dołu, więc bieżąca tura leży w jej widocznej części.
        expect(await insideScrollContainer(current, 'y')).toBe(true);
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
            for (const key of await row.getByRole('button').all()) {
              const box = await boxOf(key);
              expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
            }
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

      // W niskim oknie przeglądarki panel okna mieści się w nim i przewija się sam. Pierścienie w rogu go nie poszerzają i nie łapią kliknięć.
      await page.setViewportSize({ width: viewport.width, height: SHORT_HEIGHT });
      const panel = dialog.locator(':scope > div');
      await expectInViewport(await boxOf(panel), page);
      await expectClippedSideways(panel);
      const sizes = await panel.evaluate((node) => ({
        overflowY: node.scrollHeight - node.clientHeight,
        rings: [...node.querySelectorAll('svg[aria-hidden="true"]')]
          .filter((svg) => svg.querySelectorAll('circle').length === 3)
          .map((svg) => getComputedStyle(svg).pointerEvents),
      }));
      expect(sizes.overflowY).toBeGreaterThan(0);
      expect(sizes.rings).toEqual(['none']);
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
      expect((await boxOf(keypadKey(page, 'Cofnij'))).height).toBeGreaterThanOrEqual(44);
      // Pełne słowo mnożnika pokazuje się dopiero od lg, a poniżej sama litera.
      const word = keypadKey(page, 'S').getByText('Single');
      if (viewport.width >= LG) {
        await expectReadable(word);
      } else {
        await expect(word).toBeHidden();
        // Dok trzyma klawiaturę przy dolnej krawędzi okna, nad samym dolnym odstępem strony, także po przewinięciu treści do końca.
        expect(viewport.height - (before.y + before.height)).toBeLessThanOrEqual(BOTTOM_GAP + 1);
        await page.getByRole('main').evaluate((main) => main.scrollTo(0, main.scrollHeight));
        expectSameBox(await keypadBox(page), before);
      }

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

const CARD_VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 810 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1250 },
] as const;

// Od lg karta zamknięcia stoi 18 px pod klawiaturą, a main ma 12 px dolnego odstępu.
const CARD_GAP = 18;
const MAIN_BOTTOM_GAP = 12;

// Przy 1440×810 koło zabiera całą wysokość, więc karta ma minimum.
const NO_FREE_SPACE_WIDTH = 1440;

const T19: Hit = { segment: 19, multiplier: 3 };
const S14: Hit = { segment: 14, multiplier: 1 };

// Z 301 zaczynający zostaje na 170 („T20 T20 Bull”), a drugi gracz pudłuje całą turę.
const TO_170: readonly Hit[] = [T20, T19, S14, MISS, MISS, MISS];

function checkoutCard(page: Page): Locator {
  return page.getByRole('button', { name: /^Zamknięcie/ });
}

// Niewidoczna karta ma visibility: hidden, więc Playwright nie podaje jej pudełka.
async function placeholderBox(page: Page): Promise<Box> {
  const placeholder = page.getByRole('main').locator('div.invisible[aria-hidden="true"]');
  await expect(placeholder).toHaveCount(1);
  return placeholder.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

async function expectNoVerticalScroll(page: Page): Promise<void> {
  const measured = await page.evaluate(() => {
    const scrolling = document.scrollingElement;
    const main = document.querySelector('main');
    return [
      ...(scrolling ? [{ name: 'document.scrollingElement', overflow: scrolling.scrollHeight - scrolling.clientHeight }] : []),
      ...(main ? [{ name: 'main', overflow: main.scrollHeight - main.clientHeight }] : []),
    ];
  });
  for (const { name, overflow } of measured) {
    expect(overflow, name).toBeLessThanOrEqual(1);
  }
}

function expectNear(actual: number, expected: number, what: string): void {
  expect(Math.abs(actual - expected), `${what}: ${actual}, expected ${expected}`).toBeLessThanOrEqual(1);
}

function expectInside(inner: Box, outer: Box): void {
  const where = `box ${JSON.stringify(inner)} inside ${JSON.stringify(outer)}`;
  expect(inner.x, where).toBeGreaterThanOrEqual(outer.x - 0.5);
  expect(inner.y, where).toBeGreaterThanOrEqual(outer.y - 0.5);
  expect(inner.x + inner.width, where).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
  expect(inner.y + inner.height, where).toBeLessThanOrEqual(outer.y + outer.height + 0.5);
}

async function expectCardFills(page: Page, card: Box, keypad: Box): Promise<void> {
  const main = await boxOf(page.getByRole('main'));
  expectNear(card.y, keypad.y + keypad.height + CARD_GAP, 'card top');
  expectNear(card.y + card.height, main.y + main.height - MAIN_BOTTOM_GAP, 'card bottom');
  expectNear(card.x, keypad.x, 'card x');
  expectNear(card.width, keypad.width, 'card width');
  expectNoOverlap(card, keypad);
}

async function waitForRoute(page: Page, route: string): Promise<void> {
  await expect(checkoutCard(page)).toHaveAttribute('aria-label', new RegExp(`^Zamknięcie w \\d rzut\\S+: ${route}\\. `));
}

// Etykieta karty z liczbą rzutek stoi od xl, a poniżej krótka.
function visibleLabel(card: Locator, width: number): Locator {
  return width >= XL ? card.getByText(/^Zamknięcie w /) : card.getByText('Zamknięcie', { exact: true });
}

async function expectRouteOnOneLine(page: Page, width: number): Promise<void> {
  const card = checkoutCard(page);
  const cardBox = await boxOf(card);
  const twenties = card.getByText('T20', { exact: true });
  const first = await boxOf(twenties.first());
  const chips = [first, await boxOf(twenties.nth(1)), await boxOf(card.getByText('Bull', { exact: true }))];
  const label = await boxOf(visibleLabel(card, width));
  const badge = await boxOf(card.getByText('Enter', { exact: true }));
  expectNoOverlap(label, first);
  for (const chip of chips) {
    expectNear(chip.y, first.y, 'chip top');
    expectInside(chip, cardBox);
    expectNoOverlap(chip, badge);
  }
}

test.describe('checkout card fills the free height from lg', () => {
  for (const viewport of CARD_VIEWPORTS) {
    test.describe(`${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport });

      test('ring keypad in 1v1 keeps its box while the card fills the space under it', async ({ page, request }) => {
        const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
        await page.goto(`/#/matches/${match.id}`);
        await waitForKeypad(page);
        await fontsReady(page);
        const keypad = await keypadBox(page);
        const placeholder = await placeholderBox(page);
        await expectCardFills(page, placeholder, keypad);
        await expectNoVerticalScroll(page);
        await expectNoHorizontalScroll(page);

        await postThrowsByApi(request, token, match.id, TO_170);
        await waitForRoute(page, 'T20, T20, Bull');
        const card = await boxOf(checkoutCard(page));
        expectSameBox(await keypadBox(page), keypad);
        expectSameBox(card, placeholder);
        await expectCardFills(page, card, keypad);
        await expectRouteOnOneLine(page, viewport.width);
        await expectNoVerticalScroll(page);
        await expectNoHorizontalScroll(page);
        if (viewport.width === NO_FREE_SPACE_WIDTH) {
          expectNear(card.height, 80, 'card height');
          await expect(checkoutCard(page).getByText('Bull', { exact: true })).toHaveCSS('font-size', '52px');
          const label = visibleLabel(checkoutCard(page), viewport.width);
          await expect(label).toHaveCSS('font-size', '19px');
          await expect(label).toHaveCSS('font-weight', '700');
        } else if (viewport.width <= XL) {
          expect(card.height).toBeGreaterThan(100);
        }

        await postThrowsByApi(request, token, match.id, [T20, T20]);
        await waitForRoute(page, 'Bull');
        const oneDart = await boxOf(checkoutCard(page));
        expectSameBox(await keypadBox(page), keypad);
        expectSameBox(oneDart, placeholder);
        await expectCardFills(page, oneDart, keypad);
        await expectNoVerticalScroll(page);
        await expectNoHorizontalScroll(page);
      });
    });
  }

  test.describe('1920×1080 grid keypad and Solo 501', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('grid keypad keeps its box while the card fills the space under it', async ({ page, context, request }) => {
      await context.addInitScript(() => window.localStorage.setItem('autoscore.keypadLayout', 'grid'));
      const match = await createMatchByApi(request, token, [players[0].id, players[1].id]);
      await page.goto(`/#/matches/${match.id}`);
      await waitForKeypad(page);
      await fontsReady(page);
      // Klawisze koła mają pozycję w stylu inline, a siatka nie.
      await expect(keypadKey(page, '20')).not.toHaveAttribute('style', /left/);
      const keypad = await keypadBox(page);
      await expectCardFills(page, await placeholderBox(page), keypad);

      await postThrowsByApi(request, token, match.id, TO_170);
      await waitForRoute(page, 'T20, T20, Bull');
      expectSameBox(await keypadBox(page), keypad);
      await expectCardFills(page, await boxOf(checkoutCard(page)), keypad);
      await expectRouteOnOneLine(page, 1920);
    });

    test('Solo 501 keeps the keypad box while the card fills the space under it', async ({ page, request }) => {
      const solo = await createPracticeByApi(request, token, players[0].id, { practiceMode: 'solo_501' });
      await page.goto(`/#/matches/${solo.id}`);
      await waitForKeypad(page);
      await fontsReady(page);
      const keypad = await keypadBox(page);
      await expectCardFills(page, await placeholderBox(page), keypad);

      // Sześć razy T20 zostawia 141 z trasą na trzy rzutki.
      await postThrowsByApi(
        request,
        token,
        solo.id,
        Array.from({ length: 6 }, () => T20),
      );
      await expect(checkoutCard(page)).toHaveAttribute('aria-label', /^Zamknięcie w 3 rzutkach: /);
      expectSameBox(await keypadBox(page), keypad);
      await expectCardFills(page, await boxOf(checkoutCard(page)), keypad);
      await expectNoVerticalScroll(page);
    });
  });

  test.describe('2560×1250 casual', () => {
    test.use({ viewport: { width: 2560, height: 1250 } });

    test('casual with 4 players keeps the keypad box while the card fills the space under it', async ({ page, request }) => {
      const extra = [
        await createPlayerByApi(request, token, uniqueName('Ala')),
        await createPlayerByApi(request, token, uniqueName('Olek')),
      ];
      const casual = await createCasualByApi(request, token, [players[0].id, players[1].id, ...extra.map((player) => player.id)]);
      await page.goto(`/#/matches/${casual.id}`);
      await waitForKeypad(page);
      await fontsReady(page);
      const keypad = await keypadBox(page);
      await expectCardFills(page, await placeholderBox(page), keypad);

      // Zaczynający zostaje na 170, a trzej pozostali pudłują swoje tury.
      await postThrowsByApi(request, token, casual.id, [T20, T19, S14, ...Array.from({ length: 9 }, () => MISS)]);
      await waitForRoute(page, 'T20, T20, Bull');
      expectSameBox(await keypadBox(page), keypad);
      await expectCardFills(page, await boxOf(checkoutCard(page)), keypad);
      await expectRouteOnOneLine(page, 2560);
      await expectNoVerticalScroll(page);
    });
  });
});
