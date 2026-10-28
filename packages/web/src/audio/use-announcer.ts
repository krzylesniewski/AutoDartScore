import { createAnnouncer, type Announcer } from '@autoscore/audio';
import type { LiveMessage } from '@autoscore/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRecordedSpeaker, type RecordedSpeaker } from './recorded-speaker';
import { createWebAudioEffectPlayer, type WebAudioEffectPlayer } from './web-audio-effect-player';
import { createWebSpeechSpeaker } from './web-speech-speaker';

export const VOICE_STORAGE_KEY = 'autoscore.voice';
export const EFFECTS_STORAGE_KEY = 'autoscore.effects';
export const ZERO_COMMENTS_STORAGE_KEY = 'autoscore.zeroComments';

export interface UseAnnouncer {
  readonly voiceEnabled: boolean;
  setVoiceEnabled(next: boolean): void;
  readonly effectsEnabled: boolean;
  setEffectsEnabled(next: boolean): void;
  onLiveMessage(message: LiveMessage): void;
}

// Brak wpisu albo niedostępny localStorage oznacza włączone.
function readEnabled(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
}

function writeEnabled(key: string, enabled: boolean): void {
  try {
    localStorage.setItem(key, enabled ? 'on' : 'off');
  } catch {
    // Ustawienie zostaje tylko do przeładowania strony.
  }
}

export function readVoiceEnabled(): boolean {
  return readEnabled(VOICE_STORAGE_KEY);
}

export function readEffectsEnabled(): boolean {
  return readEnabled(EFFECTS_STORAGE_KEY);
}

export function writeVoiceEnabled(enabled: boolean): void {
  writeEnabled(VOICE_STORAGE_KEY, enabled);
}

export function writeEffectsEnabled(enabled: boolean): void {
  writeEnabled(EFFECTS_STORAGE_KEY, enabled);
}

// Komentarze do zera są domyślnie wyłączone, więc tylko zapisane 'on' je włącza.
export function readZeroCommentsEnabled(): boolean {
  try {
    return localStorage.getItem(ZERO_COMMENTS_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeZeroCommentsEnabled(enabled: boolean): void {
  writeEnabled(ZERO_COMMENTS_STORAGE_KEY, enabled);
}

interface AudioOutput {
  readonly announcer: Announcer;
  readonly speech: RecordedSpeaker;
  readonly player: WebAudioEffectPlayer;
}

// Głos i efekty są domyślnie włączone na każdym urządzeniu. Drugi ekran wyłącza je sam, a wybór zostaje w localStorage.
export function useAnnouncer(): UseAnnouncer {
  const [voiceEnabled, setVoiceState] = useState(readVoiceEnabled);
  const [effectsEnabled, setEffectsState] = useState(readEffectsEnabled);
  const voiceRef = useRef(voiceEnabled);
  const effectsRef = useRef(effectsEnabled);
  const audio = useRef<AudioOutput | null>(null);

  if (!audio.current) {
    const speech = createRecordedSpeaker(createWebSpeechSpeaker());
    const player = createWebAudioEffectPlayer();
    // Przełączniki sprawdzamy w chwili wywołania, więc announcer powstaje raz. Wyłączone efekty zwracają 0, żeby głos nie czekał.
    // Komentarze do zera zmienia się tylko w Ustawieniach, więc czytamy je z localStorage przy każdym komunikacie.
    const announcer = createAnnouncer(
      {
        speak(announcement) {
          if (voiceRef.current) {
            speech.speak(announcement);
          }
        },
        cancel() {
          speech.cancel();
        },
      },
      {
        play(effect) {
          return effectsRef.current ? player.play(effect) : 0;
        },
        stop() {
          player.stop();
        },
      },
      Math.random,
      { zeroComments: readZeroCommentsEnabled },
    );
    audio.current = { announcer, speech, player };
  }

  // Nagrania zdarzeń ładujemy niezależnie od przełączników, bo głos można włączyć w trakcie gry.
  // close() pozwala na późniejsze play(), więc podwójne montowanie w StrictMode nie psuje efektów.
  useEffect(() => {
    audio.current?.speech.preload();
    return () => {
      audio.current?.announcer.stop();
      audio.current?.player.close();
    };
  }, []);

  // Gdy oba są wyłączone, announcer porzuca też bufor i zaplanowany odczyt.
  const stopWhenSilent = useCallback(() => {
    if (!voiceRef.current && !effectsRef.current) {
      audio.current?.announcer.stop();
    }
  }, []);

  const setVoiceEnabled = useCallback((next: boolean) => {
    writeVoiceEnabled(next);
    voiceRef.current = next;
    if (!next) {
      audio.current?.speech.cancel();
      stopWhenSilent();
    }
    setVoiceState(next);
  }, [stopWhenSilent]);

  const setEffectsEnabled = useCallback((next: boolean) => {
    writeEffectsEnabled(next);
    effectsRef.current = next;
    if (!next) {
      audio.current?.player.stop();
      stopWhenSilent();
    }
    setEffectsState(next);
  }, [stopWhenSilent]);

  const onLiveMessage = useCallback((message: LiveMessage) => {
    if (voiceRef.current || effectsRef.current) {
      audio.current?.announcer.handle(message);
    }
  }, []);

  return { voiceEnabled, setVoiceEnabled, effectsEnabled, setEffectsEnabled, onLiveMessage };
}
