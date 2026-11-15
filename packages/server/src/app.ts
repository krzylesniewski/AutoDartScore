import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { registerAccessControl } from './auth/access.js';
import { createLoginLimiter } from './auth/login-limiter.js';
import type { AuthConfig } from './config.js';
import type { Database } from './db/database.js';
import { toApiError } from './errors.js';
import { createLiveHub } from './live-hub.js';
import { createMatchService } from './match-service.js';
import { createReplayCache, REPLAY_CACHE_MAX_MATCHES } from './replay-cache.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { LIVE_MAX_PAYLOAD_BYTES, LIVE_MAX_PENDING_CONNECTIONS, liveRoutes } from './routes/live.js';
import { matchRoutes } from './routes/matches.js';
import { playerRoutes } from './routes/players.js';
import { statsRoutes } from './routes/stats.js';
import { firstSegment, webAppRoutes } from './routes/web-app.js';
import { createSerialQueue } from './serial-queue.js';
import { createStatsService } from './stats-service.js';
import { createStore } from './store/store.js';

export interface AppOptions {
  readonly db: Kysely<Database>;
  readonly random?: () => number; // losowanie, kto zaczyna, i ziarna celów treningu checkoutów. Domyślnie Math.random
  readonly logger?: boolean;
  readonly auth?: AuthConfig | null;
  readonly corsOrigins?: readonly string[] | null;
  readonly now?: () => number; // zegar dla tokenów, limitu logowań, blokady zakończonej gry i okresu statystyk. Domyślnie Date.now
  readonly liveAuthTimeoutMs?: number;
  readonly liveMaxPendingConnections?: number;
  readonly livePingIntervalMs?: number;
  readonly webDir?: string | null; // katalog zbudowanego frontu. null wyłącza serwowanie plików
  readonly matchLockMinutes?: number; // ile minut po ostatniej rzutce da się cofać w zakończonej grze. Domyślnie 5
  readonly replayCacheSize?: number; // najwięcej gier w pamięci podręcznej odtworzeń. 0 ją wyłącza. Domyślnie REPLAY_CACHE_MAX_MATCHES
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const webDir = options.webDir ?? null;
  const webRoutes = new Set<string>();
  const apiSegments = new Set<string>();
  if (webDir !== null) {
    // Hak przed pierwszą trasą, żeby plik frontu nie przesłonił żadnej trasy API, także parametrycznej.
    app.addHook('onRoute', (route) => {
      apiSegments.add(firstSegment(route.url));
    });
  }
  await app.register(websocket, { options: { maxPayload: LIVE_MAX_PAYLOAD_BYTES } });
  const auth = options.auth ?? null;
  const now = options.now ?? Date.now;
  await registerAccessControl(app, { auth, corsOrigins: options.corsOrigins ?? null, now, webRoutes });

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
  const cache = createReplayCache({ store, log: app.log, maxEntries: options.replayCacheSize ?? REPLAY_CACHE_MAX_MATCHES });
  const service = createMatchService({
    store,
    hub: createLiveHub(),
    queue: createSerialQueue(),
    random: options.random ?? Math.random,
    now,
    matchLockMs: (options.matchLockMinutes ?? 5) * 60_000,
    cache,
  });
  healthRoutes(app);
  if (auth !== null) {
    authRoutes(app, { auth, limiter: createLoginLimiter(now), now });
  }
  playerRoutes(app, store);
  await matchRoutes(app, service);
  liveRoutes(app, service, {
    auth,
    now,
    authTimeoutMs: options.liveAuthTimeoutMs ?? 5000,
    pingIntervalMs: options.livePingIntervalMs ?? 30_000,
    maxPendingConnections: options.liveMaxPendingConnections ?? LIVE_MAX_PENDING_CONNECTIONS,
  });
  statsRoutes(app, createStatsService({ store, cache, now }));
  if (webDir !== null) {
    await webAppRoutes(app, { webDir, webRoutes, apiSegments });
  }
  return app;
}
