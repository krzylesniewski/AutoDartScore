import { isGameFinished, type GameState } from '@autoscore/engine';
import type { DomainEvent, FrequentHitsResponse, HeadToHead, Hit, LegProgress, MatchSummary, MatchType, PlayerForm, PlayerStats, StatsFilter, StatsRankings } from '@autoscore/schema';
import { HttpError, notFound } from './errors.js';
import { effectiveCheckoutAttempts, effectiveThrows, lastActivityAt, lastSeq, replayMatch } from './replay.js';
import { checkoutSession } from './snapshot.js';
import { completedPlayerLegs } from './stats/completed-legs.js';
import { buildForm, type FormGame } from './stats/form.js';
import { buildFrequentHits } from './stats/frequent-hits.js';
import { buildHeadToHead, type HeadToHeadGame } from './stats/head-to-head.js';
import { buildLegProgress } from './stats/leg-progress.js';
import { buildRankings } from './stats/rankings.js';
import { EMPTY_TOTALS, mergeTotals, tallyGame, threeDartAverage, toStatLine } from './stats/tally.js';
import type { Store, StoredMatch } from './store/store.js';

export interface StatsService {
  playerStats(playerId: string, filter: StatsFilter): Promise<PlayerStats>;
  matchSummary(matchId: string): Promise<MatchSummary>;
  rankings(filter: StatsFilter): Promise<StatsRankings>;
  headToHead(playerId: string, opponentId: string): Promise<HeadToHead>;
  playerForm(playerId: string, filter: StatsFilter): Promise<PlayerForm>;
  frequentHits(playerId: string): Promise<FrequentHitsResponse>;
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

// Po match_won silnik zostaje na ostatnim legu, a w trwającym meczu po wygranym legu legIndex wskazuje już nowy leg.
function lastLegProgress(game: GameState, playerIds: readonly string[], events: readonly DomainEvent[]): LegProgress | null {
  switch (game.type) {
    case 'match':
      return buildLegProgress(playerIds, game.state.config.startingScore, game.state.legIndex, events);
    case 'casual': // zabawa ma zawsze jeden leg
      return buildLegProgress(playerIds, game.state.config.startingScore, 0, events);
    case 'practice':
      return null;
  }
}

// Bez kolejki gry, jak GET /matches/:id: tylko czyta log i odtwarza go w silniku.
export function createStatsService({ store }: Dependencies): StatsService {
  async function replayed(match: StoredMatch) {
    const log = await store.loadLog(match.id);
    const { state, events } = replayMatch(match, effectiveThrows(log), effectiveCheckoutAttempts(log));
    const playerIds = match.players.map((player) => player.id);
    return {
      seq: lastSeq(log),
      state,
      finished: isGameFinished(state),
      lastActivityAt: lastActivityAt(log, match),
      playerIds,
      events,
      tally: tallyGame(match.type, playerIds, events),
    };
  }

  async function requirePlayer(playerId: string): Promise<void> {
    const [player] = await store.findPlayers([playerId]);
    if (!player) {
      throw notFound(`Player ${playerId}`);
    }
  }

  // Gry gracza, które wchodzą do statystyk, w kolejności utworzenia.
  async function statsGames(playerId: string, filter: StatsFilter): Promise<StoredMatch[]> {
    const matches = [];
    for (const matchId of await store.findMatchIdsForPlayer(playerId, FILTER_TYPES[filter])) {
      const match = await store.findMatch(matchId);
      if (match) {
        matches.push(match);
      }
    }
    return matches;
  }

  return {
    async playerStats(playerId, filter) {
      await requirePlayer(playerId);
      let totals = EMPTY_TOTALS;
      let legPoints = 0;
      let legDarts = 0;
      let matchesPlayed = 0;
      let matchesWon = 0;
      for (const match of await statsGames(playerId, filter)) {
        const { finished, playerIds, events, tally } = await replayed(match);
        totals = mergeTotals(totals, tally.players.get(playerId) ?? EMPTY_TOTALS);
        for (const leg of completedPlayerLegs(match.type, playerIds, events)) {
          if (leg.playerId === playerId) {
            legPoints += leg.points;
            legDarts += leg.darts;
          }
        }
        // Solo 501 nie jest rozegranym meczem. Niedokończona gra wnosi zamknięte tury do rzutek i rekordów,
        // a do średniej tylko ukończone legi, jak w rankingu.
        if (finished && match.type !== 'practice') {
          matchesPlayed += 1;
          matchesWon += tally.winnerId === playerId ? 1 : 0;
        }
      }
      return { ...toStatLine(totals), average: threeDartAverage(legPoints, legDarts), playerId, filter, matchesPlayed, matchesWon };
    },

    async matchSummary(matchId) {
      const match = await store.findMatch(matchId);
      if (!match) {
        throw notFound(`Match ${matchId}`);
      }
      const { seq, state, finished, playerIds, events, tally } = await replayed(match);
      return {
        matchId,
        type: match.type,
        finished,
        eventSeq: seq,
        players: playerIds.map((playerId) => ({ ...toStatLine(tally.players.get(playerId) ?? EMPTY_TOTALS), playerId })),
        legs: [...tally.legs],
        lastLegProgress: lastLegProgress(state, playerIds, events),
        checkouts: state.type === 'practice' && state.practiceMode === 'checkouts' ? checkoutSession(state.state) : null,
      };
    },

    async rankings(filter) {
      const types = FILTER_TYPES[filter];
      const games = [];
      for (const match of await store.listMatches()) {
        if (!match.countsToStats || !types.includes(match.type)) {
          continue;
        }
        const { playerIds, events, tally } = await replayed(match);
        games.push({ type: match.type, legs: completedPlayerLegs(match.type, playerIds, events), tally });
      }
      // Zarchiwizowany gracz zostaje w rankingu. Ukrywa go tylko wybór graczy do nowej gry.
      return { filter, ...buildRankings({ players: await store.listPlayers({ includeArchived: true }), games }) };
    },

    async headToHead(playerId, opponentId) {
      if (playerId === opponentId) {
        throw new HttpError(400, 'invalid_request', 'Head-to-head needs two different players');
      }
      await requirePlayer(playerId);
      await requirePlayer(opponentId);
      const games: HeadToHeadGame[] = [];
      const playedAt: string[] = [];
      for (const match of await statsGames(playerId, 'match')) {
        if (!match.players.some((player) => player.id === opponentId)) {
          continue;
        }
        const { finished, events, tally, lastActivityAt } = await replayed(match);
        // Porzucona albo trwająca gra nie ma zwycięzcy, więc nie wchodzi do bilansu.
        if (!finished) {
          continue;
        }
        games.push({ winnerId: tally.winnerId, events });
        playedAt.push(lastActivityAt);
      }
      // Daty ISO w UTC porównują się jak tekst.
      return { ...buildHeadToHead({ playerId, opponentId, games }), lastPlayedAt: playedAt.sort().at(-1) ?? null };
    },

    async playerForm(playerId, filter) {
      await requirePlayer(playerId);
      const games: FormGame[] = [];
      for (const match of await statsGames(playerId, filter)) {
        const { playerIds, events } = await replayed(match);
        const legs = completedPlayerLegs(match.type, playerIds, events).filter((leg) => leg.playerId === playerId);
        games.push({ matchId: match.id, type: match.type, createdAt: match.createdAt, legs });
      }
      return { playerId, filter, points: buildForm(games) };
    },

    async frequentHits(playerId) {
      await requirePlayer(playerId);
      const darts: Hit[] = [];
      for (const match of await statsGames(playerId, 'all')) {
        const { events } = await replayed(match);
        for (const event of events) {
          // Jak reszta statystyk liczy tylko zamknięte tury. Zwycięska tura też ma turn_completed.
          if ((event.type === 'turn_completed' || event.type === 'bust') && event.playerId === playerId) {
            darts.push(...event.darts);
          }
        }
      }
      return { playerId, hits: buildFrequentHits(darts) };
    },
  };
}
