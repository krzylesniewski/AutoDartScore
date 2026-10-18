import type { MatchSummary } from '@autoscore/schema';
import { useEffect, useRef, useState } from 'react';
import { getMatchSummary } from './client';

export interface UseMatchSummary {
  readonly summary: MatchSummary | null;
  readonly error: boolean;
}

// Podsumowanie pobierane po każdej zmianie eventSeq. Odpowiedzi mogą wrócić w dowolnej kolejności,
// więc zostaje ta z najwyższym eventSeq, a po błędzie zostaje ostatnie podsumowanie.
export function useMatchSummary(matchId: string, eventSeq: number | null, enabled: boolean): UseMatchSummary {
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [error, setError] = useState(false);
  const latest = useRef<MatchSummary | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Starsze zapytanie nie jest porzucane przy nowym eventSeq: gdy nowsze się nie uda, jego wynik nadal się przyda.
  useEffect(() => {
    if (!enabled || eventSeq === null) {
      return;
    }
    getMatchSummary(matchId).then(
      (next) => {
        if (!mounted.current) {
          return;
        }
        setError(false);
        if (latest.current && next.eventSeq < latest.current.eventSeq) {
          return;
        }
        latest.current = next;
        setSummary(next);
      },
      () => {
        if (mounted.current) {
          setError(true);
        }
      },
    );
  }, [matchId, eventSeq, enabled]);

  return { summary, error };
}
