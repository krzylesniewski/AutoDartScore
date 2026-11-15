export interface LoginLimiter {
  retryAfterMs(client: string): number | null;
  recordFailure(client: string): void;
}

const WINDOW_MS = 60_000;
export const MAX_FAILURES_PER_CLIENT = 10;
export const MAX_FAILURES_GLOBAL = 100;

// Limit na klienta sprawia, że jedno urządzenie nie zablokuje logowania wszystkim.
// Limit globalny zatrzymuje zgadywanie z wielu adresów naraz. Stan jest w pamięci, restart go zeruje.
export function createLoginLimiter(now: () => number): LoginLimiter {
  let global: number[] = [];
  const perClient = new Map<string, number[]>();

  function recent(failures: readonly number[], at: number): number[] {
    return failures.filter((failedAt) => at - failedAt < WINDOW_MS);
  }

  // Czyścimy wszystkie listy, nie tylko listę wołającego, żeby mapa nie trzymała adresów, które już nie wracają.
  function prune(at: number): void {
    global = recent(global, at);
    for (const [client, failures] of perClient) {
      const kept = recent(failures, at);
      if (kept.length === 0) {
        perClient.delete(client);
      } else {
        perClient.set(client, kept);
      }
    }
  }

  function waitMs(failures: readonly number[], max: number, at: number): number | null {
    const oldest = failures[0];
    if (failures.length < max || oldest === undefined) {
      return null;
    }
    return oldest + WINDOW_MS - at;
  }

  return {
    retryAfterMs(client) {
      const at = now();
      prune(at);
      const waits = [waitMs(perClient.get(client) ?? [], MAX_FAILURES_PER_CLIENT, at), waitMs(global, MAX_FAILURES_GLOBAL, at)].filter(
        (ms) => ms !== null,
      );
      return waits.length === 0 ? null : Math.max(...waits);
    },

    recordFailure(client) {
      const at = now();
      prune(at);
      global.push(at);
      const failures = perClient.get(client);
      if (failures === undefined) {
        perClient.set(client, [at]);
      } else {
        failures.push(at);
      }
    },
  };
}
