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

export function sendTo(socket: LiveSocket, messages: readonly LiveMessage[]): void {
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

export interface LiveHub {
  subscribe(matchId: string, socket: LiveSocket): () => void;
  publish(matchId: string, messages: readonly LiveMessage[]): void;
}

export function createLiveHub(): LiveHub {
  const subscribers = new Map<string, Set<LiveSocket>>();
  return {
    subscribe(matchId, socket) {
      const sockets = subscribers.get(matchId) ?? new Set();
      sockets.add(socket);
      subscribers.set(matchId, sockets);
      return () => {
        sockets.delete(socket);
        if (sockets.size === 0 && subscribers.get(matchId) === sockets) {
          subscribers.delete(matchId);
        }
      };
    },
    publish(matchId, messages) {
      const sockets = subscribers.get(matchId);
      if (!sockets) {
        return;
      }
      for (const socket of sockets) {
        sendTo(socket, messages);
      }
    },
  };
}
