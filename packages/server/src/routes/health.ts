import type { HealthResponse } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';

export function healthRoutes(app: FastifyInstance): void {
  app.get('/health', (): HealthResponse => ({ status: 'ok' }));
}
