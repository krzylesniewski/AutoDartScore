import type { Achievement } from '@autoscore/schema';
import { pl } from '../i18n/pl';

const FIRST_TURN_THRESHOLDS = { first_100: 100, first_120: 120, first_140: 140 } as const;

export function achievementText(achievement: Achievement): string {
  const { kind, value, previous } = achievement;
  switch (kind) {
    case 'turn_record':
      return pl.achievementTurnRecord(value, previous);
    case 'checkout_record':
      return pl.achievementCheckoutRecord(value, previous);
    case 'shortest_leg':
      return pl.achievementShortestLeg(value, previous);
    case 'longest_leg':
      return pl.achievementLongestLeg(value, previous);
    case 'first_180':
      return pl.achievementFirst180;
    case 'first_100':
    case 'first_120':
    case 'first_140':
      return pl.achievementFirstTurn(FIRST_TURN_THRESHOLDS[kind], value);
  }
}
