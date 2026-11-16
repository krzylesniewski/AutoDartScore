import { LiveAuthMessage } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { verifyToken } from '../auth/credentials.js';
import type { AuthConfig } from '../config.js';
import type { MatchService } from '../match-service.js';

export const MATCH_NOT_FOUND_CLOSE_CODE = 4404;
export const UNAUTHORIZED_CLOSE_CODE = 4401;
export const TOO_MANY_CONNECTIONS_CLOSE_CODE = 4429;
// Jedyna wiadomość klienta to auth (około 100 bajtów), więc 4 KiB zostawia zapas na dłuższy format tokenu.
export const LIVE_MAX_PAYLOAD_BYTES = 4096;
export const LIVE_MAX_PENDING_CONNECTIONS = 20;

export interface LiveRouteOptions {
  readonly auth: AuthConfig | null;
  readonly now: () => number;
  readonly authTimeoutMs: number;
  readonly pingIntervalMs: number;
  readonly maxPendingConnections: number;
}

function isValidAuth(data: unknown, auth: AuthConfig, nowMs: number): boolean {
  let message: unknown;
  try {
    message = JSON.parse(String(data));
  } catch {
    return false;
  }
  const parsed = LiveAuthMessage.safeParse(message);
  return parsed.success && verifyToken(auth, parsed.data.token, nowMs);
}

export function liveRoutes(
  app: FastifyInstance,
  service: MatchService,
  { auth, now, authTimeoutMs, pingIntervalMs, maxPendingConnections }: LiveRouteOptions,
): void {
  let pending = 0;

  app.get<{ Params: { id: string } }>('/matches/:id/live', { websocket: true }, async (socket, request) => {
    if (auth !== null && pending >= maxPendingConnections) {
      socket.close(TOO_MANY_CONNECTIONS_CLOSE_CODE, 'Too many pending connections');
      return;
    }

    let closed = false;
    let unsubscribe: (() => void) | null = null;
    let alive = true;
    socket.on('pong', () => {
      alive = true;
    });
    // Reverse proxy zamyka połączenia bez ruchu po około 100 s.
    const ping = setInterval(() => {
      if (!alive) {
        socket.terminate();
        return;
      }
      alive = false;
      socket.ping();
    }, pingIntervalMs);
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

    pending++;
    let released = false;
    function release(): void {
      if (!released) {
        released = true;
        pending--;
      }
    }

    // Miejsce zwalnia się już przy timeoucie, bo close() czeka na ramkę zamknięcia od klienta.
    const timeout = setTimeout(() => {
      release();
      socket.close(UNAUTHORIZED_CLOSE_CODE, 'Unauthorized');
    }, authTimeoutMs);
    socket.on('close', () => {
      release();
      clearTimeout(timeout);
    });
    // Nasłuch bez czekania, bo klient wysyła auth zaraz po otwarciu.
    socket.once('message', (data: unknown) => {
      release();
      clearTimeout(timeout);
      if (isValidAuth(data, auth, now())) {
        void subscribe();
      } else {
        socket.close(UNAUTHORIZED_CLOSE_CODE, 'Unauthorized');
      }
    });
  });
}
