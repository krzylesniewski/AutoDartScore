import cors from '@fastify/cors';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthConfig } from '../config.js';
import { HttpError, unauthorized } from '../errors.js';
import { verifyToken } from './credentials.js';

export interface AccessControlOptions {
  readonly auth: AuthConfig | null;
  readonly corsOrigins: readonly string[] | null;
  readonly now: () => number;
  readonly webRoutes: ReadonlySet<string>; // trasy plików frontu, otwarte dla GET i HEAD
}

const PUBLIC_ROUTES = new Set(['/health', '/auth/login']);

function bearerToken(request: FastifyRequest): string | null {
  const match = /^Bearer +(\S+)$/i.exec(request.headers.authorization ?? '');
  return match?.[1] ?? null;
}

export async function registerAccessControl(app: FastifyInstance, { auth, corsOrigins, now, webRoutes }: AccessControlOptions): Promise<void> {
  // CORS przed hakiem autoryzacji, żeby odpowiedź 401 też miała nagłówki CORS i front mógł odczytać status.
  if (corsOrigins !== null) {
    await app.register(cors, {
      origin: [...corsOrigins],
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 7200,
    });
  }

  app.addHook('onRequest', async (request) => {
    // WebSocket uwierzytelnia się pierwszą wiadomością, bo przeglądarka nie ustawi nagłówka Authorization.
    if (request.ws) {
      const origin = request.headers.origin;
      if (corsOrigins !== null && origin !== undefined && !corsOrigins.includes(origin)) {
        throw new HttpError(403, 'forbidden_origin', `Origin ${origin} is not allowed`);
      }
      return;
    }
    const route = request.routeOptions.url ?? '';
    if (auth === null || request.method === 'OPTIONS' || PUBLIC_ROUTES.has(route)) {
      return;
    }
    // Przeglądarka pobiera front bez tokenu, bo ekran logowania jest jego częścią. Decyduje dopasowana trasa, nie surowy adres.
    if ((request.method === 'GET' || request.method === 'HEAD') && webRoutes.has(route)) {
      return;
    }
    const token = bearerToken(request);
    if (token === null || !verifyToken(auth.tokenSecret, token, now())) {
      throw unauthorized();
    }
  });
}
