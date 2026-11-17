import { computeTournament } from '@autoscore/engine';
import type { BracketRound, Fixture, TournamentConfig } from '@autoscore/schema';
import { pl } from '../i18n/pl';

export interface TournamentPlanRow {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface TournamentPlan {
  readonly rows: readonly TournamentPlanRow[];
  readonly total: number;
}

const BRACKET_ROUNDS: readonly { round: BracketRound; label: string }[] = [
  { round: 'r16', label: pl.phaseR16 },
  { round: 'qf', label: pl.phaseQf },
  { round: 'sf', label: pl.phaseSf },
  { round: 'final', label: pl.phaseFinal },
];

// Liczy mecze tym samym silnikiem co serwer, więc wolne losy i pominięte mecze dodatkowe zgadzają się z turniejem.
// Przyjmuje tylko konfigurację, która przeszła CreateTournamentRequest, bo silnik rzuca błąd przy złej.
export function tournamentPlan(config: TournamentConfig): TournamentPlan {
  const { fixtures } = computeTournament({ config, order: config.playerIds, matches: [] });
  const matches = fixtures.filter((fixture) => fixture.status !== 'bye');
  const count = (test: (fixture: Fixture) => boolean): number => matches.filter(test).length;

  const rows: TournamentPlanRow[] = [
    { key: 'group', label: config.format === 'league' ? pl.planLeague : pl.planGroup, count: count((f) => f.phase === 'group') },
    ...BRACKET_ROUNDS.map(({ round, label }) => ({
      key: round,
      label,
      count: count((f) => f.phase === 'playoff' && f.bracketRound === round),
    })),
    { key: 'third_place', label: pl.phaseThirdPlace, count: count((f) => f.phase === 'third_place') },
    { key: 'consolation', label: pl.phaseConsolation, count: count((f) => f.phase === 'consolation') },
  ];
  return { rows: rows.filter((row) => row.count > 0), total: matches.length };
}
