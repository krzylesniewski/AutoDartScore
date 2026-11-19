import { expect, test, type Page } from '@playwright/test';
import type { Player } from '@autoscore/schema';
import {
  createPlayerByApi,
  finishAndArchiveTournamentByApi,
  getMatchByApi,
  getTournamentByApi,
  loginByApi,
  winMatchByApi,
} from './helpers/api';
import { uniqueName, useToken } from './helpers/session';

test.describe.configure({ mode: 'serial' });

let token = '';
// Kolejność to ranking: w każdym meczu wygrywa gracz stojący wyżej.
let players: readonly [Player, Player, Player];
let tournamentName = '';
let tournamentId = '';

test.beforeAll(async ({ request }) => {
  token = await loginByApi(request);
  players = await Promise.all([
    createPlayerByApi(request, token, uniqueName('Ala')),
    createPlayerByApi(request, token, uniqueName('Ola')),
    createPlayerByApi(request, token, uniqueName('Ela')),
  ]);
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

function rank(playerId: string): number {
  return players.findIndex((player) => player.id === playerId);
}

function tournamentUrl(): string {
  return `/#/tournaments/${encodeURIComponent(tournamentId)}`;
}

// Stan w nagłówku. Po końcu turnieju „Turniej zakończony” stoi też na karcie następnego meczu.
function progress(page: Page, text: string) {
  return page.getByRole('main').locator('header').getByText(text, { exact: true });
}

test('creates a league of three in the wizard', async ({ page }) => {
  await page.goto('/#/tournaments/new');
  tournamentName = uniqueName('Liga e2e');
  await page.getByLabel('Nazwa turnieju').fill(tournamentName);

  const league = page.getByRole('button', { name: 'Liga', exact: true });
  await league.click();
  await expect(league).toHaveAttribute('aria-pressed', 'true');
  for (const player of players) {
    const tile = page.getByRole('button', { name: player.name });
    await tile.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('button', { name: '301', exact: true }).click();
  const fewerLegs = page.getByRole('button', { name: 'Mniej legów: Mecze ligi' });
  await fewerLegs.click();
  await fewerLegs.click();
  await expect(fewerLegs).toBeDisabled();

  const plan = page.getByRole('region', { name: 'Plan turnieju' });
  await expect(plan.locator('dt', { hasText: 'Razem meczów' }).locator('xpath=following-sibling::dd[1]')).toHaveText('3');

  await page.getByRole('button', { name: 'Rozpocznij turniej' }).click();
  await expect(page).toHaveURL(/#\/tournaments\/t_[^/]+$/);
  tournamentId = decodeURIComponent(new URL(page.url()).hash.replace('#/tournaments/', ''));
  await expect(page.getByRole('heading', { level: 1, name: tournamentName })).toBeVisible();
  await expect(progress(page, 'Liga · 0 z 3 meczów')).toBeVisible();
});

test('plays the three league matches from the tournament screen', async ({ page, request }) => {
  await page.goto(tournamentUrl());
  for (const done of [1, 2, 3]) {
    await page.getByRole('button', { name: 'Zagraj mecz', exact: true }).click();
    await expect(page).toHaveURL(/#\/matches\/[^/]+$/);
    const matchId = decodeURIComponent(new URL(page.url()).hash.replace('#/matches/', ''));
    const match = await getMatchByApi(request, token, matchId);
    const [winner] = match.players.map((player) => player.id).sort((first, second) => rank(first) - rank(second));
    await winMatchByApi(request, token, matchId, winner ?? '');

    await page.getByRole('link', { name: 'Wróć do turnieju' }).click();
    await expect(page).toHaveURL(/#\/tournaments\/[^/]+$/);
    await expect(progress(page, done === 3 ? 'Turniej zakończony' : `Liga · ${done} z 3 meczów`)).toBeVisible();
  }
});

test('shows the final table, placements and podium', async ({ page, request }) => {
  await page.goto(tournamentUrl());
  await expect(progress(page, 'Turniej zakończony')).toBeVisible();

  const rows = page.getByRole('table', { name: 'Tabela ligi' }).locator('tbody tr');
  await expect(rows).toHaveCount(3);
  for (const [index, points] of [4, 2, 0].entries()) {
    const row = rows.nth(index);
    await expect(row.getByRole('rowheader')).toContainText(players[index]?.name ?? '');
    await expect(row.locator('td').last()).toHaveText(String(points));
  }

  const view = await getTournamentByApi(request, token, tournamentId);
  expect(view.status).toBe('finished');
  expect([...view.placements].sort((first, second) => first.place - second.place)).toEqual(
    players.map((player, index) => ({ playerId: player.id, place: index + 1 })),
  );

  await page.getByRole('tab', { name: 'Statystyki' }).click();
  const podium = page.getByRole('region', { name: 'Podium', exact: true });
  await expect(podium.getByRole('listitem').first()).toContainText(players[0].name);
});

test('lists the finished league with its winner and archives it', async ({ page }) => {
  await page.goto('/#/tournaments');
  const row = page.getByRole('listitem').filter({ hasText: tournamentName });
  await expect(row).toContainText(`Zwycięzca: ${players[0].name}`);
  await expect(page).toHaveURL(/#\/tournaments$/);

  await page.getByRole('button', { name: `Archiwizuj: ${tournamentName}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Zarchiwizować turniej?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Archiwizuj', exact: true }).click();
  await expect(row).toHaveCount(0);
});
