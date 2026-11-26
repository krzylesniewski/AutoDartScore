import {
  ApiError,
  HeadToHead,
  PlayerForm,
  PlayerStats,
  StatsOverall,
  StatsRankings,
  type MatchType,
  type StatsFilter,
} from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LEG_301, backdateMatch, createGame, createPlayers, setup, throwDarts, type TestApp } from '../test-helpers.js';

const DAY_MS = 86_400_000;

let now: number;
let t: TestApp;
let anna: string;
let bartek: string;
beforeEach(async () => {
  // Zegar serwera stoi w miejscu, a gry dostają created_at z zegara ściennego, więc świeża gra jest zawsze w okresie.
  now = Date.now();
  t = await setup({ now: () => now });
  [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];
});
afterEach(async () => {
  await t.close();
});

// Anna wygrywa best of 1, więc gra liczy się w każdej z pięciu tras.
async function playGame(ageMs: number, type: Extract<MatchType, 'match' | 'casual'> = 'match'): Promise<string> {
  const payload =
    type === 'match'
      ? { type, playerIds: [anna, bartek], startingScore: 301, bestOf: 1 }
      : { type, playerIds: [anna, bartek], startingScore: 301 };
  const { id } = await createGame(t.app, payload);
  await throwDarts(t.app, id, LEG_301);
  await backdateMatch(t.db, id, now - ageMs);
  return id;
}

function get(url: string) {
  return t.app.inject({ method: 'GET', url });
}

async function getOk(url: string): Promise<unknown> {
  const response = await get(url);
  expect(response.statusCode).toBe(200);
  return response.json();
}

function query(period: string | undefined, type?: StatsFilter): string {
  const params = new URLSearchParams();
  if (type !== undefined) {
    params.set('type', type);
  }
  if (period !== undefined) {
    params.set('period', period);
  }
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

interface Route {
  readonly name: string;
  readonly path: () => string;
  readonly included: (body: unknown) => number;
  readonly empty: (body: unknown) => void;
}

const routes: readonly Route[] = [
  {
    name: 'GET /players/:id/stats',
    path: () => `/players/${anna}/stats`,
    included: (body) => PlayerStats.parse(body).matchesPlayed,
    empty: (body) => {
      expect(PlayerStats.parse(body)).toMatchObject({ matchesPlayed: 0, matchesWon: 0, dartsThrown: 0, average: null, legsWon: 0 });
    },
  },
  {
    name: 'GET /players/:id/head-to-head/:opponentId',
    path: () => `/players/${anna}/head-to-head/${bartek}`,
    included: (body) => HeadToHead.parse(body).matchesPlayed,
    empty: (body) => {
      expect(HeadToHead.parse(body)).toMatchObject({
        matchesPlayed: 0,
        matchesWon: 0,
        average: null,
        opponentAverage: null,
        lastPlayedAt: null,
      });
    },
  },
  {
    name: 'GET /players/:id/form',
    path: () => `/players/${anna}/form`,
    included: (body) => PlayerForm.parse(body).points.length,
    empty: (body) => {
      expect(PlayerForm.parse(body).points).toEqual([]);
    },
  },
  {
    name: 'GET /stats/rankings',
    path: () => '/stats/rankings',
    included: (body) => StatsRankings.parse(body).games,
    empty: (body) => {
      expect(StatsRankings.parse(body)).toMatchObject({
        games: 0,
        legs: 0,
        players: [],
        bestLegAverage: [],
        highestCheckout: [],
        shortestLeg: [],
        highestTurn: [],
      });
    },
  },
  {
    name: 'GET /stats/overall',
    path: () => '/stats/overall',
    included: (body) => StatsOverall.parse(body).games,
    empty: (body) => {
      expect(StatsOverall.parse(body)).toMatchObject({ games: 0, legs: 0, darts: 0, average: null, players: [] });
    },
  },
];

describe.each(routes)('$name with period', (route) => {
  async function count(period?: string): Promise<number> {
    return route.included(await getOk(`${route.path()}${query(period)}`));
  }

  it('leaves an 8-day-old game out of 7d and keeps it in 30d', async () => {
    await playGame(8 * DAY_MS);
    expect(await count('7d')).toBe(0);
    expect(await count('30d')).toBe(1);
    expect(await count('all')).toBe(1);
  });

  it('keeps a 31-day-old game only in all', async () => {
    await playGame(31 * DAY_MS);
    expect(await count('7d')).toBe(0);
    expect(await count('30d')).toBe(0);
    expect(await count('all')).toBe(1);
    expect(await count()).toBe(1);
  });

  it('includes a game exactly 30 days old and leaves out one 1 ms older', async () => {
    const id = await playGame(30 * DAY_MS);
    expect(await count('30d')).toBe(1);
    await backdateMatch(t.db, id, now - 30 * DAY_MS - 1);
    expect(await count('30d')).toBe(0);
  });

  it('answers 200 with an empty result for a period without games', async () => {
    await playGame(31 * DAY_MS);
    route.empty(await getOk(`${route.path()}?period=30d`));
  });

  it.each(['90d', 'quarter', ''])('rejects the period %j with 400 invalid_request', async (period) => {
    const response = await get(`${route.path()}?period=${period}`);
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });

  it('echoes the requested period, and all without the parameter', async () => {
    for (const period of ['7d', '30d', 'all'] as const) {
      expect(await getOk(`${route.path()}?period=${period}`)).toMatchObject({ period });
    }
    expect(await getOk(route.path())).toMatchObject({ period: 'all' });
  });

  it('answers the same without the parameter as with period=all when an old game exists', async () => {
    await playGame(200 * DAY_MS);
    await playGame(DAY_MS);
    const all = await getOk(`${route.path()}?period=all`);
    expect(route.included(all)).toBe(2);
    expect(await getOk(route.path())).toEqual(all);
  });
});

describe.each(routes.filter((route) => route.name !== 'GET /players/:id/head-to-head/:opponentId' && route.name !== 'GET /stats/overall'))(
  '$name with type and period',
  (route) => {
    it('combines type and period', async () => {
      await playGame(DAY_MS, 'casual');
      await playGame(15 * DAY_MS, 'match');
      const recentMatch = await getOk(`${route.path()}${query('7d', 'match')}`);
      expect(recentMatch).toMatchObject({ filter: 'match', period: '7d' });
      expect(route.included(recentMatch)).toBe(0);
      expect(route.included(await getOk(`${route.path()}${query('7d', 'casual')}`))).toBe(1);
      expect(route.included(await getOk(`${route.path()}${query('30d', 'match')}`))).toBe(1);
      expect(route.included(await getOk(`${route.path()}${query('7d', 'all')}`))).toBe(1);
      expect(route.included(await getOk(`${route.path()}${query('30d', 'all')}`))).toBe(2);
    });
  },
);

describe('GET /stats/rankings win rate and T20 hits with period', () => {
  async function lists(period: string) {
    const { winRate, t20Hits } = StatsRankings.parse(await getOk(`/stats/rankings?period=${period}`));
    return { winRate: winRate.map((entry) => entry.playerId), t20Hits: t20Hits.map((entry) => entry.playerId) };
  }

  // Jedna gra nie wystarcza do rankingu wygranych, więc gracze potrzebują trzech.
  it('leaves 8-day-old games out of 7d and keeps them in 30d', async () => {
    for (let game = 0; game < 3; game += 1) {
      await playGame(8 * DAY_MS);
    }
    expect(await lists('7d')).toEqual({ winRate: [], t20Hits: [] });
    expect(await lists('30d')).toEqual({ winRate: [anna, bartek], t20Hits: [anna] });
  });
});

describe('GET /players/:id/head-to-head/:opponentId with period', () => {
  it('takes lastPlayedAt only from games inside the period', async () => {
    await playGame(8 * DAY_MS);
    expect(HeadToHead.parse(await getOk(`/players/${anna}/head-to-head/${bartek}?period=7d`)).lastPlayedAt).toBeNull();
    expect(HeadToHead.parse(await getOk(`/players/${anna}/head-to-head/${bartek}?period=30d`)).lastPlayedAt).not.toBeNull();
  });
});

describe('GET /players/:id/frequent-hits', () => {
  it('keeps every game regardless of age', async () => {
    await playGame(200 * DAY_MS);
    const response = await getOk(`/players/${anna}/frequent-hits`);
    expect(response).not.toHaveProperty('period');
    expect(response).toMatchObject({ hits: expect.arrayContaining([expect.objectContaining({ segment: 20, multiplier: 3 })]) as unknown });
  });
});
