import { LoginRequest, type LoginResponse } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { TOKEN_TTL_MS, createToken, passwordMatches } from '../auth/credentials.js';
import type { LoginLimiter } from '../auth/login-limiter.js';
import type { AuthConfig } from '../config.js';
import { HttpError, invalidRequest } from '../errors.js';

export interface AuthRouteOptions {
  readonly auth: AuthConfig;
  readonly limiter: LoginLimiter;
  readonly now: () => number;
}

export function authRoutes(app: FastifyInstance, { auth, limiter, now }: AuthRouteOptions): void {
  app.post('/auth/login', async (request, reply): Promise<LoginResponse> => {
    // Blokada przed sprawdzeniem hasła, żeby w trakcie blokady nie dało się zgadywać dalej.
    const retryAfterMs = limiter.retryAfterMs();
    if (retryAfterMs !== null) {
      reply.header('retry-after', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      throw new HttpError(429, 'too_many_attempts', 'Too many failed logins, try again later');
    }
    const parsed = LoginRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    if (!passwordMatches(auth.password, parsed.data.password)) {
      limiter.recordFailure();
      throw new HttpError(401, 'invalid_password', 'Invalid password');
    }
    const expiresAtMs = now() + TOKEN_TTL_MS;
    return { token: createToken(auth.tokenSecret, expiresAtMs), expiresAt: new Date(expiresAtMs).toISOString() };
  });
}
