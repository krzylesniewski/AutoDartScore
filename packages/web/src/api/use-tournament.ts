import { TournamentLiveMessage } from '@autoscore/schema';
import type { LiveAuthMessage, TournamentView } from '@autoscore/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { liveSocketUrl } from './api-url';
import { API_BASE, ApiRequestError, getTournament } from './client';
import { handleUnauthorized, readToken } from './session';
import { MATCH_NOT_FOUND_CLOSE_CODE, RECONNECT_DELAY_MS, UNAUTHORIZED_CLOSE_CODE, type Connection } from './use-match';

export type TournamentLoadStatus = 'loading' | 'not_found' | 'error' | 'ready';

export interface UseTournament {
  readonly status: TournamentLoadStatus;
  readonly view: TournamentView | null;
  readonly connection: Connection;
  accept(view: TournamentView): void;
  reload(): void;
}

function liveUrl(tournamentId: string): string {
  return liveSocketUrl(API_BASE, `/tournaments/${encodeURIComponent(tournamentId)}/live`, location);
}

function parseMessage(data: unknown): TournamentLiveMessage | null {
  if (typeof data !== 'string') {
    return null;
  }
  try {
    const parsed = TournamentLiveMessage.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function useTournament(tournamentId: string): UseTournament {
  const [view, setView] = useState<TournamentView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [connection, setConnection] = useState<Connection>('connecting');
  const viewRef = useRef<TournamentView | null>(null);

  // Jedyna droga zmiany widoku. Zmiana legów w meczu turnieju przychodzi z tym samym eventSeq,
  // więc równy eventSeq też wygrywa, a odrzucany jest tylko starszy.
  const accept = useCallback((incoming: TournamentView) => {
    const current = viewRef.current;
    if (current && incoming.eventSeq < current.eventSeq) {
      return;
    }
    viewRef.current = incoming;
    setView(incoming);
  }, []);

  const reload = useCallback(() => {
    getTournament(tournamentId).then(accept, (caught: unknown) => {
      if (caught instanceof ApiRequestError && caught.status === 404) {
        setNotFound(true);
        return;
      }
      setLoadFailed(true);
    });
  }, [tournamentId, accept]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    function connect(): void {
      setConnection('connecting');
      const ws = new WebSocket(liveUrl(tournamentId));
      const token = readToken();
      socket = ws;
      // Przeglądarka rzuca wyjątek przy send() przed open.
      ws.addEventListener('open', () => {
        if (token !== null) {
          const message: LiveAuthMessage = { type: 'auth', token };
          ws.send(JSON.stringify(message));
        }
        setConnection('open');
      });
      ws.addEventListener('message', (event: MessageEvent) => {
        const message = parseMessage(event.data);
        if (message) {
          accept(message.tournament);
        }
      });
      ws.addEventListener('close', (event: CloseEvent) => {
        if (disposed) {
          return;
        }
        setConnection('closed');
        if (event.code === MATCH_NOT_FOUND_CLOSE_CODE) {
          setNotFound(true);
          return;
        }
        if (event.code === UNAUTHORIZED_CLOSE_CODE) {
          handleUnauthorized(token);
          return;
        }
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      });
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [tournamentId, accept]);

  let status: TournamentLoadStatus = 'loading';
  if (notFound) {
    status = 'not_found';
  } else if (view) {
    status = 'ready';
  } else if (loadFailed) {
    status = 'error';
  }
  return { status, view, connection, accept, reload };
}
