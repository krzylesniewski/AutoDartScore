import type { FastifyBaseLogger } from 'fastify';
import { replayLog, type ReplayedMatch } from './replay.js';
import type { Store, StoredMatch } from './store/store.js';

// Na danych ze skryptu bench (405 gier, 45 tys. rzutek) pamięć podręczna zajmuje około 28 MB, czyli średnio 70 KB na grę.
// 500 gier to więc kilkadziesiąt MB na serwerze z 1 GB, a mieści się cała historia rzędu 300 gier.
export const REPLAY_CACHE_MAX_MATCHES = 500;

export interface MatchReplay {
  readonly match: StoredMatch; // gra z wejścia, z aktualnymi profilami graczy
  readonly replay: ReplayedMatch;
}

export interface ReplayCache {
  // Błąd odczytu albo odtworzenia przechodzi dalej.
  one(match: StoredMatch): Promise<ReplayedMatch>;
  // W kolejności wejścia. Uszkodzone gry są pomijane i trafiają do logu.
  many(matches: readonly StoredMatch[]): Promise<MatchReplay[]>;
}

interface Dependencies {
  readonly store: Pick<Store, 'lastSeqs' | 'loadLogs'>;
  readonly log: Pick<FastifyBaseLogger, 'warn'>;
  readonly maxEntries: number; // 0 wyłącza pamięć podręczną
}

type Outcome = { readonly match: StoredMatch; readonly replay: ReplayedMatch } | { readonly match: StoredMatch; readonly error: unknown };

// Tylko wyniki odtworzenia logu, bez migawek, profili i sum statystyk. Wpis jest aktualny, dopóki log gry nie ma nowego seq.
export function createReplayCache({ store, log, maxEntries }: Dependencies): ReplayCache {
  const entries = new Map<string, ReplayedMatch>();

  // LRU na kolejności wstawiania w Map: trafienie wstawia wpis na koniec.
  function cached(matchId: string, seq: number | undefined): ReplayedMatch | undefined {
    const entry = entries.get(matchId);
    if (entry === undefined || entry.seq !== seq) {
      return undefined;
    }
    entries.delete(matchId);
    entries.set(matchId, entry);
    return entry;
  }

  function remember(matchId: string, replay: ReplayedMatch): void {
    if (maxEntries <= 0) {
      return;
    }
    entries.delete(matchId);
    entries.set(matchId, replay);
    for (const oldest of entries.keys()) {
      if (entries.size <= maxEntries) {
        break;
      }
      entries.delete(oldest);
    }
  }

  async function resolve(matches: readonly StoredMatch[]): Promise<Outcome[]> {
    const seqs = await store.lastSeqs(matches.map((match) => match.id));
    const outcomes = new Map<string, Outcome>();
    const misses: StoredMatch[] = [];
    for (const match of matches) {
      const replay = cached(match.id, seqs.get(match.id));
      if (replay === undefined) {
        misses.push(match);
      } else {
        outcomes.set(match.id, { match, replay });
      }
    }
    const logs = misses.length === 0 ? new Map<string, never>() : await store.loadLogs(misses.map((match) => match.id));
    for (const match of misses) {
      const loaded = logs.get(match.id) ?? new Error(`Log of match ${match.id} was not loaded`);
      if (loaded instanceof Error) {
        outcomes.set(match.id, { match, error: loaded });
        continue;
      }
      try {
        const replay = replayLog(match, loaded);
        // Pod seq wczytanego logu, bo między lastSeqs a loadLogs mogła dojść rzutka.
        remember(match.id, replay);
        outcomes.set(match.id, { match, replay });
      } catch (error) {
        outcomes.set(match.id, { match, error });
      }
    }
    return matches.flatMap((match) => outcomes.get(match.id) ?? []);
  }

  return {
    async one(match) {
      const [outcome] = await resolve([match]);
      if (outcome === undefined) {
        throw new Error(`Match ${match.id} was not replayed`);
      }
      if ('error' in outcome) {
        throw outcome.error;
      }
      return outcome.replay;
    },

    async many(matches) {
      const replays: MatchReplay[] = [];
      let skipped = 0;
      for (const outcome of await resolve(matches)) {
        if ('error' in outcome) {
          skipped += 1;
          log.warn({ matchId: outcome.match.id, err: outcome.error }, 'Skipping a corrupt match');
          continue;
        }
        replays.push(outcome);
      }
      if (skipped > 0) {
        log.warn({ skipped }, 'Skipped corrupt matches in a list or aggregate');
      }
      return replays;
    },
  };
}
