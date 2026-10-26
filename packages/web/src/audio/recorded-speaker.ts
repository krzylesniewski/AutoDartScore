import { EVENT_CLIPS, type Announcement, type AnnouncementPart, type Speaker } from '@autoscore/audio';
import type { TextSpeaker } from './web-speech-speaker';

// Wycinek HTMLAudioElement, którego używa speaker. play() w jsdom zwraca undefined, więc wynik nie musi być obietnicą.
export interface ClipAudio {
  play(): unknown;
  pause(): void;
  load(): void;
  currentTime: number;
  preload: string;
  addEventListener(type: 'error' | 'ended', listener: () => void): void;
}

export interface RecordedSpeaker extends Speaker {
  preload(): void;
}

// Jedna część komunikatu w trakcie odtwarzania. audio jest null, gdy część od razu idzie do odczytu tekstu.
interface Playback {
  readonly parts: readonly AnnouncementPart[];
  readonly index: number;
  readonly audio: ClipAudio | null;
  readonly generation: number;
  fellBack: boolean;
  advanced: boolean;
}

function clipUrl(clip: string): string {
  return `${import.meta.env.BASE_URL}audio/pl/${clip}`;
}

function defaultFactory(): ((src: string) => ClipAudio) | null {
  return typeof Audio === 'undefined' ? null : (src) => new Audio(src);
}

// Gra części komunikatu po kolei. Następna zaczyna się po ended nagrania albo po końcu odczytu tekstu.
// Brak pliku, błąd sieci albo blokada autoodtwarzania kończą się odczytem tekstu tej części przez fallback.
export function createRecordedSpeaker(fallback: TextSpeaker, createAudio?: (src: string) => ClipAudio): RecordedSpeaker {
  const elements = new Map<string, ClipAudio>();
  let playback: Playback | null = null;
  // Rośnie przy każdym speak i cancel. Zdarzenie ze starszego pokolenia, także AbortError po naszym pause()
  // i onerror odczytu po fallback.cancel(), niczego nie czyta i nie przesuwa listy.
  let generation = 0;

  function isCurrent(attempt: Playback): boolean {
    return playback === attempt && attempt.generation === generation && !attempt.advanced;
  }

  function advance(attempt: Playback): void {
    if (!isCurrent(attempt)) {
      return;
    }
    attempt.advanced = true;
    start(attempt.parts, attempt.index + 1);
  }

  function fallBack(attempt: Playback): void {
    if (!isCurrent(attempt) || attempt.fellBack) {
      return;
    }
    attempt.fellBack = true;
    const text = attempt.parts[attempt.index]?.text ?? '';
    fallback.speak(text, () => {
      advance(attempt);
    });
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
    audio.addEventListener('ended', () => {
      // Po fallbacku listę przesuwa koniec odczytu tekstu, nie nagranie.
      if (playback?.audio === audio && !playback.fellBack) {
        advance(playback);
      }
    });
    elements.set(src, audio);
    return audio;
  }

  function start(parts: readonly AnnouncementPart[], index: number): void {
    const part = parts[index];
    if (!part) {
      playback = null;
      return;
    }
    const audio = part.clip === null ? null : element(clipUrl(part.clip));
    const attempt: Playback = { parts, index, audio, generation, fellBack: false, advanced: false };
    playback = attempt;
    if (!audio) {
      fallBack(attempt);
      return;
    }
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
  }

  function stopCurrent(): void {
    const audio = playback?.audio;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    playback = null;
  }

  return {
    speak(announcement: Announcement) {
      stopCurrent();
      generation += 1;
      start(announcement.parts, 0);
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
