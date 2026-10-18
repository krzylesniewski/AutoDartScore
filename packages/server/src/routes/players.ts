import { CreatePlayerRequest, ListPlayersQuery, UpdatePlayerRequest } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { invalidRequest, notFound } from '../errors.js';
import type { Store } from '../store/store.js';

interface IdParams {
  Params: { id: string };
}

export function playerRoutes(app: FastifyInstance, store: Store): void {
  app.post('/players', async (request, reply) => {
    const parsed = CreatePlayerRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return reply.code(201).send(await store.createPlayer(parsed.data));
  });

  app.get('/players', async (request) => {
    const parsed = ListPlayersQuery.safeParse(request.query);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return store.listPlayers({ includeArchived: parsed.data.archived === 'include' });
  });

  app.patch<IdParams>('/players/:id', async (request) => {
    const parsed = UpdatePlayerRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    const player = await store.updatePlayer(request.params.id, parsed.data);
    if (!player) {
      throw notFound(`Player ${request.params.id}`);
    }
    return player;
  });
}
