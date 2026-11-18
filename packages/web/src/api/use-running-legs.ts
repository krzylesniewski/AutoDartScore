import type { Fixture, MatchSnapshot, TournamentView } from '@autoscore/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getMatch } from './client';

export interface RunningLegs {
  readonly legs: readonly [number, number]; // wygrane legi w kolejności slotów
  readonly legNumber: number; // bieżący leg od 1
}

function runningFixtures(view: TournamentView): Fixture[] {
  return view.fixtures.filter((fixture) => fixture.status === 'in_progress' && fixture.matchId !== null);
}

function runningLegs(fixture: Fixture, match: MatchSnapshot): RunningLegs {
  const [first, second] = fixture.slots.map((slot) =>
    slot.kind === 'player' ? (match.players.find((player) => player.id === slot.playerId)?.legsWon ?? 0) : 0,
  ) as [number, number];
  return { legs: [first, second], legNumber: match.legIndex + 1 };
}

// Widok turnieju nie ma legów trwającego meczu, a nowy widok przychodzi po każdej zmianie legów.
// Dlatego każdy nowy obiekt widoku pobiera trwające mecze jeszcze raz, a liczy się tylko ostatnia runda zapytań.
export function useRunningLegs(view: TournamentView): ReadonlyMap<string, RunningLegs> {
  const [fetched, setFetched] = useState<ReadonlyMap<string, RunningLegs>>(() => new Map());
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
    const running = runningFixtures(view);
    if (running.length === 0) {
      return;
    }
    void Promise.all(
      running.map((fixture) =>
        getMatch(fixture.matchId ?? '').then(
          (match): [string, RunningLegs] => [fixture.id, runningLegs(fixture, match)],
          () => null,
        ),
      ),
    ).then((entries) => {
      if (!mounted.current || current !== round.current) {
        return;
      }
      setFetched(new Map(entries.filter((entry) => entry !== null)));
    });
  }, [view]);

  // Zakończony mecz nie może pokazać legów z poprzedniej odpowiedzi.
  return useMemo(() => {
    const running = new Set(runningFixtures(view).map((fixture) => fixture.id));
    return new Map([...fetched].filter(([fixtureId]) => running.has(fixtureId)));
  }, [fetched, view]);
}
