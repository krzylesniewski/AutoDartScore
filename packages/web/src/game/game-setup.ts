import type { BestOf, CheckoutRange, MatchType, PracticeMode, StartingScore } from '@autoscore/schema';

// Stan formularza nowej gry. Gracze w kolejności wyboru.
export interface GameSetup {
  readonly type: MatchType;
  readonly playerIds: readonly string[];
  readonly startingScore: StartingScore;
  readonly bestOf: BestOf;
  readonly practiceMode: PracticeMode;
  readonly checkoutRange: CheckoutRange;
}

export const INITIAL_SETUP: GameSetup = { type: 'match', playerIds: [], startingScore: 301, bestOf: 1, practiceMode: 'free_run', checkoutRange: '2-50' };

export const PLAYER_COUNT: Record<MatchType, { readonly min: number; readonly max: number }> = {
  match: { min: 2, max: 2 },
  casual: { min: 2, max: 4 },
  practice: { min: 1, max: 1 },
};

// Przy limicie 1 wybór zastępuje poprzedni. Przy większym limicie gracz ponad limit nie jest dodawany.
export function pickPlayer(setup: GameSetup, playerId: string): GameSetup {
  const { playerIds } = setup;
  if (playerIds.includes(playerId)) {
    return { ...setup, playerIds: playerIds.filter((id) => id !== playerId) };
  }
  const { max } = PLAYER_COUNT[setup.type];
  if (max === 1) {
    return { ...setup, playerIds: [playerId] };
  }
  return playerIds.length < max ? { ...setup, playerIds: [...playerIds, playerId] } : setup;
}

// Zmiana typu przycina wybór do nowego limitu i zostawia najwcześniej wybranych.
export function changeType(setup: GameSetup, type: MatchType): GameSetup {
  return { ...setup, type, playerIds: setup.playerIds.slice(0, PLAYER_COUNT[type].max) };
}

export function createRequest(setup: GameSetup): unknown {
  const playerIds = [...setup.playerIds];
  if (setup.type === 'match') {
    return { type: setup.type, playerIds, startingScore: setup.startingScore, bestOf: setup.bestOf };
  }
  if (setup.type === 'casual') {
    return { type: setup.type, playerIds, startingScore: setup.startingScore };
  }
  // Serwer odrzuca przedział w innych trybach treningu.
  if (setup.practiceMode === 'checkouts') {
    return { type: setup.type, playerIds, practiceMode: setup.practiceMode, checkoutRange: setup.checkoutRange };
  }
  return { type: setup.type, playerIds, practiceMode: setup.practiceMode };
}
