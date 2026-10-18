import { createAnnouncer, type Announcer } from '@autoscore/audio';
import type { LiveMessage } from '@autoscore/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createWebSpeechSpeaker } from './web-speech-speaker';

export const VOICE_STORAGE_KEY = 'autoscore.voice';

export interface UseAnnouncer {
  readonly enabled: boolean;
  setEnabled(next: boolean): void;
  onLiveMessage(message: LiveMessage): void;
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(VOICE_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(VOICE_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Ustawienie zostaje tylko do przeładowania strony.
  }
}

// Wynik czyta tylko jedno urządzenie, więc głos jest domyślnie wyłączony i każde urządzenie włącza go samo.
// Kliknięcie przełącznika jest też gestem, którego przeglądarka wymaga przed pierwszym odczytem.
export function useAnnouncer(): UseAnnouncer {
  const [enabled, setEnabledState] = useState(readEnabled);
  const announcer = useRef<Announcer | null>(null);
  announcer.current ??= createAnnouncer(createWebSpeechSpeaker());
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      announcer.current?.stop();
    }
  }, [enabled]);

  // stop() nie kończy pracy announcera, więc podwójne montowanie w StrictMode go nie psuje.
  useEffect(() => () => announcer.current?.stop(), []);

  const setEnabled = useCallback((next: boolean) => {
    writeEnabled(next);
    setEnabledState(next);
  }, []);

  const onLiveMessage = useCallback((message: LiveMessage) => {
    if (enabledRef.current) {
      announcer.current?.handle(message);
    }
  }, []);

  return { enabled, setEnabled, onLiveMessage };
}
