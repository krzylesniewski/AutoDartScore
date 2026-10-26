import type { AchievementKind, DomainEvent, LiveMessage } from '@autoscore/schema';
import { announcementFor, type Announcement } from './announcement.js';
import { soundEffectFor, type SoundEffect } from './sound-effect.js';

// Speaker sam wybiera między nagraniem a odczytem tekstu.
export interface Speaker {
  speak(announcement: Announcement): void;
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

// Serwer wysyła jedną paczkę na rzutkę: throw_registered, zdarzenia domenowe, osiągnięcia i state_updated z tym samym eventSeq.
// Czytamy dopiero po state_updated, żeby cała paczka dała jeden komunikat. Snapshot po połączeniu ma inny eventSeq
// niż bufor i nigdy nie jest czytany.
export function createAnnouncer(speaker: Speaker, effects?: EffectPlayer, random: () => number = Math.random): Announcer {
  let buffer: DomainEvent[] = [];
  let achievements: AchievementKind[] = [];
  let bufferSeq: number | null = null;
  let speechTimer: ReturnType<typeof setTimeout> | undefined;

  function clear(): void {
    buffer = [];
    achievements = [];
    bufferSeq = null;
  }

  function startBatch(eventSeq: number): void {
    if (bufferSeq !== eventSeq) {
      clear();
      bufferSeq = eventSeq;
    }
  }

  function add(eventSeq: number, event: DomainEvent): void {
    startBatch(eventSeq);
    buffer.push(event);
  }

  function addAchievement(eventSeq: number, kind: AchievementKind): void {
    startBatch(eventSeq);
    achievements.push(kind);
  }

  function silence(): void {
    clearTimeout(speechTimer);
    speechTimer = undefined;
    effects?.stop();
    speaker.cancel();
  }

  function flush(eventSeq: number): void {
    const current = bufferSeq === eventSeq;
    const events = current ? buffer : [];
    const kinds = current ? achievements : [];
    clear();
    const effect = soundEffectFor(events);
    const announcement = announcementFor(events, kinds, random);
    if (!effect && !announcement) {
      return;
    }
    // Nowy komunikat przerywa cały poprzedni, więc bust i zwycięzca nie czekają w kolejce.
    silence();
    const delay = effect && effects ? effects.play(effect) : 0;
    if (!announcement) {
      return;
    }
    if (delay === 0) {
      speaker.speak(announcement);
      return;
    }
    // Głos czeka na koniec efektu, żeby się nie nakładały.
    speechTimer = setTimeout(() => {
      speechTimer = undefined;
      speaker.speak(announcement);
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
        case 'achievement':
          addAchievement(message.eventSeq, message.kind);
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
