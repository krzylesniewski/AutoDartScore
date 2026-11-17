import type { PublicTournamentMatch, PublicTournamentStats, PublicTournamentView, TournamentView } from '@autoscore/schema';
import { HttpError } from './errors.js';
import type { MatchService } from './match-service.js';
import { publicMatch, publicTournamentView } from './public/redact.js';
import type { PublicResponseCache } from './public/response-cache.js';
import type { StatsService } from './stats-service.js';
import type { TournamentService } from './tournament-service.js';

// Odczyty publicznego linku bez tokenu. Id turnieju to 128 losowych bitów, więc służy za link.
export interface PublicTournamentService {
  view(id: string): Promise<PublicTournamentView>;
  stats(id: string): Promise<PublicTournamentStats>;
  // Tylko mecz z tego turnieju.
  match(id: string, matchId: string): Promise<PublicTournamentMatch>;
}

interface Dependencies {
  readonly tournaments: Pick<TournamentService, 'get' | 'stats'>;
  readonly matches: Pick<MatchService, 'get'>;
  readonly stats: Pick<StatsService, 'matchSummary' | 'matchLegs'>;
  readonly cache: PublicResponseCache;
}

// Bez id i bez powodu, żeby wyłączone udostępnianie, archiwum i nieznane id dały bajt w bajt tę samą odpowiedź.
function hidden(): HttpError {
  return new HttpError(404, 'not_found', 'Not found');
}

export function createPublicTournamentService({ tournaments, matches, stats, cache }: Dependencies): PublicTournamentService {
  async function shared(id: string): Promise<TournamentView> {
    let view: TournamentView;
    try {
      view = await tournaments.get(id);
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 404) {
        throw hidden();
      }
      throw error;
    }
    if (!view.sharing || view.archivedAt !== null) {
      throw hidden();
    }
    return view;
  }

  return {
    view(id) {
      return cache.remember(id, 'view', async () => publicTournamentView(await shared(id)));
    },

    stats(id) {
      return cache.remember(id, 'stats', async () => {
        await shared(id);
        return tournaments.stats(id);
      });
    },

    match(id, matchId) {
      return cache.remember(id, `match:${matchId}`, async () => {
        const view = await shared(id);
        const fixture = view.fixtures.find((candidate) => candidate.matchId === matchId);
        if (fixture === undefined) {
          throw hidden();
        }
        const snapshot = await matches.get(matchId);
        if (snapshot.tournament === null) {
          throw new Error(`Match ${matchId} of tournament ${id} is not linked to it`);
        }
        return {
          tournamentId: id,
          fixtureId: fixture.id,
          label: snapshot.tournament.label,
          match: publicMatch(snapshot),
          summary: await stats.matchSummary(matchId),
          legs: await stats.matchLegs(matchId),
        };
      });
    },
  };
}
