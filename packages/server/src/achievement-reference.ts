import { isGameFinished } from '@autoscore/engine';
import { effectiveThrows, replayMatch } from './replay.js';
import { buildRecords, EMPTY_RECORDS, mergeRecords, type PlayerRecords } from './stats/achievements.js';
import type { Store } from './store/store.js';

export interface PlayerReference {
  readonly finishedMatches: number;
  readonly records: PlayerRecords;
}

export interface AchievementReference {
  forPlayer(playerId: string, currentMatchId: string): Promise<PlayerReference>;
  invalidate(): void;
}

interface Dependencies {
  readonly store: Store;
}

// Rekordy gracza z ukończonych meczów 1v1, trzymane tylko w pamięci. Po restarcie serwera budujemy je od nowa z logu.
export function createAchievementReference({ store }: Dependencies): AchievementReference {
  const cache = new Map<string, PlayerReference>();
  let generation = 0;

  async function build(playerId: string, currentMatchId: string): Promise<PlayerReference> {
    let finishedMatches = 0;
    let records = EMPTY_RECORDS;
    for (const matchId of await store.findMatchIdsForPlayer(playerId, ['match'])) {
      if (matchId === currentMatchId) {
        continue;
      }
      const match = await store.findMatch(matchId);
      if (!match) {
        continue;
      }
      const { state, events } = replayMatch(match, effectiveThrows(await store.loadLog(matchId)));
      // Porzucona gra nigdy nie jest ukończona, więc też tu odpada.
      if (!isGameFinished(state)) {
        continue;
      }
      finishedMatches += 1;
      const playerIds = match.players.map((player) => player.id);
      records = mergeRecords(records, buildRecords(playerIds, events).get(playerId) ?? EMPTY_RECORDS);
    }
    return { finishedMatches, records };
  }

  return {
    async forPlayer(playerId, currentMatchId) {
      const key = JSON.stringify([playerId, currentMatchId]);
      const cached = cache.get(key);
      if (cached) {
        return cached;
      }
      // Wynik budowany przed invalidate() może być już nieaktualny, więc go nie zapisujemy.
      const started = generation;
      const built = await build(playerId, currentMatchId);
      if (started === generation) {
        cache.set(key, built);
      }
      return built;
    },
    invalidate() {
      generation += 1;
      cache.clear();
    },
  };
}
