const WINDOW_MS = 60_000;

// Wiele telefonów za jednym NAT-em w lokalu, każdy odpytuje co 10 s, mieści się z zapasem.
export const PUBLIC_REQUESTS_PER_MINUTE = 300;

export interface PublicRateLimiter {
  // Liczy żądanie klienta. null, gdy przechodzi, inaczej ile ms zostało do końca okna klienta.
  take(client: string): number | null;
  clientCount(): number;
}

// Stałe okno na klienta, bez limitu globalnego, żeby jeden klient nie zablokował linku wszystkim. Stan jest w pamięci.
export function createPublicRateLimiter(now: () => number): PublicRateLimiter {
  const windows = new Map<string, { readonly start: number; count: number }>();

  // Nowe okno trafia na koniec mapy, więc wygasłe okna są na jej początku i czyszczenie kończy się na pierwszym aktualnym.
  function prune(at: number): void {
    for (const [client, window] of windows) {
      if (at - window.start < WINDOW_MS) {
        return;
      }
      windows.delete(client);
    }
  }

  return {
    take(client) {
      const at = now();
      prune(at);
      const window = windows.get(client);
      if (window === undefined) {
        windows.set(client, { start: at, count: 1 });
        return null;
      }
      if (window.count >= PUBLIC_REQUESTS_PER_MINUTE) {
        return window.start + WINDOW_MS - at;
      }
      window.count += 1;
      return null;
    },

    clientCount() {
      return windows.size;
    },
  };
}
