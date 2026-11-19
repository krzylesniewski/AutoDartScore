export const PUBLIC_CACHE_TTL_MS = 5000;

export type PublicEndpoint = 'view' | 'stats' | `match:${string}`;

export interface PublicResponseCache {
  // Generację bierze odczyt przed wczytaniem danych i oddaje ją w set.
  generation(tournamentId: string): number;
  get(tournamentId: string, endpoint: PublicEndpoint): unknown;
  // Nie zapisuje, gdy od pobrania generacji turniej został unieważniony.
  set(tournamentId: string, endpoint: PublicEndpoint, generation: number, body: unknown): void;
  invalidate(tournamentId: string): void;
  // Odczyt przez pamięć podręczną. Błąd z load przechodzi dalej i nic nie zapisuje.
  remember<T>(tournamentId: string, endpoint: PublicEndpoint, load: () => Promise<T>): Promise<T>;
  entryCount(): number;
}

interface Entry {
  readonly body: unknown;
  readonly expiresAt: number;
}

// Tylko udane odpowiedzi publiczne. Generacja chroni przed zapisem odczytu, który zaczął się przed unieważnieniem.
// Inaczej odczyt równoległy z wyłączeniem udostępniania mógłby jeszcze przez TTL dawać 200.
export function createPublicResponseCache(now: () => number): PublicResponseCache {
  const entries = new Map<string, Map<PublicEndpoint, Entry>>();
  // Wpis powstaje tylko przy unieważnieniu, czyli dla istniejącego turnieju, nie przy odczycie zgadywanego id.
  const generations = new Map<string, number>();

  function prune(at: number): void {
    for (const [tournamentId, endpoints] of entries) {
      for (const [endpoint, entry] of endpoints) {
        if (entry.expiresAt <= at) {
          endpoints.delete(endpoint);
        }
      }
      if (endpoints.size === 0) {
        entries.delete(tournamentId);
      }
    }
  }

  const cache: PublicResponseCache = {
    generation(tournamentId) {
      return generations.get(tournamentId) ?? 0;
    },

    get(tournamentId, endpoint) {
      const entry = entries.get(tournamentId)?.get(endpoint);
      if (entry === undefined || entry.expiresAt <= now()) {
        return undefined;
      }
      return entry.body;
    },

    set(tournamentId, endpoint, generation, body) {
      if (generation !== cache.generation(tournamentId)) {
        return;
      }
      const at = now();
      prune(at);
      let endpoints = entries.get(tournamentId);
      if (endpoints === undefined) {
        endpoints = new Map();
        entries.set(tournamentId, endpoints);
      }
      endpoints.set(endpoint, { body, expiresAt: at + PUBLIC_CACHE_TTL_MS });
    },

    invalidate(tournamentId) {
      generations.set(tournamentId, cache.generation(tournamentId) + 1);
      entries.delete(tournamentId);
    },

    async remember<T>(tournamentId: string, endpoint: PublicEndpoint, load: () => Promise<T>): Promise<T> {
      const cached = cache.get(tournamentId, endpoint);
      if (cached !== undefined) {
        return cached as T;
      }
      const generation = cache.generation(tournamentId);
      const body = await load();
      cache.set(tournamentId, endpoint, generation, body);
      return body;
    },

    entryCount() {
      let count = 0;
      for (const endpoints of entries.values()) {
        count += endpoints.size;
      }
      return count;
    },
  };
  return cache;
}
