import type { MatchType } from '@autoscore/schema';

// Turniej nie jest typem meczu, więc kreator wybiera spośród typów meczu i turnieju.
export type GameKind = MatchType | 'tournament';
