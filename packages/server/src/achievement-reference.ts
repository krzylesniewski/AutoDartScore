import { isGameFinished } from '@autoscore/engine';
import type { ReplayCache } from './replay-cache.js';
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
  readonly cache: ReplayCache;
}

// Rekordy gracza z ukończonych meczów 1v1, trzymane tylko w pamięci. Po restarcie serwera budujemy je od nowa z logu.
export function createAchievementReference({ store, cache: replays }: Dependencies): AchievementReference {
  const cache = new Map<string, PlayerReference>();
  let generation = 0;

  // Uszkodzony wcześniejszy mecz jest pomijany, więc nie blokuje rzutek w nowym meczu.
  async function build(playerId: string, currentMatchId: string): Promise<PlayerReference> {
    let finishedMatches = 0;
    let records = EMPTY_RECORDS;
    const matches = (await store.listMatches({ playerId, types: ['match'], countsToStats: true })).filter(
      (match) => match.id !== currentMatchId,
    );
    for (const { match, replay } of await replays.many(matches)) {
      // Porzucona gra nigdy nie jest ukończona, więc też tu odpada.
      if (!isGameFinished(replay.game)) {
        continue;
      }
      finishedMatches += 1;
      const playerIds = match.players.map((player) => player.id);
      records = mergeRecords(records, buildRecords(playerIds, replay.events).get(playerId) ?? EMPTY_RECORDS);
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
