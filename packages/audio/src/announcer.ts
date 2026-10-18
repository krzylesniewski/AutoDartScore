import type { DomainEvent, LiveMessage } from '@autoscore/schema';
import { announcementFor } from './announcement.js';

export interface Speaker {
  speak(text: string): void;
  cancel(): void;
}

export interface Announcer {
  handle(message: LiveMessage): void;
  stop(): void;
}

// Serwer wysyła jedną paczkę na rzutkę: throw_registered, zdarzenia domenowe i state_updated z tym samym eventSeq.
// Czytamy dopiero po state_updated, żeby cała paczka dała jeden komunikat. Snapshot po połączeniu ma inny eventSeq
// niż bufor i nigdy nie jest czytany.
export function createAnnouncer(speaker: Speaker): Announcer {
  let buffer: DomainEvent[] = [];
  let bufferSeq: number | null = null;

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

  function flush(eventSeq: number): void {
    const events = bufferSeq === eventSeq ? buffer : [];
    clear();
    const announcement = announcementFor(events);
    if (announcement) {
      // Nowy komunikat przerywa poprzedni, więc bust i zwycięzca nie czekają w kolejce.
      speaker.cancel();
      speaker.speak(announcement.text);
    }
  }

  return {
    handle(message) {
      switch (message.type) {
        case 'state_updated':
          flush(message.eventSeq);
          break;
        case 'throw_undone':
          clear();
          speaker.cancel();
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
      speaker.cancel();
    },
  };
}
