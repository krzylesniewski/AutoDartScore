import type { FastifyInstance } from 'fastify';
import { HttpError } from '../errors.js';
import type { PublicTournamentService } from '../public-tournament-service.js';
import type { PublicRateLimiter } from '../public/rate-limiter.js';

// Wzorce tras czytanych bez tokenu. Hak autoryzacji porównuje z nimi dopasowaną trasę, nie surowy adres.
export const PUBLIC_TOURNAMENT_ROUTES = {
  view: '/public/tournaments/:id',
  stats: '/public/tournaments/:id/stats',
  match: '/public/tournaments/:id/matches/:matchId',
} as const;

export interface PublicRouteOptions {
  readonly service: PublicTournamentService;
  readonly limiter: PublicRateLimiter;
}

interface TournamentParams {
  Params: { id: string };
}

interface MatchParams {
  Params: { id: string; matchId: string };
}

// Tylko GET. Limit liczy każde żądanie do tych tras, także 404, więc zgadywanie id też zwalnia.
export async function publicRoutes(app: FastifyInstance, { service, limiter }: PublicRouteOptions): Promise<void> {
  await app.register((scope) => {
    scope.addHook('onRequest', (request, reply, done) => {
      const retryAfterMs = limiter.take(request.ip);
      if (retryAfterMs === null) {
        done();
        return;
      }
      reply.header('retry-after', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      done(new HttpError(429, 'too_many_requests', 'Too many requests, try again later'));
    });

    scope.get<TournamentParams>(PUBLIC_TOURNAMENT_ROUTES.view, async (request) => service.view(request.params.id));
    scope.get<TournamentParams>(PUBLIC_TOURNAMENT_ROUTES.stats, async (request) => service.stats(request.params.id));
    scope.get<MatchParams>(PUBLIC_TOURNAMENT_ROUTES.match, async (request) => service.match(request.params.id, request.params.matchId));
  });
}
