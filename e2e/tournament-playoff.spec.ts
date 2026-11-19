import { expect, test, type Page } from '@playwright/test';
import type { Fixture, Player, TournamentView } from '@autoscore/schema';
import {
  archiveTournamentByApi,
  createPlayerByApi,
  createTournamentByApi,
  finishAndArchiveTournamentByApi,
  getMatchByApi,
  getPublicTournamentByApi,
  getTournamentByApi,
  loginByApi,
  startFixtureByApi,
  winMatchByApi,
} from './helpers/api';
import { boxOf, expectInViewport, expectNoHorizontalScroll, expectNoVerticalScroll } from './helpers/layout';
import { uniqueName, useToken } from './helpers/session';

test.describe.configure({ mode: 'serial' });

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

const DEPENDENT_STARTED = 'Zaczął się już mecz zależny od tego wyniku, więc wyniku nie da się poprawić.';
const NOT_SHARED = 'Ten turniej nie istnieje albo nie jest udostępniony.';

let token = '';
// Kolejność to ranking: w każdym meczu grupy wygrywa gracz stojący wyżej.
let players: readonly [Player, Player, Player, Player];
let tournamentName = '';
let tournamentId = '';
let finalMatchId = '';

test.beforeAll(async ({ request }) => {
  token = await loginByApi(request);
  players = await Promise.all([
    createPlayerByApi(request, token, uniqueName('Ala')),
    createPlayerByApi(request, token, uniqueName('Ola')),
    createPlayerByApi(request, token, uniqueName('Ela')),
    createPlayerByApi(request, token, uniqueName('Iga')),
  ]);
  tournamentName = uniqueName('Play-off e2e');
  const view = await createTournamentByApi(
    request,
    token,
    tournamentName,
    players.map((player) => player.id),
    {
      format: 'group_playoff',
      startingScore: 301,
      advance: 4,
      thirdPlaceMatch: true,
      consolation: false,
      legsToWin: { group: 1, r16: 1, qf: 1, sf: 1, final: 1, thirdPlace: 1, consolation: 1 },
      sharing: true,
    },
  );
  tournamentId = view.id;
  expect(view.fixtures).toHaveLength(10);
  expect(view.fixtures.filter((fixture) => fixture.phase === 'group')).toHaveLength(6);
  expect(view.fixtures.filter((fixture) => fixture.bracketRound === 'sf')).toHaveLength(2);
  expect(view.fixtures.filter((fixture) => fixture.phase === 'third_place')).toHaveLength(1);
  expect(view.fixtures.filter((fixture) => fixture.bracketRound === 'final')).toHaveLength(1);
});

test.afterAll(async ({ request }) => {
  if (tournamentId !== '') {
    await finishAndArchiveTournamentByApi(request, token, tournamentId);
  }
});

test.beforeEach(async ({ context, page }) => {
  await useToken(context, token);
  await page.setViewportSize({ width: 1280, height: 800 });
});

function player(index: 0 | 1 | 2 | 3): Player {
  return players[index];
}

function rank(playerId: string): number {
  return players.findIndex((entry) => entry.id === playerId);
}

function slotPlayerIds(fixture: Fixture): (string | null)[] {
  return fixture.slots.map((slot) => (slot.kind === 'player' ? slot.playerId : null));
}

function fixtureByNumber(view: TournamentView, fixtureNumber: number): Fixture {
  const fixture = view.fixtures.find((entry) => entry.number === fixtureNumber);
  if (!fixture) {
    throw new Error(`No fixture #${fixtureNumber}`);
  }
  return fixture;
}

function fixtureOf(view: TournamentView, predicate: (fixture: Fixture) => boolean): Fixture {
  const fixture = view.fixtures.find(predicate);
  if (!fixture) {
    throw new Error(`No fixture matches ${predicate.toString()}`);
  }
  return fixture;
}

function groupFixtureOf(view: TournamentView, first: Player, second: Player): Fixture {
  return fixtureOf(view, (fixture) => {
    const ids = slotPlayerIds(fixture);
    return fixture.phase === 'group' && ids.includes(first.id) && ids.includes(second.id);
  });
}

function pointsOf(view: TournamentView): Record<string, number> {
  return Object.fromEntries(view.standings.map((row) => [row.playerId, row.points]));
}

function tournamentUrl(): string {
  return `/#/tournaments/${encodeURIComponent(tournamentId)}`;
}

function groupTable(page: Page) {
  return page.getByRole('table', { name: 'Faza grupowa' });
}

async function expectTableOrder(page: Page, order: readonly Player[]): Promise<void> {
  const rows = groupTable(page).locator('tbody tr');
  await expect(rows).toHaveCount(order.length);
  for (const [index, entry] of order.entries()) {
    await expect(rows.nth(index).getByRole('rowheader')).toContainText(entry.name);
  }
}

test('plays the group through the API', async ({ request }) => {
  const view = await getTournamentByApi(request, token, tournamentId);
  const group = view.fixtures.filter((fixture) => fixture.phase === 'group').sort((first, second) => first.number - second.number);
  for (const fixture of group) {
    const { matchId } = await startFixtureByApi(request, token, tournamentId, fixture.id);
    const [winner] = slotPlayerIds(fixture).sort((first, second) => rank(first ?? '') - rank(second ?? ''));
    await winMatchByApi(request, token, matchId, winner ?? '');
  }
  const after = await getTournamentByApi(request, token, tournamentId);
  expect(pointsOf(after)).toEqual({ [player(0).id]: 6, [player(1).id]: 4, [player(2).id]: 2, [player(3).id]: 0 });
});

test('corrects a group result and reseeds the semi-finals', async ({ page, request }) => {
  const [a, b, c, d] = players;
  const fixture = groupFixtureOf(await getTournamentByApi(request, token, tournamentId), b, c);

  await page.goto(tournamentUrl());
  await page.getByRole('tab', { name: 'Grupa' }).click();
  await page.getByRole('button', { name: 'Popraw wynik' }).click();
  const dialog = page.getByRole('dialog', { name: 'Popraw wynik' });
  await dialog.getByLabel('Mecz').selectOption({ value: fixture.id });
  await dialog.getByRole('button', { name: `Więcej legów: ${c.name}` }).click();
  await dialog.getByRole('button', { name: `Mniej legów: ${b.name}` }).click();
  await dialog.getByRole('button', { name: 'Popraw wynik' }).click();
  await expect(dialog).toBeHidden();

  const rows = groupTable(page).locator('tbody tr');
  for (const entry of [b, c]) {
    await expect(rows.filter({ hasText: entry.name }).getByText('popr.', { exact: true })).toHaveCount(1);
  }
  await expectTableOrder(page, [a, c, b, d]);

  const view = await getTournamentByApi(request, token, tournamentId);
  const corrected = fixtureOf(view, (entry) => entry.id === fixture.id);
  expect(corrected.result?.corrected).toBe(true);
  expect(corrected.result?.winnerId).toBe(c.id);
  expect(slotPlayerIds(fixtureByNumber(view, 7))).toEqual([a.id, d.id]);
  expect(slotPlayerIds(fixtureByNumber(view, 8))).toEqual([c.id, b.id]);
});

test('refuses a group correction once a semi-final has started', async ({ page, request }) => {
  const [a, b] = players;
  await page.goto(tournamentUrl());
  await page.getByRole('button', { name: 'Zagraj mecz', exact: true }).click();
  await expect(page).toHaveURL(/#\/matches\/[^/]+$/);
  await page.goto(tournamentUrl());

  const before = await getTournamentByApi(request, token, tournamentId);
  expect(fixtureByNumber(before, 7).status).toBe('in_progress');
  const fixture = groupFixtureOf(before, a, b);

  await page.getByRole('button', { name: 'Popraw wynik' }).click();
  const dialog = page.getByRole('dialog', { name: 'Popraw wynik' });
  await dialog.getByLabel('Mecz').selectOption({ value: fixture.id });
  await dialog.getByRole('button', { name: `Więcej legów: ${b.name}` }).click();
  await dialog.getByRole('button', { name: `Mniej legów: ${a.name}` }).click();
  await dialog.getByRole('button', { name: 'Popraw wynik' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(DEPENDENT_STARTED);

  const after = await getTournamentByApi(request, token, tournamentId);
  expect(after.eventSeq).toBe(before.eventSeq);
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(dialog).toBeHidden();
});

test('withdraws a player during a running semi-final', async ({ page, request }) => {
  const [a, , , d] = players;
  await page.goto(tournamentUrl());
  await page.getByRole('button', { name: 'Wycofaj gracza' }).click();
  const dialog = page.getByRole('dialog', { name: 'Wycofać gracza?' });
  // Radio jest ukryte w karcie z imieniem, więc wybór idzie przez kliknięcie karty.
  await dialog.getByText(d.name, { exact: true }).click();
  await expect(dialog.getByRole('radio', { name: d.name })).toBeChecked();
  await expect(dialog.getByText('zostanie porzucony i liczy się jako walkower')).toBeVisible();
  await dialog.getByRole('button', { name: 'Wycofaj gracza' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('tab', { name: 'Play-off' }).click();
  await expect(page.getByText('Mecz #7 · walkower', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Grupa' }).click();
  await expect(groupTable(page).locator('tbody tr').filter({ hasText: d.name })).toContainText('wycofany');

  const semi = fixtureByNumber(await getTournamentByApi(request, token, tournamentId), 7);
  expect(semi.status).toBe('walkover');
  expect(semi.result?.winnerId).toBe(a.id);
});

test('plays the second semi-final and starts the final', async ({ page, request }) => {
  const [a, b, c] = players;
  await page.goto(tournamentUrl());
  await page.getByRole('button', { name: 'Zagraj mecz', exact: true }).click();
  await expect(page).toHaveURL(/#\/matches\/[^/]+$/);
  const matchId = decodeURIComponent(new URL(page.url()).hash.replace('#/matches/', ''));
  await winMatchByApi(request, token, matchId, c.id);
  await page.getByRole('link', { name: 'Wróć do turnieju' }).click();
  await expect(page).toHaveURL(/#\/tournaments\/[^/]+$/);

  const view = await getTournamentByApi(request, token, tournamentId);
  expect(fixtureByNumber(view, 8).result?.winnerId).toBe(c.id);
  const third = fixtureOf(view, (fixture) => fixture.id === 'p-3rd');
  expect(third.status).toBe('walkover');
  expect(third.result?.winnerId).toBe(b.id);

  const final = fixtureOf(view, (fixture) => fixture.bracketRound === 'final');
  expect(slotPlayerIds(final)).toEqual([a.id, c.id]);
  ({ matchId: finalMatchId } = await startFixtureByApi(request, token, tournamentId, final.id));
  expect((await getMatchByApi(request, token, finalMatchId)).finished).toBe(false);
});

function tvUrl(): string {
  return `/#/tournaments/${encodeURIComponent(tournamentId)}/tv`;
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const) {
  test(`TV view fits the running final and the play-off list at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(tvUrl());
    const live = page.getByRole('region', { name: 'Trwający mecz' });
    await expect(live.getByText('Rzuca', { exact: true })).toBeVisible();
    await expectInViewport(await boxOf(live), page);
    await expectNoHorizontalScroll(page);
    await expectNoVerticalScroll(page);

    const semi = page.getByRole('region', { name: 'Play-off', exact: true }).getByRole('listitem').filter({ hasText: 'Półfinał 1' });
    await expect(semi.getByText('wo', { exact: true })).toBeVisible();
    await expect(page.getByText('Śledź turniej na telefonie')).toHaveCount(0);
  });
}

test('TV view has no horizontal scroll at 390×844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(tvUrl());
  await expect(page.getByRole('region', { name: 'Trwający mecz' }).getByText('Rzuca', { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('finishes the final with the final classification', async ({ page, request }) => {
  const [a, b, c, d] = players;
  await winMatchByApi(request, token, finalMatchId, a.id);

  await page.goto(tournamentUrl());
  await page.getByRole('tab', { name: 'Play-off' }).click();
  const placements = page.getByRole('region', { name: 'Klasyfikacja końcowa' }).getByRole('listitem');
  await expect(placements).toHaveCount(4);
  for (const [index, entry] of [a, c, b, d].entries()) {
    await expect(placements.nth(index)).toContainText(`${index + 1}.`);
    await expect(placements.nth(index)).toContainText(entry.name);
  }

  const view = await getTournamentByApi(request, token, tournamentId);
  expect(view.status).toBe('finished');
  expect([...view.placements].sort((first, second) => first.place - second.place)).toEqual([
    { playerId: a.id, place: 1 },
    { playerId: c.id, place: 2 },
    { playerId: b.id, place: 3 },
    { playerId: d.id, place: 4 },
  ]);
});

for (const viewport of VIEWPORTS) {
  test(`bracket and group table have no horizontal scroll at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(tournamentUrl());
    await page.getByRole('tab', { name: 'Play-off' }).click();
    await expect(page.getByRole('region', { name: 'Drabinka' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole('tab', { name: 'Grupa' }).click();
    // Poniżej sm tabela krzyżowa zamienia się na krótką, z tą samą nazwą.
    await expect(groupTable(page)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
}

test('public link works without login until sharing is turned off', async ({ browser, page, request }, testInfo) => {
  const [a] = players;
  const { baseURL } = testInfo.project.use;
  const visitor = await browser.newContext(baseURL === undefined ? {} : { baseURL });
  try {
    const publicPage = await visitor.newPage();
    await publicPage.goto(`/#/t/${encodeURIComponent(tournamentId)}`);
    await expect(publicPage.getByRole('heading', { level: 1, name: tournamentName })).toBeVisible();
    await expect(publicPage.getByText('Zakończony ·')).toBeVisible();
    await expect(publicPage.getByRole('region', { name: 'Podium', exact: true }).getByRole('listitem').first()).toContainText(a.name);
    await expect(publicPage.locator('nav')).toHaveCount(0);
    await expect(publicPage.getByRole('button', { name: 'Zaloguj' })).toHaveCount(0);
    expect(await publicPage.evaluate(() => window.localStorage.getItem('autoscore.token'))).toBeNull();

    const matches = publicPage.getByRole('region', { name: /^Mecze/ });
    await matches.locator(`a[href="#/t/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(finalMatchId)}"]`).click();
    await expect(publicPage.getByText('Statystyki meczu')).toBeVisible();

    await page.goto(tournamentUrl());
    await page.getByRole('button', { name: 'Udostępnij' }).click();
    const dialog = page.getByRole('dialog', { name: 'Udostępnij turniej' });
    await expect(dialog.getByText('Udostępnianie wymaga otwarcia aplikacji po adresie w sieci')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Kopiuj link' })).toHaveCount(0);
    await expect(dialog.getByRole('img', { name: 'Kod QR publicznego linku' })).toHaveCount(0);
    const toggle = dialog.getByRole('button', { name: 'Publiczny link z kodem QR' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await publicPage.goto(`/#/t/${encodeURIComponent(tournamentId)}`);
    await publicPage.reload();
    await expect(publicPage.getByText(NOT_SHARED)).toBeVisible();

    const hidden = await getPublicTournamentByApi(request, tournamentId);
    const unknown = await getPublicTournamentByApi(request, 't_unknown');
    expect(hidden.status()).toBe(404);
    expect(unknown.status()).toBe(404);
    expect(await hidden.json()).toEqual(await unknown.json());
  } finally {
    await visitor.close();
  }

  await archiveTournamentByApi(request, token, tournamentId);
});
