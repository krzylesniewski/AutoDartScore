import { useCallback, useSyncExternalStore } from 'react';

// Pełna sekunda, bo React porównuje kolejne odczyty migawki i oczekuje tej samej wartości.
export function currentSecond(): number {
  return Math.floor(Date.now() / 1000) * 1000;
}

// Czas z zegara urządzenia, odświeżany co sekundę tylko wtedy, gdy ticking jest włączone.
export function useNow(ticking: boolean): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!ticking) {
        return () => {};
      }
      const id = window.setInterval(onChange, 1000);
      return () => window.clearInterval(id);
    },
    [ticking],
  );

  return useSyncExternalStore(subscribe, currentSecond);
}
