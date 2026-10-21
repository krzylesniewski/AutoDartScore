import type { MatchSnapshot } from '@autoscore/schema';

export interface UndoWindow {
  readonly locked: boolean;
  readonly secondsLeft: number | null; // null, gdy nic nie odliczamy
}

export const UNLOCKED: UndoWindow = { locked: false, secondsLeft: null };
export const LOCKED: UndoWindow = { locked: true, secondsLeft: null };

// >= jak na serwerze, który odrzuca cofnięcie dokładnie w chwili editableUntil.
export function undoWindow(state: Pick<MatchSnapshot, 'finished' | 'editableUntil'>, nowMs: number): UndoWindow {
  if (!state.finished || state.editableUntil === null) {
    return UNLOCKED;
  }
  const left = Date.parse(state.editableUntil) - nowMs;
  return left <= 0 ? LOCKED : { locked: false, secondsLeft: Math.ceil(left / 1000) };
}

export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
