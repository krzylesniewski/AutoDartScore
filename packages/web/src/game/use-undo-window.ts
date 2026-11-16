import type { MatchSnapshot } from '@autoscore/schema';
import { useCallback, useSyncExternalStore } from 'react';
import { UNLOCKED, undoWindow, type UndoWindow } from './undo-window';
import { currentSecond } from './use-now';

// Zegar urządzenia służy tylko do odliczania na ekranie. O blokadzie decyduje serwer.
export function useUndoWindow(state: MatchSnapshot | null): UndoWindow {
  const finished = state?.finished ?? false;
  const editableUntil = state?.editableUntil ?? null;

  // Odliczanie sprawdza ten sam zaokrąglony zegar co render, więc interwał kończy się dopiero po pokazaniu blokady.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const counting = () => undoWindow({ finished, editableUntil }, currentSecond()).secondsLeft !== null;
      if (!counting()) {
        return () => {};
      }
      const id = window.setInterval(() => {
        onChange();
        if (!counting()) {
          window.clearInterval(id);
        }
      }, 1000);
      return () => window.clearInterval(id);
    },
    [finished, editableUntil],
  );

  const now = useSyncExternalStore(subscribe, currentSecond);
  return state ? undoWindow(state, now) : UNLOCKED;
}
