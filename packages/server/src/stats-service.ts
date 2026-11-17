import { isGameFinished, type GameState } from '@autoscore/engine';
import type {
  DomainEvent,
  FrequentHitsResponse,
  HeadToHead,
  Hit,
  LegProgress,
  MatchSummary,
  PlayerForm,
  PlayerStats,
  StatsFilter,
  StatsOverall,
  StatsPeriod,
  StatsRankings,
} from '@autoscore/schema';
import { HttpError, notFound } from './errors.js';
import type { MatchReplay, ReplayCache } from './replay-cache.js';
import { closedPauses, type ReplayedMatch } from './replay.js';
import { checkoutSession } from './snapshot.js';
import { completedPlayerLegs } from './stats/completed-legs.js';
import { buildForm, type FormGame } from './stats/form.js';
import { buildFrequentHits } from './stats/frequent-hits.js';
import { buildHeadToHead, type HeadToHeadGame } from './stats/head-to-head.js';
import { legDurations } from './stats/leg-durations.js';
import { buildLegProgress } from './stats/leg-progress.js';
import { buildOverall } from './stats/overall.js';
import { periodStart } from './stats/period.js';
import { buildRankings, type RankedGame } from './stats/rankings.js';
import { EMPTY_TOTALS, mergeTotals, tallyGame, threeDartAverage, toStatLine, winRatePercent } from './stats/tally.js';
import type { MatchFilter, Store, StoredMatch } from './store/store.js';

export interface StatsService {
  playerStats(playerId: string, filter: StatsFilter, period: StatsPeriod): Promise<PlayerStats>;
  matchSummary(matchId: string): Promise<MatchSummary>;
  rankings(filter: StatsFilter, period: StatsPeriod): Promise<StatsRankings>;
  overall(period: StatsPeriod): Promise<StatsOverall>;
  headToHead(playerId: string, opponentId: string, period: StatsPeriod): Promise<HeadToHead>;
  playerForm(playerId: string, filter: StatsFilter, period: StatsPeriod): Promise<PlayerForm>;
  frequentHits(playerId: string): Promise<FrequentHitsResponse>;
}

interface Dependencies {
  readonly store: Store;
  readonly cache: ReplayCache;
  readonly now: () => number; // zegar serwera, od którego liczy się okres statystyk
}

// Mecz turniejowy jest zapisany jako match, więc filtr match obejmuje też mecze z turniejów.
const FILTER_MATCHES: Record<StatsFilter, Pick<MatchFilter, 'types' | 'inTournament'>> = {
  all: { types: ['match', 'casual', 'practice'] },
  match: { types: ['match'] },
  casual: { types: ['casual'] },
  practice: { types: ['practice'] },
  tournament: { types: ['match'], inTournament: true },
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

// Liczone przy każdym wywołaniu z odtworzenia logu. Pamięć podręczna trzyma tylko odtworzenie, nie sumy statystyk.
function replayed(match: StoredMatch, { log, throws, seq, game, updatedAt, events }: ReplayedMatch) {
  const playerIds = match.players.map((player) => player.id);
  return {
    log,
    throws,
    seq,
    state: game,
    finished: isGameFinished(game),
    lastActivityAt: updatedAt,
    playerIds,
    events,
    tally: tallyGame(match.type, playerIds, events),
  };
}

// Bez kolejki gry: tylko czyta log i odtwarza go w silniku albo bierze odtworzenie niezmienionego logu z pamięci podręcznej.
// Listy i sumy pomijają uszkodzone gry, a podsumowanie jednej gry zwraca dla niej błąd jak GET /matches/:id.
export function createStatsService({ store, cache, now }: Dependencies): StatsService {
  async function requirePlayer(playerId: string): Promise<void> {
    const [player] = await store.findPlayers([playerId]);
    if (!player) {
      throw notFound(`Player ${playerId}`);
    }
  }

  // Gry gracza, które wchodzą do statystyk, w kolejności utworzenia.
  // Okres filtruje już zapytanie, więc starsze gry nie są wczytywane ani odtwarzane.
  function statsMatches(playerId: string, filter: StatsFilter, period: StatsPeriod): Promise<StoredMatch[]> {
    return store.listMatches({ playerId, ...FILTER_MATCHES[filter], countsToStats: true, createdFrom: periodStart(period, now()) });
  }

  async function statsGames(playerId: string, filter: StatsFilter, period: StatsPeriod): Promise<MatchReplay[]> {
    return cache.many(await statsMatches(playerId, filter, period));
  }

  // Gry wszystkich graczy liczone do statystyk, w przeciwieństwie do statsGames dla jednego gracza.
  async function rankedGames(filter: StatsFilter, period: StatsPeriod): Promise<RankedGame[]> {
    const matches = await store.listMatches({ ...FILTER_MATCHES[filter], countsToStats: true, createdFrom: periodStart(period, now()) });
    return (await cache.many(matches)).map(({ match, replay }) => {
      const { finished, playerIds, events, tally } = replayed(match, replay);
      return { type: match.type, finished, legs: completedPlayerLegs(match.type, playerIds, events), tally };
    });
  }

  return {
    async playerStats(playerId, filter, period) {
      await requirePlayer(playerId);
      let totals = EMPTY_TOTALS;
      let legPoints = 0;
      let legDarts = 0;
      let matchesPlayed = 0;
      let matchesWon = 0;
      for (const { match, replay } of await statsGames(playerId, filter, period)) {
        const { finished, playerIds, events, tally } = replayed(match, replay);
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
      return {
        ...toStatLine(totals),
        average: threeDartAverage(legPoints, legDarts),
        playerId,
        filter,
        period,
        matchesPlayed,
        matchesWon,
        winRate: winRatePercent(matchesWon, matchesPlayed),
      };
    },

    async matchSummary(matchId) {
      const match = await store.findMatch(matchId);
      if (!match) {
        throw notFound(`Match ${matchId}`);
      }
      const { log, throws, seq, state, finished, playerIds, events, tally } = replayed(match, await cache.one(match));
      const durations = legDurations(events, throws, closedPauses(log));
      return {
        matchId,
        type: match.type,
        finished,
        eventSeq: seq,
        players: playerIds.map((playerId) => ({ ...toStatLine(tally.players.get(playerId) ?? EMPTY_TOTALS), playerId })),
        legs: tally.legs.map((leg) => {
          const durationMs = durations.get(leg.legIndex);
          if (durationMs === undefined) {
            throw new Error(`Corrupt match ${matchId}: leg ${leg.legIndex} has no duration`);
          }
          return { ...leg, durationMs };
        }),
        lastLegProgress: lastLegProgress(state, playerIds, events),
        checkouts: state.type === 'practice' && state.practiceMode === 'checkouts' ? checkoutSession(state.state) : null,
      };
    },

    async rankings(filter, period) {
      // Zarchiwizowany gracz zostaje w rankingu. Ukrywa go tylko wybór graczy do nowej gry.
      return {
        filter,
        period,
        ...buildRankings({ players: await store.listPlayers({ includeArchived: true }), games: await rankedGames(filter, period) }),
      };
    },

    async overall(period) {
      return {
        period,
        ...buildOverall({ players: await store.listPlayers({ includeArchived: true }), games: await rankedGames('all', period) }),
      };
    },

    async headToHead(playerId, opponentId, period) {
      if (playerId === opponentId) {
        throw new HttpError(400, 'invalid_request', 'Head-to-head needs two different players');
      }
      await requirePlayer(playerId);
      await requirePlayer(opponentId);
      const games: HeadToHeadGame[] = [];
      const playedAt: string[] = [];
      const withOpponent = (await statsMatches(playerId, 'match', period)).filter((match) =>
        match.players.some((player) => player.id === opponentId),
      );
      for (const { match, replay } of await cache.many(withOpponent)) {
        const { finished, events, tally, lastActivityAt } = replayed(match, replay);
        // Porzucona albo trwająca gra nie ma zwycięzcy, więc nie wchodzi do bilansu.
        if (!finished) {
          continue;
        }
        games.push({ winnerId: tally.winnerId, events });
        playedAt.push(lastActivityAt);
      }
      // Daty ISO w UTC porównują się jak tekst.
      return { ...buildHeadToHead({ playerId, opponentId, games }), period, lastPlayedAt: playedAt.sort().at(-1) ?? null };
    },

    async playerForm(playerId, filter, period) {
      await requirePlayer(playerId);
      const games: FormGame[] = [];
      for (const { match, replay } of await statsGames(playerId, filter, period)) {
        const { playerIds, events } = replayed(match, replay);
        const legs = completedPlayerLegs(match.type, playerIds, events).filter((leg) => leg.playerId === playerId);
        games.push({ matchId: match.id, type: match.type, createdAt: match.createdAt, legs });
      }
      return { playerId, filter, period, points: buildForm(games) };
    },

    async frequentHits(playerId) {
      await requirePlayer(playerId);
      const darts: Hit[] = [];
      for (const { replay } of await statsGames(playerId, 'all', 'all')) {
        for (const event of replay.events) {
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
