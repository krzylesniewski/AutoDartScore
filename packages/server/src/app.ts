import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from './db/database.js';
import { toApiError } from './errors.js';
import { createLiveHub } from './live-hub.js';
import { createMatchService } from './match-service.js';
import { liveRoutes } from './routes/live.js';
import { matchRoutes } from './routes/matches.js';
import { playerRoutes } from './routes/players.js';
import { createSerialQueue } from './serial-queue.js';
import { createStore } from './store/store.js';

export interface AppOptions {
  readonly db: Kysely<Database>;
  readonly random?: () => number; // losowanie, kto zaczyna. Domyślnie Math.random
  readonly logger?: boolean;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  await app.register(websocket);

  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = toApiError(error);
    if (statusCode >= 500) {
      request.log.error(error);
    }
    return reply.code(statusCode).send(body);
  });
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({ error: 'not_found', message: `Route ${request.method} ${request.url} not found` }),
  );

  const store = createStore(options.db);
  const service = createMatchService({ store, hub: createLiveHub(), queue: createSerialQueue(), random: options.random ?? Math.random });
  playerRoutes(app, store);
  await matchRoutes(app, service);
  liveRoutes(app, service);
  return app;
}
