import type { MatchLegs } from '@autoscore/schema';
import { useEffect, useRef, useState } from 'react';
import { getMatchLegs } from './client';

export interface UseMatchLegs {
  readonly legs: MatchLegs | null;
  readonly error: boolean;
}

// Historia legów pobierana po każdym nowym eventSeq, jak podsumowanie meczu. Odpowiedzi mogą wrócić w dowolnej kolejności,
// więc zostaje ta z najwyższym eventSeq, a po błędzie zostają ostatnie dane.
export function useMatchLegs(matchId: string, eventSeq: number | null): UseMatchLegs {
  const [legs, setLegs] = useState<MatchLegs | null>(null);
  const [error, setError] = useState(false);
  const latest = useRef<MatchLegs | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Starsze zapytanie nie jest porzucane przy nowym eventSeq: gdy nowsze się nie uda, jego wynik nadal się przyda.
  useEffect(() => {
    if (eventSeq === null) {
      return;
    }
    getMatchLegs(matchId).then(
      (next) => {
        if (!mounted.current) {
          return;
        }
        setError(false);
        if (latest.current && next.eventSeq < latest.current.eventSeq) {
          return;
        }
        latest.current = next;
        setLegs(next);
      },
      () => {
        if (mounted.current) {
          setError(true);
        }
      },
    );
  }, [matchId, eventSeq]);

  return { legs, error };
}
