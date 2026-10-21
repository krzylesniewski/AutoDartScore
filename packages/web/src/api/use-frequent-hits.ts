import type { FrequentHit } from '@autoscore/schema';
import { useEffect, useState } from 'react';
import { getFrequentHits } from './client';

interface Loaded {
  readonly playerId: string;
  readonly hits: readonly FrequentHit[];
}

// Najczęstsze trafienia rzucającego, pobierane przy każdej zmianie gracza. null w trakcie ładowania i po błędzie.
// Lista jest zwracana tylko dla gracza, dla którego przyszła, więc nie pojawia się pod imieniem następnego.
export function useFrequentHits(playerId: string | null): readonly FrequentHit[] | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    setLoaded(null);
    if (playerId === null) {
      return;
    }
    let cancelled = false;
    getFrequentHits(playerId).then(
      (response) => {
        if (!cancelled) {
          setLoaded({ playerId, hits: response.hits });
        }
      },
      // Po błędzie rząd zostaje pusty, a klawiatura działa bez niego.
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  return loaded !== null && loaded.playerId === playerId ? loaded.hits : null;
}
