export interface LoginLimiter {
  retryAfterMs(): number | null;
  recordFailure(): void;
}

const WINDOW_MS = 60_000;
const MAX_FAILURES = 10;

// Jeden licznik na cały serwer, w pamięci. Restart go zeruje.
export function createLoginLimiter(now: () => number): LoginLimiter {
  let failures: number[] = [];

  function prune(at: number): void {
    failures = failures.filter((failedAt) => at - failedAt < WINDOW_MS);
  }

  return {
    retryAfterMs() {
      const at = now();
      prune(at);
      const oldest = failures[0];
      if (failures.length < MAX_FAILURES || oldest === undefined) {
        return null;
      }
      return oldest + WINDOW_MS - at;
    },

    recordFailure() {
      const at = now();
      prune(at);
      failures.push(at);
    },
  };
}
