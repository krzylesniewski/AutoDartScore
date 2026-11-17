import {
  DEFAULT_TOURNAMENT_STARTING_SCORE,
  TOURNAMENT_PLAYER_LIMITS,
  TournamentLegsToWin,
  type StartingScore,
  type TournamentAdvance,
  type TournamentFormat,
} from '@autoscore/schema';
import { pl } from '../i18n/pl';

// Stan kreatora turnieju. Gracze w kolejności wyboru, a kolejność w turnieju losuje serwer.
export interface TournamentSetup {
  readonly name: string;
  readonly format: TournamentFormat;
  readonly playerIds: readonly string[];
  readonly startingScore: StartingScore;
  readonly advance: TournamentAdvance;
  readonly thirdPlaceMatch: boolean;
  readonly consolation: boolean;
  readonly legsToWin: TournamentLegsToWin;
  readonly sharing: boolean;
}

export type LegsPhase = keyof TournamentLegsToWin;

export type TournamentProblem = { kind: 'players'; min: number; max: number } | { kind: 'advance' } | { kind: 'name' };

export const MIN_LEGS = 1;
export const MAX_LEGS = 9;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

// DD.MM.YYYY w czasie lokalnym.
export function formatDay(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function defaultTournamentName(today: Date): string {
  return pl.defaultTournamentName(formatDay(today));
}

export const FORMAT_LABELS: Readonly<Record<TournamentFormat, string>> = {
  league: pl.formatLeague,
  cup: pl.formatCup,
  group_playoff: pl.formatGroupPlayoff,
};

export function initialTournamentSetup(today: Date): TournamentSetup {
  return {
    name: defaultTournamentName(today),
    format: 'group_playoff',
    playerIds: [],
    startingScore: DEFAULT_TOURNAMENT_STARTING_SCORE,
    advance: 4,
    thirdPlaceMatch: false,
    consolation: false,
    legsToWin: TournamentLegsToWin.parse({}),
    sharing: true,
  };
}

// Gracz ponad limit formatu nie jest dodawany.
export function pickTournamentPlayer(setup: TournamentSetup, playerId: string): TournamentSetup {
  const { playerIds } = setup;
  if (playerIds.includes(playerId)) {
    return { ...setup, playerIds: playerIds.filter((id) => id !== playerId) };
  }
  if (playerIds.length >= TOURNAMENT_PLAYER_LIMITS[setup.format].max) {
    return setup;
  }
  return { ...setup, playerIds: [...playerIds, playerId] };
}

// Zmiana formatu przycina wybór do nowego limitu i zostawia najwcześniej wybranych.
export function changeTournamentFormat(setup: TournamentSetup, format: TournamentFormat): TournamentSetup {
  return { ...setup, format, playerIds: setup.playerIds.slice(0, TOURNAMENT_PLAYER_LIMITS[format].max) };
}

export function stepLegs(setup: TournamentSetup, key: LegsPhase, delta: number): TournamentSetup {
  const value = Math.min(MAX_LEGS, Math.max(MIN_LEGS, setup.legsToWin[key] + delta));
  return { ...setup, legsToWin: { ...setup.legsToWin, [key]: value } };
}

// Silnik pomija mecz o 3. miejsce bez dwóch prawdziwych półfinałów, a pocieszenie przy mniej niż 2 graczach spoza play-off.
export function extrasAvailable(setup: TournamentSetup): { thirdPlace: boolean; consolation: boolean } {
  const count = setup.playerIds.length;
  if (setup.format === 'cup') {
    return { thirdPlace: count >= 4, consolation: false };
  }
  if (setup.format === 'group_playoff') {
    return { thirdPlace: setup.advance >= 4, consolation: count - setup.advance >= 2 };
  }
  return { thirdPlace: false, consolation: false };
}

function bracketPhases(size: number): readonly LegsPhase[] {
  if (size <= 2) {
    return ['final'];
  }
  if (size <= 4) {
    return ['sf', 'final'];
  }
  if (size <= 8) {
    return ['qf', 'sf', 'final'];
  }
  return ['r16', 'qf', 'sf', 'final'];
}

// Fazy, których długość pokazuje kreator, w kolejności gry.
export function legsPhases(setup: TournamentSetup): readonly LegsPhase[] {
  const phases: LegsPhase[] = [];
  if (setup.format === 'league') {
    phases.push('group');
  } else if (setup.format === 'cup') {
    phases.push(...bracketPhases(Math.min(16, Math.max(3, setup.playerIds.length))));
  } else {
    phases.push('group', ...bracketPhases(setup.advance));
  }
  const available = extrasAvailable(setup);
  if (setup.thirdPlaceMatch && available.thirdPlace) {
    phases.push('thirdPlace');
  }
  if (setup.consolation && available.consolation) {
    phases.push('consolation');
  }
  return phases;
}

// Ukryty albo niedostępny przełącznik idzie zawsze jako false, bo serwer odrzuca go w formatach bez tej fazy.
export function createTournamentRequest(setup: TournamentSetup): unknown {
  const available = extrasAvailable(setup);
  return {
    name: setup.name,
    format: setup.format,
    playerIds: [...setup.playerIds],
    startingScore: setup.startingScore,
    ...(setup.format === 'group_playoff' ? { advance: setup.advance } : {}),
    thirdPlaceMatch: setup.thirdPlaceMatch && available.thirdPlace,
    consolation: setup.consolation && available.consolation,
    legsToWin: { ...setup.legsToWin },
    sharing: setup.sharing,
  };
}

export function phaseLabel(phase: LegsPhase, format: TournamentFormat): string {
  switch (phase) {
    case 'group':
      return format === 'league' ? pl.phaseLeague : pl.phaseGroup;
    case 'r16':
      return pl.phaseR16;
    case 'qf':
      return pl.phaseQf;
    case 'sf':
      return pl.phaseSf;
    case 'final':
      return pl.phaseFinal;
    case 'thirdPlace':
      return pl.phaseThirdPlace;
    case 'consolation':
      return pl.phaseConsolation;
  }
}

// Pierwszy powód, dla którego turnieju nie da się zacząć, w kolejności pokazywanej na ekranie.
export function tournamentProblem(setup: TournamentSetup): TournamentProblem | null {
  const { min, max } = TOURNAMENT_PLAYER_LIMITS[setup.format];
  const count = setup.playerIds.length;
  if (count < min || count > max) {
    return { kind: 'players', min, max };
  }
  if (setup.format === 'group_playoff' && setup.advance > count) {
    return { kind: 'advance' };
  }
  if (setup.name.trim() === '') {
    return { kind: 'name' };
  }
  return null;
}
