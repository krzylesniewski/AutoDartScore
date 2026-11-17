import { expect, test } from '@playwright/test';
import {
  FINISHING_DARTS,
  archiveTournamentByApi,
  createPlayerByApi,
  createTournamentByApi,
  getTournamentByApi,
  loginByApi,
  postThrowsByApi,
  startFixtureByApi,
} from './helpers/api';
import { boxOf, expectInViewport, expectNoHorizontalScroll } from './helpers/layout';
import { uniqueName, useToken } from './helpers/session';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

let token: string;
let tournamentId: string;

test.beforeAll(async ({ request }) => {
  token = await loginByApi(request);
  const players = await Promise.all([
    createPlayerByApi(request, token, uniqueName('Ala')),
    createPlayerByApi(request, token, uniqueName('Ola')),
    createPlayerByApi(request, token, uniqueName('Ela')),
  ]);
  const tournament = await createTournamentByApi(
    request,
    token,
    uniqueName('Turniej e2e'),
    players.map((player) => player.id),
  );
  tournamentId = tournament.id;
});

// Trwający turniej przekierowałby #/tournaments w layout.spec.ts, a drugi POST /tournaments dostałby tournament_active.
test.afterAll(async ({ request }) => {
  let view = await getTournamentByApi(request, token, tournamentId);
  for (let round = 0; round < view.fixtures.length && view.status === 'in_progress'; round += 1) {
    const fixtureId = view.fixtures.find((fixture) => fixture.status === 'in_progress')?.id ?? view.nextFixtureId;
    if (fixtureId === null) {
      break;
    }
    const { matchId } = await startFixtureByApi(request, token, tournamentId, fixtureId);
    await postThrowsByApi(request, token, matchId, FINISHING_DARTS);
    view = await getTournamentByApi(request, token, tournamentId);
  }
  await archiveTournamentByApi(request, token, tournamentId);
});

test.beforeEach(async ({ context }) => {
  await useToken(context, token);
});

for (const viewport of VIEWPORTS) {
  test(`tournament screen keeps Zagraj mecz in view without horizontal scroll at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/#/tournaments/${encodeURIComponent(tournamentId)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // exact, bo Playwright dopasowuje nazwę po fragmencie, a w kolejce jest „Zagraj mecz 2”.
    const play = page.getByRole('button', { name: 'Zagraj mecz', exact: true });
    await expect(play).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectInViewport(await boxOf(play), page);
  });
}

test('plays a tournament match and returns to the tournament', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/#/tournaments/${encodeURIComponent(tournamentId)}`);
  await page.getByRole('button', { name: 'Zagraj mecz', exact: true }).click();
  await expect(page).toHaveURL(/#\/matches\/[^/]+$/);
  await expect(page.getByText('Liga, mecz 1', { exact: true })).toBeVisible();

  const matchId = decodeURIComponent(new URL(page.url()).hash.replace('#/matches/', ''));
  await postThrowsByApi(request, token, matchId, FINISHING_DARTS);
  const back = page.getByRole('link', { name: 'Wróć do turnieju' });
  await expect(back).toBeVisible();
  await back.click();

  await expect(page).toHaveURL(/#\/tournaments\/[^/]+$/);
  await expect(page.getByText('Liga · 1 z 3 meczów')).toBeVisible();
  await expect(page.getByText('1–0', { exact: true })).toBeVisible();
});
