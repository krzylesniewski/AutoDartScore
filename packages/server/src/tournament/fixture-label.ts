import type { TournamentFormat } from '@autoscore/schema';

type Round = 'r16' | 'qf' | 'sf';

const PLAYOFF_ROUNDS: Readonly<Record<Round, string>> = {
  r16: '1/8 finału',
  qf: 'Ćwierćfinał',
  sf: 'Półfinał',
};

const CONSOLATION_ROUNDS: Readonly<Record<Round, string>> = {
  r16: '1/8 finału',
  qf: 'ćwierćfinał',
  sf: 'półfinał',
};

const FIXED: Readonly<Record<string, string>> = {
  'p-f': 'Finał',
  'p-3rd': 'Mecz o 3. miejsce',
  'c-f': 'Pocieszenie',
};

// Id meczów nadaje silnik: g-N w grupie (N to numer meczu), p-… w drabince, c-… w pocieszeniu.
export function fixtureLabel(format: TournamentFormat, fixtureId: string): string {
  const fixed = FIXED[fixtureId];
  if (fixed !== undefined) {
    return fixed;
  }
  const group = /^g-(\d+)$/.exec(fixtureId);
  if (group) {
    return `${format === 'league' ? 'Liga' : 'Grupa'}, mecz ${group[1] ?? ''}`;
  }
  const bracket = /^([pc])-(r16|qf|sf)-(\d+)$/.exec(fixtureId);
  if (!bracket) {
    return fixtureId;
  }
  const [, prefix, round, number = ''] = bracket;
  return prefix === 'p' ? `${PLAYOFF_ROUNDS[round as Round]} ${number}` : `Pocieszenie, ${CONSOLATION_ROUNDS[round as Round]} ${number}`;
}
