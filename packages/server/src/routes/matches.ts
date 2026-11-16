import {
  AbandonMatchRequest,
  CheckoutAttemptRequest,
  CommandRequest,
  CreateMatchRequest,
  MatchListQuery,
  RestMissRequest,
} from '@autoscore/schema';
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

  app.post<MatchParams>('/matches/:id/checkout-attempts', async (request, reply) => {
    const parsed = CheckoutAttemptRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return reply.code(201).send(await service.registerCheckoutAttempt(request.params.id, parsed.data.success, parsed.data.expectedSeq));
  });

  app.post<MatchParams>('/matches/:id/abandon', async (request) => {
    const parsed = AbandonMatchRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return service.abandon(request.params.id, parsed.data);
  });

  app.post<MatchParams>('/matches/:id/rest-miss', async (request, reply) => {
    const parsed = RestMissRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    const { statusCode, result } = await service.restMiss(request.params.id, parsed.data);
    return reply.code(statusCode).send(result);
  });

  // Undo, wznowienie, koniec treningu i pominięcie checkoutu czytają z body tylko expectedSeq. Własny parser w tym kontekście
  // czyta body jako JSON przy każdym typie treści. Pusty albo zepsuty JSON i wartość, która nie jest obiektem, znaczą brak body,
  // więc nie dają błędu 400. Obiekt musi przejść CommandRequest.
  await app.register((undoScope) => {
    undoScope.removeAllContentTypeParsers();
    undoScope.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => done(null, lenientJson(body)));
    undoScope.post<MatchParams>('/matches/:id/undo', async (request) => service.undo(request.params.id, commandSeq(request.body)));
    undoScope.post<MatchParams>('/matches/:id/resume', async (request) => service.resume(request.params.id, commandSeq(request.body)));
    undoScope.post<MatchParams>('/matches/:id/end', async (request) => service.endPractice(request.params.id, commandSeq(request.body)));
    undoScope.post<MatchParams>('/matches/:id/checkout-skips', async (request, reply) =>
      reply.code(201).send(await service.registerCheckoutSkip(request.params.id, commandSeq(request.body))),
    );
  });
}

function lenientJson(body: Buffer | string): unknown {
  try {
    return JSON.parse(typeof body === 'string' ? body : body.toString('utf8'));
  } catch {
    return undefined;
  }
}

function commandSeq(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined;
  }
  const parsed = CommandRequest.safeParse(body);
  if (!parsed.success) {
    throw invalidRequest(parsed.error.issues);
  }
  return parsed.data.expectedSeq;
}
