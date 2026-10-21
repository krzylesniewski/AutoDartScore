import type { MatchSnapshot } from '@autoscore/schema';

type LegTimes = Pick<MatchSnapshot, 'status' | 'abandonment' | 'endedAt' | 'finishedAt' | 'legStartedAt' | 'legPausedMs'>;

// Porzucona gra, zakończony trening i zakończona gra stoją w miejscu, więc zegar urządzenia liczy się tylko w trwającej grze.
function legEnd(state: LegTimes, nowMs: number): number {
  if (state.status === 'abandoned' && state.abandonment) {
    return Date.parse(state.abandonment.at);
  }
  if (state.status === 'ended' && state.endedAt !== null) {
    return Date.parse(state.endedAt);
  }
  if (state.finishedAt !== null) {
    return Date.parse(state.finishedAt);
  }
  return nowMs;
}

// Zero zamiast ujemnej wartości, gdy zegar urządzenia spóźnia się względem serwera.
export function legElapsedMs(state: LegTimes, nowMs: number): number {
  if (state.legStartedAt === null) {
    return 0;
  }
  return Math.max(0, legEnd(state, nowMs) - Date.parse(state.legStartedAt) - state.legPausedMs);
}

export function gameElapsedMs(state: Pick<MatchSnapshot, 'startedAt' | 'finishedAt' | 'pausedMs'>): number | null {
  if (state.startedAt === null || state.finishedAt === null) {
    return null;
  }
  return Date.parse(state.finishedAt) - Date.parse(state.startedAt) - state.pausedMs;
}

export function durationSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

function parts(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
  return { hours: Math.floor(totalSeconds / 3600), minutes: Math.floor((totalSeconds % 3600) / 60), seconds: totalSeconds % 60 };
}

export function formatDuration(totalSeconds: number): string {
  const { hours, minutes, seconds } = parts(totalSeconds);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}` : `${minutes}:${ss}`;
}

export function spokenDuration(totalSeconds: number): string {
  const { hours, minutes, seconds } = parts(totalSeconds);
  const text = `${minutes} min ${seconds} s`;
  return hours > 0 ? `${hours} godz. ${text}` : text;
}
