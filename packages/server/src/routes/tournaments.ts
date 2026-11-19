import {
  CorrectResultRequest,
  CreateTournamentRequest,
  SharingRequest,
  TournamentListQuery,
  WithdrawPlayerRequest,
} from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { invalidRequest } from '../errors.js';
import type { TournamentService } from '../tournament-service.js';
import { commandSeq, lenientCommands } from './command-body.js';

interface TournamentParams {
  Params: { id: string };
}

interface FixtureParams {
  Params: { id: string; fixtureId: string };
}

export async function tournamentRoutes(app: FastifyInstance, service: TournamentService): Promise<void> {
  app.post('/tournaments', async (request, reply) => {
    const parsed = CreateTournamentRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return reply.code(201).send(await service.create(parsed.data));
  });

  app.get('/tournaments', async (request) => {
    const parsed = TournamentListQuery.safeParse(request.query);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return service.list(parsed.data);
  });

  app.get<TournamentParams>('/tournaments/:id', async (request) => service.get(request.params.id));

  app.get<TournamentParams>('/tournaments/:id/stats', async (request) => service.stats(request.params.id));

  app.post<TournamentParams>('/tournaments/:id/withdrawals', async (request, reply) => {
    const parsed = WithdrawPlayerRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return reply.code(201).send(await service.withdraw(request.params.id, parsed.data));
  });

  app.post<TournamentParams>('/tournaments/:id/sharing', async (request) => {
    const parsed = SharingRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return service.setSharing(request.params.id, parsed.data);
  });

  app.post<FixtureParams>('/tournaments/:id/fixtures/:fixtureId/result', async (request) => {
    const parsed = CorrectResultRequest.safeParse(request.body);
    if (!parsed.success) {
      throw invalidRequest(parsed.error.issues);
    }
    return service.correctResult(request.params.id, request.params.fixtureId, parsed.data);
  });

  // Losowanie, start meczu i archiwizacja czytają z body tylko expectedSeq, jak cofnięcie rzutki.
  await app.register((commandScope) => {
    lenientCommands(commandScope);
    commandScope.post<TournamentParams>('/tournaments/:id/draw', async (request) =>
      service.draw(request.params.id, commandSeq(request.body)),
    );
    commandScope.post<FixtureParams>('/tournaments/:id/fixtures/:fixtureId/start', async (request, reply) => {
      const { statusCode, result } = await service.startFixture(request.params.id, request.params.fixtureId, commandSeq(request.body));
      return reply.code(statusCode).send(result);
    });
    commandScope.post<TournamentParams>('/tournaments/:id/archive', async (request) =>
      service.archive(request.params.id, commandSeq(request.body)),
    );
  });
}
