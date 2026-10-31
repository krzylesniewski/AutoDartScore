import { measureChange, MIN_EVENT_CHANGE } from './baseline-detector.js';
import type { Frame } from './frame.js';

// Wyjmowanie lotek trwa dłużej niż wbicie jednej, tylko po tym je odróżniamy.
export const DEFAULT_REMOVAL_MS = 1500;

export type WatchEvent =
  | { readonly kind: 'settled'; readonly before: Frame; readonly after: Frame; readonly motionMs: number }
  | { readonly kind: 'removal'; readonly motionMs: number };

export interface DartWatcherOptions {
  readonly removalMs?: number;
  readonly isStill?: (a: Frame, b: Frame) => boolean;
}

export interface DartWatcher {
  push(frame: Frame): WatchEvent | null;
}

function isStillByChange(a: Frame, b: Frame): boolean {
  return measureChange(a, b).changedFraction < MIN_EVENT_CHANGE;
}

// Czas liczymy tylko ze znaczników klatek, więc nagranie daje ten sam wynik co kamera, choć leci szybciej.
export function createDartWatcher({ removalMs = DEFAULT_REMOVAL_MS, isStill = isStillByChange }: DartWatcherOptions = {}): DartWatcher {
  let reference: Frame | null = null;
  let previous: Frame | null = null;
  let motionStart: number | null = null;

  return {
    push(frame) {
      const last = previous;
      previous = frame;
      if (last === null || reference === null) {
        reference = frame;
        return null;
      }
      if (!isStill(last, frame)) {
        motionStart ??= frame.timestamp;
        return null;
      }
      if (motionStart === null) {
        // Spokojna klatka zostaje nowym odniesieniem, co pochłania powolne zmiany światła.
        reference = frame;
        return null;
      }
      const motionMs = frame.timestamp - motionStart;
      const before = reference;
      motionStart = null;
      reference = frame;
      return motionMs >= removalMs ? { kind: 'removal', motionMs } : { kind: 'settled', before, after: frame, motionMs };
    },
  };
}
