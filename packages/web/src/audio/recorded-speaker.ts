import { EVENT_CLIPS, type Announcement, type Speaker } from '@autoscore/audio';
import type { TextSpeaker } from './web-speech-speaker';

// Wycinek HTMLAudioElement, którego używa speaker. play() w jsdom zwraca undefined, więc wynik nie musi być obietnicą.
export interface ClipAudio {
  play(): unknown;
  pause(): void;
  load(): void;
  currentTime: number;
  preload: string;
  addEventListener(type: 'error', listener: () => void): void;
}

export interface RecordedSpeaker extends Speaker {
  preload(): void;
}

interface Playback {
  readonly audio: ClipAudio;
  readonly text: string;
  readonly generation: number;
  fellBack: boolean;
}

function clipUrl(clip: string): string {
  return `${import.meta.env.BASE_URL}audio/pl/${clip}`;
}

function defaultFactory(): ((src: string) => ClipAudio) | null {
  return typeof Audio === 'undefined' ? null : (src) => new Audio(src);
}

// Gra nagranie komunikatu. Brak pliku, błąd sieci albo blokada autoodtwarzania kończą się odczytem tekstu przez fallback.
export function createRecordedSpeaker(fallback: TextSpeaker, createAudio?: (src: string) => ClipAudio): RecordedSpeaker {
  const elements = new Map<string, ClipAudio>();
  let playback: Playback | null = null;
  // Rośnie przy każdym speak i cancel. Błąd ze starszego pokolenia, także AbortError po naszym pause(), nic nie czyta.
  let generation = 0;

  function fallBack(attempt: Playback): void {
    if (attempt.generation !== generation || attempt.fellBack) {
      return;
    }
    attempt.fellBack = true;
    fallback.speak(attempt.text);
  }

  function element(src: string): ClipAudio | null {
    const existing = elements.get(src);
    if (existing) {
      return existing;
    }
    const create = createAudio ?? defaultFactory();
    if (!create) {
      return null;
    }
    const audio = create(src);
    audio.addEventListener('error', () => {
      // Następne użycie tworzy element od nowa, więc plik, który wrócił, znowu zagra.
      if (elements.get(src) === audio) {
        elements.delete(src);
      }
      if (playback?.audio === audio) {
        fallBack(playback);
      }
    });
    elements.set(src, audio);
    return audio;
  }

  function stopCurrent(): void {
    if (playback) {
      playback.audio.pause();
      playback.audio.currentTime = 0;
      playback = null;
    }
  }

  return {
    speak(announcement: Announcement) {
      stopCurrent();
      generation += 1;
      const audio = announcement.clip === null ? null : element(clipUrl(announcement.clip));
      if (!audio) {
        fallback.speak(announcement.text);
        return;
      }
      const attempt: Playback = { audio, text: announcement.text, generation, fellBack: false };
      playback = attempt;
      let result: unknown;
      try {
        result = audio.play();
      } catch {
        fallBack(attempt);
        return;
      }
      if (!(result instanceof Promise)) {
        fallBack(attempt);
        return;
      }
      result.catch(() => {
        fallBack(attempt);
      });
    },
    cancel() {
      stopCurrent();
      generation += 1;
      fallback.cancel();
    },
    preload() {
      for (const clip of EVENT_CLIPS) {
        const src = clipUrl(clip);
        if (elements.has(src)) {
          continue;
        }
        const audio = element(src);
        if (!audio) {
          return;
        }
        audio.preload = 'auto';
        audio.load();
      }
    },
  };
}
