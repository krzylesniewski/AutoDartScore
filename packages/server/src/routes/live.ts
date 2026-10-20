import { LiveAuthMessage } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { verifyToken } from '../auth/credentials.js';
import type { AuthConfig } from '../config.js';
import type { MatchService } from '../match-service.js';

export const MATCH_NOT_FOUND_CLOSE_CODE = 4404;
export const UNAUTHORIZED_CLOSE_CODE = 4401;

export interface LiveRouteOptions {
  readonly auth: AuthConfig | null;
  readonly now: () => number;
  readonly authTimeoutMs: number;
  readonly pingIntervalMs: number;
}

function isValidAuth(data: unknown, auth: AuthConfig, nowMs: number): boolean {
  let message: unknown;
  try {
    message = JSON.parse(String(data));
  } catch {
    return false;
  }
  const parsed = LiveAuthMessage.safeParse(message);
  return parsed.success && verifyToken(auth.tokenSecret, parsed.data.token, nowMs);
}

export function liveRoutes(app: FastifyInstance, service: MatchService, { auth, now, authTimeoutMs, pingIntervalMs }: LiveRouteOptions): void {
  app.get<{ Params: { id: string } }>('/matches/:id/live', { websocket: true }, async (socket, request) => {
    let closed = false;
    let unsubscribe: (() => void) | null = null;
    // Reverse proxy zamyka połączenia bez ruchu po około 100 s.
    const ping = setInterval(() => socket.ping(), pingIntervalMs);
    socket.on('close', () => {
      closed = true;
      clearInterval(ping);
      unsubscribe?.();
    });

    async function subscribe(): Promise<void> {
      try {
        unsubscribe = await service.subscribe(request.params.id, socket);
      } catch (error) {
        request.log.error(error);
        socket.close(1011, 'Internal server error');
        return;
      }
      if (unsubscribe === null) {
        socket.close(MATCH_NOT_FOUND_CLOSE_CODE, 'Match not found');
      } else if (closed) {
        unsubscribe();
      }
    }

    if (auth === null) {
      return subscribe();
    }

    // Nasłuch bez czekania, bo klient wysyła auth zaraz po otwarciu.
    const timeout = setTimeout(() => socket.close(UNAUTHORIZED_CLOSE_CODE, 'Unauthorized'), authTimeoutMs);
    socket.on('close', () => clearTimeout(timeout));
    socket.once('message', (data: unknown) => {
      clearTimeout(timeout);
      if (isValidAuth(data, auth, now())) {
        void subscribe();
      } else {
        socket.close(UNAUTHORIZED_CLOSE_CODE, 'Unauthorized');
      }
    });
  });
}
