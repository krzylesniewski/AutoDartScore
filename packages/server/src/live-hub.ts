import type { LiveMessage } from '@autoscore/schema';

export interface LiveSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string): void;
  terminate(): void;
}

const OPEN = 1;
// Każde state_updated niesie pełny stan, a klient, który nie czyta, nie może trzymać pamięci serwera.
export const LIVE_MAX_BUFFERED_BYTES = 1024 * 1024;

export function sendTo<Message = LiveMessage>(socket: LiveSocket, messages: readonly Message[]): void {
  if (socket.readyState !== OPEN) {
    return;
  }
  // terminate, nie close, bo ramka zamknięcia czekałaby w kolejce za pełnym buforem.
  if (socket.bufferedAmount > LIVE_MAX_BUFFERED_BYTES) {
    socket.terminate();
    return;
  }
  for (const message of messages) {
    socket.send(JSON.stringify(message));
  }
}

// Klucz to id gry albo, w drugim hubie, id turnieju.
export interface LiveHub<Message = LiveMessage> {
  subscribe(key: string, socket: LiveSocket): () => void;
  publish(key: string, messages: readonly Message[]): void;
}

export function createLiveHub<Message = LiveMessage>(): LiveHub<Message> {
  const subscribers = new Map<string, Set<LiveSocket>>();
  return {
    subscribe(key, socket) {
      const sockets = subscribers.get(key) ?? new Set();
      sockets.add(socket);
      subscribers.set(key, sockets);
      return () => {
        sockets.delete(socket);
        if (sockets.size === 0 && subscribers.get(key) === sockets) {
          subscribers.delete(key);
        }
      };
    },
    publish(key, messages) {
      const sockets = subscribers.get(key);
      if (!sockets) {
        return;
      }
      for (const socket of sockets) {
        sendTo(socket, messages);
      }
    },
  };
}
