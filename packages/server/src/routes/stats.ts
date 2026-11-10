import { PlayerFormQuery, PlayerStatsQuery, RankingsQuery } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { invalidRequest } from '../errors.js';
import type { StatsService } from '../stats-service.js';

interface IdParams {
  Params: { id: string };
}

export function statsRoutes(app: FastifyInstance, stats: StatsService): void {
  app.get<IdParams>('/players/:id/stats', async (request) => {
    const parsed = PlayerStatsQuery.safeParse(request.query);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return stats.playerStats(request.params.id, parsed.data.type);
  });

  app.get<{ Params: { id: string; opponentId: string } }>('/players/:id/head-to-head/:opponentId', async (request) =>
    stats.headToHead(request.params.id, request.params.opponentId),
  );

  app.get<IdParams>('/players/:id/form', async (request) => {
    const parsed = PlayerFormQuery.safeParse(request.query);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return stats.playerForm(request.params.id, parsed.data.type);
  });

  app.get<IdParams>('/players/:id/frequent-hits', async (request) => stats.frequentHits(request.params.id));

  app.get('/stats/rankings', async (request) => {
    const parsed = RankingsQuery.safeParse(request.query);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return stats.rankings(parsed.data.type);
  });

  app.get('/stats/overall', async () => stats.overall());

  app.get<IdParams>('/matches/:id/summary', async (request) => stats.matchSummary(request.params.id));
}
