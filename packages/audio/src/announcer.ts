import type { DomainEvent, LiveMessage } from '@autoscore/schema';
import { announcementFor } from './announcement.js';
import { soundEffectFor, type SoundEffect } from './sound-effect.js';

export interface Speaker {
  speak(text: string): void;
  cancel(): void;
}

// play zwraca, ile ms głos ma czekać na koniec efektu. Odtwarzacz, który nic nie gra, zwraca 0.
export interface EffectPlayer {
  play(effect: SoundEffect): number;
  stop(): void;
}

export interface Announcer {
  handle(message: LiveMessage): void;
  stop(): void;
}

// Serwer wysyła jedną paczkę na rzutkę: throw_registered, zdarzenia domenowe i state_updated z tym samym eventSeq.
// Czytamy dopiero po state_updated, żeby cała paczka dała jeden komunikat. Snapshot po połączeniu ma inny eventSeq
// niż bufor i nigdy nie jest czytany.
export function createAnnouncer(speaker: Speaker, effects?: EffectPlayer): Announcer {
  let buffer: DomainEvent[] = [];
  let bufferSeq: number | null = null;
  let speechTimer: ReturnType<typeof setTimeout> | undefined;

  function clear(): void {
    buffer = [];
    bufferSeq = null;
  }

  function add(eventSeq: number, event: DomainEvent): void {
    if (bufferSeq !== eventSeq) {
      buffer = [];
      bufferSeq = eventSeq;
    }
    buffer.push(event);
  }

  function silence(): void {
    clearTimeout(speechTimer);
    speechTimer = undefined;
    effects?.stop();
    speaker.cancel();
  }

  function flush(eventSeq: number): void {
    const events = bufferSeq === eventSeq ? buffer : [];
    clear();
    const effect = soundEffectFor(events);
    const announcement = announcementFor(events);
    if (!effect && !announcement) {
      return;
    }
    // Nowy komunikat przerywa poprzedni, więc bust i zwycięzca nie czekają w kolejce.
    silence();
    const delay = effect && effects ? effects.play(effect) : 0;
    if (!announcement) {
      return;
    }
    if (delay === 0) {
      speaker.speak(announcement.text);
      return;
    }
    // Głos czeka na koniec efektu, żeby się nie nakładały.
    speechTimer = setTimeout(() => {
      speechTimer = undefined;
      speaker.speak(announcement.text);
    }, delay);
  }

  return {
    handle(message) {
      switch (message.type) {
        case 'state_updated':
          flush(message.eventSeq);
          break;
        case 'throw_undone':
          clear();
          silence();
          break;
        case 'throw_registered':
          break;
        default:
          add(message.eventSeq, message);
          break;
      }
    },
    stop() {
      clear();
      silence();
    },
  };
}
