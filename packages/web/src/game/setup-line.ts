import type { GameSetup } from './game-setup';
import { pl } from '../i18n/pl';

// Jedna linia z danymi z podsumowania, do paska ze Startem.
export function setupLine(setup: GameSetup): string {
  if (setup.type === 'practice') {
    return practiceParts(setup).join(' · ');
  }
  const format = setup.type === 'match' ? pl.bestOfOption(setup.bestOf) : pl.casualFormat;
  return [String(setup.startingScore), format, pl.rulesX01, pl.startsByDraw].join(' · ');
}

function practiceParts(setup: GameSetup): string[] {
  switch (setup.practiceMode) {
    case 'solo_501':
      return [pl.solo501, pl.rulesX01];
    case 'checkouts':
      return [pl.checkoutPractice, setup.checkoutRange, pl.rulesCheckouts];
    case 'free_run':
      return [pl.freeRun, pl.rulesFreeRun];
  }
}
