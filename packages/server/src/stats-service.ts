import { isGameFinished } from '@autoscore/engine';
import type { MatchSummary, MatchType, PlayerStats, StatsFilter } from '@autoscore/schema';
import { notFound } from './errors.js';
import { effectiveThrows, lastSeq, replayMatch } from './replay.js';
import { EMPTY_TOTALS, mergeTotals, tallyGame, toStatLine } from './stats/tally.js';
import type { Store, StoredMatch } from './store/store.js';

export interface StatsService {
  playerStats(playerId: string, filter: StatsFilter): Promise<PlayerStats>;
  matchSummary(matchId: string): Promise<MatchSummary>;
}

interface Dependencies {
  readonly store: Store;
}

const FILTER_TYPES: Record<StatsFilter, readonly MatchType[]> = {
  all: ['match', 'casual', 'practice'],
  match: ['match'],
  casual: ['casual'],
  practice: ['practice'],
};

// Bez kolejki gry, jak GET /matches/:id: tylko czyta log i odtwarza go w silniku.
export function createStatsService({ store }: Dependencies): StatsService {
  async function replayed(match: StoredMatch) {
    const log = await store.loadLog(match.id);
    const { state, events } = replayMatch(match, effectiveThrows(log));
    const playerIds = match.players.map((player) => player.id);
    return { seq: lastSeq(log), finished: isGameFinished(state), playerIds, tally: tallyGame(match.type, playerIds, events) };
  }

  return {
    async playerStats(playerId, filter) {
      const [player] = await store.findPlayers([playerId]);
      if (!player) {
        throw notFound(`Player ${playerId}`);
      }
      let totals = EMPTY_TOTALS;
      let matchesPlayed = 0;
      let matchesWon = 0;
      for (const matchId of await store.findMatchIdsForPlayer(playerId, FILTER_TYPES[filter])) {
        const match = await store.findMatch(matchId);
        if (!match) {
          continue;
        }
        const { finished, tally } = await replayed(match);
        totals = mergeTotals(totals, tally.players.get(playerId) ?? EMPTY_TOTALS);
        // Solo 501 nie jest rozegranym meczem, a niedokończona gra wnosi tylko zamknięte tury.
        if (finished && match.type !== 'practice') {
          matchesPlayed += 1;
          matchesWon += tally.winnerId === playerId ? 1 : 0;
        }
      }
      return { ...toStatLine(totals), playerId, filter, matchesPlayed, matchesWon };
    },

    async matchSummary(matchId) {
      const match = await store.findMatch(matchId);
      if (!match) {
        throw notFound(`Match ${matchId}`);
      }
      const { seq, finished, playerIds, tally } = await replayed(match);
      return {
        matchId,
        type: match.type,
        finished,
        eventSeq: seq,
        players: playerIds.map((playerId) => ({ ...toStatLine(tally.players.get(playerId) ?? EMPTY_TOTALS), playerId })),
        legs: [...tally.legs],
      };
    },
  };
}
