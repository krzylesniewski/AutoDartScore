import { useEffect, useState } from 'react';

// Czas z zegara urządzenia, odświeżany co sekundę tylko wtedy, gdy ticking jest włączone.
export function useNow(ticking: boolean): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!ticking) {
      return;
    }
    const id = window.setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  return Date.now();
}
