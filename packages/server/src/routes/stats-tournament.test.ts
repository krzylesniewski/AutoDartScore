import { ApiError, HeadToHead, PlayerForm, PlayerStats, StartFixtureResult, StatsRankings, TournamentView } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEG_301,
  T,
  backdateMatch,
  correctResult,
  createGame,
  createPlayers,
  createTournament,
  fixtureOf,
  getTournament,
  playFixture,
  setup,
  slotPlayers,
  startFixture,
  throwDarts,
  withdraw,
  type TestApp,
} from '../test-helpers.js';

const DAY_MS = 86_400_000;

let t: TestApp;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

async function getOk(url: string): Promise<unknown> {
  const response = await t.app.inject({ method: 'GET', url });
  expect(response.statusCode).toBe(200);
  return response.json();
}

const rankings = async (query: string) => StatsRankings.parse(await getOk(`/stats/rankings?${query}`));
const playerStats = async (playerId: string, query: string) => PlayerStats.parse(await getOk(`/players/${playerId}/stats?${query}`));
const form = async (playerId: string, query: string) => PlayerForm.parse(await getOk(`/players/${playerId}/form?${query}`));
const headToHead = async (playerId: string, opponentId: string) =>
  HeadToHead.parse(await getOk(`/players/${playerId}/head-to-head/${opponentId}`));

async function league(): Promise<TournamentView> {
  const playerIds = await createPlayers(t.app, 3);
  return createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds });
}

// Liga 3 graczy z trzema rozegranymi meczami, a para z g-1 gra też zwykły mecz 1v1 i zabawę.
async function seed() {
  const view = await league();
  const played = new Map<string, { matchId: string; winnerId: string }>();
  for (const fixtureId of ['g-1', 'g-2', 'g-3']) {
    const { matchId, winnerId } = await playFixture(t.app, view.id, fixtureId);
    played.set(fixtureId, { matchId, winnerId });
  }
  const pair = slotPlayers(fixtureOf(view, 'g-1'));
  const plain = await createGame(t.app, { type: 'match', playerIds: pair, startingScore: 301, bestOf: 1 });
  await throwDarts(t.app, plain.id, LEG_301);
  const casual = await createGame(t.app, { type: 'casual', playerIds: pair, startingScore: 301 });
  await throwDarts(t.app, casual.id, LEG_301);
  // Mecze ligi gracza ze slotu 0 meczu g-1.
  const player = pair[0];
  const leagueMatchIds = ['g-1', 'g-2', 'g-3']
    .filter((fixtureId) => slotPlayers(fixtureOf(view, fixtureId)).includes(player))
    .map((fixtureId) => played.get(fixtureId)?.matchId);
  return { view, played, pair, player, leagueMatchIds, plainId: plain.id };
}

describe('stats with the tournament filter', () => {
  it('counts only tournament matches in rankings, while match and all include them', async () => {
    await seed();

    expect(await rankings('type=tournament')).toMatchObject({ filter: 'tournament', games: 3, legs: 3 });
    expect((await rankings('type=match')).games).toBe(4);
    expect((await rankings('type=all')).games).toBe(5);
  });

  it('counts only the tournament matches of a player', async () => {
    const { player } = await seed();

    expect(await playerStats(player, 'type=tournament')).toMatchObject({ filter: 'tournament', matchesPlayed: 2 });
    expect((await playerStats(player, 'type=match')).matchesPlayed).toBe(3);
  });

  it('builds the form from tournament matches only', async () => {
    const { player, leagueMatchIds, plainId } = await seed();
    expect(leagueMatchIds).toHaveLength(2);

    const tournamentIds = (await form(player, 'type=tournament')).points.map((point) => point.matchId);
    expect(tournamentIds.sort()).toEqual([...leagueMatchIds].sort());
    const matchIds = (await form(player, 'type=match')).points.map((point) => point.matchId);
    expect(matchIds).toContain(plainId);
    expect(matchIds).toEqual(expect.arrayContaining(leagueMatchIds));
  });

  it('counts tournament matches in head-to-head', async () => {
    const {
      pair: [first, second],
    } = await seed();

    const balance = await headToHead(first, second);
    expect(balance.matchesPlayed).toBe(2);
    expect(balance.matchesWon + balance.opponentMatchesWon).toBe(2);
    expect(balance.legsWon + balance.opponentLegsWon).toBe(2);
  });

  it('applies the period to tournament matches', async () => {
    const { played } = await seed();
    await backdateMatch(t.db, played.get('g-2')?.matchId ?? '', Date.now() - 40 * DAY_MS);

    expect((await rankings('type=tournament&period=30d')).games).toBe(2);
    expect((await rankings('type=tournament')).games).toBe(3);
  });

  it('keeps match wins from the throw log after a result correction', async () => {
    const { view, played, pair } = await seed();
    const winner = played.get('g-1')?.winnerId ?? '';
    const opponent = pair.find((id) => id !== winner) ?? '';
    const winsBefore = (await playerStats(winner, 'type=tournament')).matchesWon;
    const balanceBefore = await headToHead(winner, opponent);

    const response = await correctResult(t.app, view.id, 'g-1', { legs: [0, 1] });
    expect(response.statusCode).toBe(200);
    expect(fixtureOf(TournamentView.parse(response.json()), 'g-1').result?.corrected).toBe(true);

    expect((await playerStats(winner, 'type=tournament')).matchesWon).toBe(winsBefore);
    const balanceAfter = await headToHead(winner, opponent);
    expect(balanceAfter.matchesWon).toBe(balanceBefore.matchesWon);
    expect(balanceAfter.opponentMatchesWon).toBe(balanceBefore.opponentMatchesWon);
  });

  it('rejects an unknown filter', async () => {
    const { player } = await seed();

    const response = await t.app.inject({ method: 'GET', url: `/players/${player}/stats?type=bogus` });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });

  it('leaves out the walkover and the match abandoned by a withdrawal', async () => {
    const view = await league();
    const response = await startFixture(t.app, view.id, 'g-1');
    expect(response.statusCode).toBe(201);
    const { matchId } = StartFixtureResult.parse(response.json());
    const [withdrawn, opponent] = slotPlayers(fixtureOf(view, 'g-1'));
    await throwDarts(t.app, matchId, [T(20), T(20), T(20)]);
    expect((await withdraw(t.app, view.id, { playerId: withdrawn })).statusCode).toBe(201);

    const remaining = ['g-2', 'g-3'].find((fixtureId) => !slotPlayers(fixtureOf(view, fixtureId)).includes(withdrawn)) ?? '';
    await playFixture(t.app, view.id, remaining);
    const others = slotPlayers(fixtureOf(await getTournament(t.app, view.id), remaining));

    expect(await rankings('type=tournament')).toMatchObject({ games: 1, legs: 1 });
    expect(await playerStats(withdrawn, 'type=tournament')).toMatchObject({ matchesPlayed: 0, dartsThrown: 3 });
    for (const playerId of others) {
      expect((await playerStats(playerId, 'type=tournament')).matchesPlayed).toBe(1);
    }
    expect((await headToHead(withdrawn, opponent)).matchesPlayed).toBe(0);
  });
});
