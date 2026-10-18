import { CreatePlayerRequest } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { invalidRequest } from '../errors.js';
import type { Store } from '../store/store.js';

export function playerRoutes(app: FastifyInstance, store: Store): void {
  app.post('/players', async (request, reply) => {
    const parsed = CreatePlayerRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return reply.code(201).send(await store.createPlayer(parsed.data));
  });

  app.get('/players', async () => store.listPlayers());
}
