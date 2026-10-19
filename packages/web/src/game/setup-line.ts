import type { GameSetup } from './game-setup';
import { pl } from '../i18n/pl';

// Jedna linia z danymi z podsumowania, do paska ze Startem.
export function setupLine(setup: GameSetup): string {
  if (setup.type === 'practice') {
    const parts = setup.practiceMode === 'solo_501' ? [pl.solo501, pl.rulesX01] : [pl.freeRun, pl.rulesFreeRun];
    return parts.join(' · ');
  }
  const format = setup.type === 'match' ? pl.bestOfOption(setup.bestOf) : pl.casualFormat;
  return [String(setup.startingScore), format, pl.rulesX01, pl.startsByDraw].join(' · ');
}
