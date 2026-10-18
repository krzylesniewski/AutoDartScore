import { AbandonMatchRequest, CreateMatchRequest, MatchListQuery } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { invalidRequest } from '../errors.js';
import type { MatchService } from '../match-service.js';

interface MatchParams {
  Params: { id: string };
}

export async function matchRoutes(app: FastifyInstance, service: MatchService): Promise<void> {
  app.post('/matches', async (request, reply) => {
    const parsed = CreateMatchRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return reply.code(201).send(await service.create(parsed.data));
  });

  app.get('/matches', async (request) => {
    const parsed = MatchListQuery.safeParse(request.query);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return service.list(parsed.data);
  });

  app.get<MatchParams>('/matches/:id', async (request) => service.get(request.params.id));

  app.post<MatchParams>('/matches/:id/throws', async (request, reply) => {
    const { statusCode, result } = await service.registerThrow(request.params.id, request.body);
    return reply.code(statusCode).send(result);
  });

  app.post<MatchParams>('/matches/:id/abandon', async (request) => {
    const parsed = AbandonMatchRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return service.abandon(request.params.id, parsed.data);
  });

  // Undo i wznowienie ignorują body. Własny parser w tym kontekście sprawia, że nawet pusty albo zepsuty JSON nie daje błędu 400.
  await app.register(async (undoScope) => {
    undoScope.removeAllContentTypeParsers();
    undoScope.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, _body, done) => done(null, undefined));
    undoScope.post<MatchParams>('/matches/:id/undo', async (request) => service.undo(request.params.id));
    undoScope.post<MatchParams>('/matches/:id/resume', async (request) => service.resume(request.params.id));
  });
}
