import type { FastifyInstance } from 'fastify';
import type { MatchService } from '../match-service.js';

export const MATCH_NOT_FOUND_CLOSE_CODE = 4404;

export function liveRoutes(app: FastifyInstance, service: MatchService): void {
  app.get<{ Params: { id: string } }>('/matches/:id/live', { websocket: true }, async (socket, request) => {
    let closed = false;
    let unsubscribe: (() => void) | null = null;
    socket.on('close', () => {
      closed = true;
      unsubscribe?.();
    });
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
  });
}
