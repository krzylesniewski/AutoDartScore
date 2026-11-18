import type { TournamentStats, TournamentView } from '@autoscore/schema';
import { useEffect, useRef, useState } from 'react';
import { getTournamentStats } from './client';

export interface TournamentStatsState {
  readonly status: 'loading' | 'ready' | 'error';
  readonly stats: TournamentStats | null;
}

interface Fetched {
  readonly stats: TournamentStats | null;
  readonly failed: boolean;
}

// Nowy widok przychodzi po każdej zmianie legów, więc każdy nowy obiekt widoku pobiera statystyki jeszcze raz.
// Liczy się tylko ostatnia runda, a ostatnie statystyki zostają na ekranie także po błędzie.
export function useTournamentStats(view: TournamentView): TournamentStatsState {
  const [fetched, setFetched] = useState<Fetched>({ stats: null, failed: false });
  const round = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    round.current += 1;
    const current = round.current;
    const latest = () => mounted.current && current === round.current;
    getTournamentStats(view.id).then(
      (stats) => {
        if (latest()) {
          setFetched({ stats, failed: false });
        }
      },
      () => {
        if (latest()) {
          setFetched((previous) => ({ stats: previous.stats, failed: true }));
        }
      },
    );
  }, [view]);

  if (fetched.failed) {
    return { status: 'error', stats: fetched.stats };
  }
  return { status: fetched.stats === null ? 'loading' : 'ready', stats: fetched.stats };
}
