import { createAnnouncer, type Announcer, type Speaker } from '@autoscore/audio';
import type { LiveMessage } from '@autoscore/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createWebAudioEffectPlayer, type WebAudioEffectPlayer } from './web-audio-effect-player';
import { createWebSpeechSpeaker } from './web-speech-speaker';

export const VOICE_STORAGE_KEY = 'autoscore.voice';
export const EFFECTS_STORAGE_KEY = 'autoscore.effects';

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

interface AudioOutput {
  readonly announcer: Announcer;
  readonly speech: Speaker;
  readonly player: WebAudioEffectPlayer;
}

// Głos i efekty są domyślnie włączone na każdym urządzeniu. Drugi ekran wyłącza je sam, a wybór zostaje w localStorage.
export function useAnnouncer(): UseAnnouncer {
  const [voiceEnabled, setVoiceState] = useState(() => readEnabled(VOICE_STORAGE_KEY));
  const [effectsEnabled, setEffectsState] = useState(() => readEnabled(EFFECTS_STORAGE_KEY));
  const voiceRef = useRef(voiceEnabled);
  const effectsRef = useRef(effectsEnabled);
  const audio = useRef<AudioOutput | null>(null);

  if (!audio.current) {
    const speech = createWebSpeechSpeaker();
    const player = createWebAudioEffectPlayer();
    // Przełączniki sprawdzamy w chwili wywołania, więc announcer powstaje raz. Wyłączone efekty zwracają 0, żeby głos nie czekał.
    const announcer = createAnnouncer(
      {
        speak(text) {
          if (voiceRef.current) {
            speech.speak(text);
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
    );
    audio.current = { announcer, speech, player };
  }

  // close() pozwala na późniejsze play(), więc podwójne montowanie w StrictMode nie psuje efektów.
  useEffect(
    () => () => {
      audio.current?.announcer.stop();
      audio.current?.player.close();
    },
    [],
  );

  // Gdy oba są wyłączone, announcer porzuca też bufor i zaplanowany odczyt.
  const stopWhenSilent = useCallback(() => {
    if (!voiceRef.current && !effectsRef.current) {
      audio.current?.announcer.stop();
    }
  }, []);

  const setVoiceEnabled = useCallback((next: boolean) => {
    writeEnabled(VOICE_STORAGE_KEY, next);
    voiceRef.current = next;
    if (!next) {
      audio.current?.speech.cancel();
      stopWhenSilent();
    }
    setVoiceState(next);
  }, [stopWhenSilent]);

  const setEffectsEnabled = useCallback((next: boolean) => {
    writeEnabled(EFFECTS_STORAGE_KEY, next);
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
