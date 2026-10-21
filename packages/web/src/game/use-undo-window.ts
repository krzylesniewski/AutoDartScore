import type { MatchSnapshot } from '@autoscore/schema';
import { useEffect, useState } from 'react';
import { UNLOCKED, undoWindow, type UndoWindow } from './undo-window';

// Zegar urządzenia służy tylko do odliczania na ekranie. O blokadzie decyduje serwer.
export function useUndoWindow(state: MatchSnapshot | null): UndoWindow {
  const [, setTick] = useState(0);
  const current = state ? undoWindow(state, Date.now()) : UNLOCKED;
  const counting = current.secondsLeft !== null;

  useEffect(() => {
    if (!counting) {
      return;
    }
    const id = window.setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(id);
  }, [counting]);

  return current;
}
