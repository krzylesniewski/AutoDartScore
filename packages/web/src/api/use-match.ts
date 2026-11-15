import { LiveMessage, MISS_SEGMENT } from '@autoscore/schema';
import type { Achievement, Hit, HitEvent, LiveAuthMessage, MatchSnapshot, ThrowResult } from '@autoscore/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pl } from '../i18n/pl';
import { liveSocketUrl } from './api-url';
import { API_BASE, ApiRequestError, abandonMatch, endPractice, postCheckoutAttempt, postCheckoutSkip, postThrow, resumeMatch, undo } from './client';
import { newEventId } from './event-id';
import { handleUnauthorized, readToken } from './session';

export const MATCH_NOT_FOUND_CLOSE_CODE = 4404;
export const UNAUTHORIZED_CLOSE_CODE = 4401;
export const RECONNECT_DELAY_MS = 1000;
export const BANNER_DURATION_MS = 2500;
export const ACHIEVEMENT_DURATION_MS = 5000;
export const KEYPAD_SOURCE = 'keypad';

const DARTS_PER_TURN = 3;
const MISS: Hit = { segment: MISS_SEGMENT, multiplier: 0 };

export type Connection = 'connecting' | 'open' | 'closed';

export type MatchErrorCode =
  | 'throw_failed'
  | 'nothing_to_undo'
  | 'match_locked'
  | 'undo_failed'
  | 'abandon_failed'
  | 'resume_failed'
  | 'end_practice_failed'
  | 'checkout_attempt_failed'
  | 'checkout_skip_failed';

const ERROR_TEXT: Record<MatchErrorCode, string> = {
  throw_failed: pl.throwFailed,
  nothing_to_undo: pl.nothingToUndo,
  match_locked: pl.matchLocked,
  undo_failed: pl.undoFailed,
  abandon_failed: pl.abandonFailed,
  resume_failed: pl.resumeFailed,
  end_practice_failed: pl.endPracticeFailed,
  checkout_attempt_failed: pl.checkoutAttemptFailed,
  checkout_skip_failed: pl.checkoutSkipFailed,
};

export interface LastTurn {
  readonly playerId: string;
  readonly darts: readonly Hit[];
  readonly total: number | null;
  readonly bust: boolean;
  readonly eventSeq: number;
}

export interface Banner {
  readonly kind: 'bust' | 'win';
  readonly playerName: string;
  readonly place: number | null;
}

export interface AchievementNotice {
  readonly achievement: Achievement;
  readonly playerName: string;
}

export interface UseMatch {
  readonly state: MatchSnapshot | null;
  readonly lastTurn: LastTurn | null;
  readonly banner: Banner | null;
  readonly achievements: readonly AchievementNotice[];
  readonly error: string | null;
  readonly errorCode: MatchErrorCode | null;
  readonly busy: boolean;
  readonly connection: Connection;
  readonly notFound: boolean;
  sendHit(hit: Hit): void;
  sendRestMiss(): void;
  sendUndo(): void;
  sendAbandon(playerId: string, reason: string | null): void;
  sendResume(): void;
  sendEndPractice(): void;
  sendCheckoutAttempt(success: boolean): void;
  sendCheckoutSkip(): void;
}

function liveUrl(matchId: string): string {
  return liveSocketUrl(API_BASE, `/matches/${encodeURIComponent(matchId)}/live`, location);
}

function parseMessage(data: unknown): LiveMessage | null {
  if (typeof data !== 'string') {
    return null;
  }
  try {
    const parsed = LiveMessage.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function keypadHit(matchId: string, sequence: number, hit: Hit): HitEvent {
  return {
    eventId: newEventId(),
    matchId,
    source: KEYPAD_SOURCE,
    sequence,
    segment: hit.segment,
    multiplier: hit.multiplier,
    confidence: 1,
    detectedAt: new Date().toISOString(),
  };
}

// Serwer rozpoznaje powtórzony eventId i nie zapisuje rzutki drugi raz, więc ponowienie jest bezpieczne, nawet gdy pierwsza próba doszła.
// Odpowiedź HTTP to decyzja serwera, więc ponawiamy tylko błąd sieci, przekroczenie czasu albo nieczytelną odpowiedź.
// Cofnij i inne komendy nie mają takiej ochrony, dlatego ponawiamy tylko rzutki.
async function postThrowWithRetry(matchId: string, event: HitEvent): Promise<ThrowResult> {
  try {
    return await postThrow(matchId, event);
  } catch (caught) {
    if (caught instanceof ApiRequestError) {
      throw caught;
    }
    return postThrow(matchId, event);
  }
}

export function useMatch(matchId: string, onLiveMessage?: (message: LiveMessage) => void): UseMatch {
  const [state, setState] = useState<MatchSnapshot | null>(null);
  const [lastTurn, setLastTurn] = useState<LastTurn | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [achievements, setAchievements] = useState<readonly AchievementNotice[]>([]);
  const [errorCode, setErrorCode] = useState<MatchErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [notFound, setNotFound] = useState(false);

  const stateRef = useRef<MatchSnapshot | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const achievementTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const achievementSeq = useRef<number | null>(null);
  const commands = useRef<Promise<void>>(Promise.resolve());
  const queued = useRef(0);
  const epoch = useRef(0);
  const sequence = useRef(0);
  const liveListener = useRef(onLiveMessage);

  // Callback w refie, żeby nowa funkcja z renderu nie otwierała socketu od nowa.
  useEffect(() => {
    liveListener.current = onLiveMessage;
  }, [onLiveMessage]);

  // Jedyna droga zmiany stanu. Wiadomości z WebSocketa i odpowiedzi POST mogą przyjść w dowolnej kolejności,
  // więc starszy snapshot nigdy nie nadpisuje nowszego.
  const acceptState = useCallback((next: MatchSnapshot) => {
    const current = stateRef.current;
    if (current && next.eventSeq < current.eventSeq) {
      return;
    }
    stateRef.current = next;
    setState(next);
  }, []);

  const showBanner = useCallback((next: Banner) => {
    clearTimeout(bannerTimer.current);
    setBanner(next);
    bannerTimer.current = setTimeout(() => setBanner(null), BANNER_DURATION_MS);
  }, []);

  // Osiągnięcia jednej rzutki mają wspólny eventSeq i pokazują się razem. Osiągnięcie z kolejnej rzutki zastępuje grupę.
  // Działa niezależnie od announcera, więc komunikat widać także przy wyłączonym głosie i efektach.
  const showAchievement = useCallback((next: AchievementNotice) => {
    const sameGroup = achievementSeq.current === next.achievement.eventSeq;
    achievementSeq.current = next.achievement.eventSeq;
    setAchievements((current) => (sameGroup ? [...current, next] : [next]));
    clearTimeout(achievementTimer.current);
    achievementTimer.current = setTimeout(() => {
      achievementSeq.current = null;
      setAchievements([]);
    }, ACHIEVEMENT_DURATION_MS);
  }, []);

  const clearAchievements = useCallback(() => {
    clearTimeout(achievementTimer.current);
    achievementSeq.current = null;
    setAchievements([]);
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    function playerName(playerId: string): string {
      return stateRef.current?.players.find((player) => player.id === playerId)?.name ?? '';
    }

    function handle(message: LiveMessage): void {
      switch (message.type) {
        case 'state_updated':
          acceptState(message.state);
          break;
        case 'turn_completed':
          setLastTurn({ playerId: message.playerId, darts: message.darts, total: message.total, bust: false, eventSeq: message.eventSeq });
          break;
        case 'bust':
          setLastTurn({ playerId: message.playerId, darts: message.darts, total: null, bust: true, eventSeq: message.eventSeq });
          showBanner({ kind: 'bust', playerName: playerName(message.playerId), place: null });
          break;
        case 'leg_won':
          showBanner({ kind: 'win', playerName: playerName(message.playerId), place: null });
          break;
        case 'player_finished':
          showBanner({ kind: 'win', playerName: playerName(message.playerId), place: message.place });
          break;
        case 'achievement':
          showAchievement({ achievement: message, playerName: playerName(message.playerId) });
          break;
        case 'throw_undone':
          clearAchievements();
          break;
        default:
          break;
      }
    }

    function connect(): void {
      setConnection('connecting');
      const ws = new WebSocket(liveUrl(matchId));
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
          handle(message);
          liveListener.current?.(message);
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
      clearTimeout(bannerTimer.current);
      clearTimeout(achievementTimer.current);
      socket?.close();
    };
  }, [matchId, acceptState, showBanner, showAchievement, clearAchievements]);

  // Komendy idą po kolei, więc szybkie stuknięcia docierają w kolejności stuknięć.
  // Nieudana rzutka podnosi epokę i odrzuca wszystko, co czekało za nią. Inaczej gracz zostałby z krótszą turą,
  // a sukces następnej komendy zgasiłby błąd. Komendy dodane po błędzie mają nową epokę i idą normalnie.
  const enqueue = useCallback((command: () => Promise<void>) => {
    const queuedEpoch = epoch.current;
    queued.current += 1;
    setBusy(true);
    const guarded = (): Promise<void> => (epoch.current === queuedEpoch ? command() : Promise.resolve());
    commands.current = commands.current.then(guarded).finally(() => {
      queued.current -= 1;
      if (queued.current === 0) {
        setBusy(false);
      }
    });
  }, []);

  const failThrow = useCallback(() => {
    epoch.current += 1;
    setErrorCode('throw_failed');
  }, []);

  const sendHit = useCallback(
    (hit: Hit) => {
      const event = keypadHit(matchId, sequence.current++, hit);
      enqueue(async () => {
        try {
          const result = await postThrowWithRetry(matchId, event);
          setErrorCode(null);
          acceptState(result.state);
        } catch {
          failThrow();
        }
      });
    },
    [matchId, enqueue, acceptState, failThrow],
  );

  // Stan z chwili kliknięcia. Gdy wcześniejsze stuknięcie albo Cofnij z kolejki zamknęło lub zmieniło turę, nic nie idzie.
  const sendRestMiss = useCallback(() => {
    const clicked = stateRef.current;
    if (!clicked) {
      return;
    }
    const playerId = clicked.currentPlayerId;
    const dartsAtClick = clicked.currentDarts.length;
    enqueue(async () => {
      const start = stateRef.current;
      if (!start || start.finished || start.status !== 'in_progress' || start.currentPlayerId !== playerId || start.currentDarts.length < dartsAtClick) {
        return;
      }
      let darts = start.currentDarts.length;
      const count = DARTS_PER_TURN - darts;
      for (let index = 0; index < count; index += 1) {
        // Inne urządzenie mogło zmienić turę między rzutkami.
        if (index > 0) {
          const latest = stateRef.current;
          if (!latest || latest.currentPlayerId !== playerId || latest.currentDarts.length !== darts + 1) {
            return;
          }
          darts = latest.currentDarts.length;
        }
        try {
          const result = await postThrowWithRetry(matchId, keypadHit(matchId, sequence.current++, MISS));
          acceptState(result.state);
          setErrorCode(null);
        } catch {
          failThrow();
          return;
        }
      }
    });
  }, [matchId, enqueue, acceptState, failThrow]);

  const sendUndo = useCallback(() => {
    enqueue(async () => {
      try {
        const result = await undo(matchId);
        setErrorCode(null);
        acceptState(result.state);
      } catch (caught) {
        const code = caught instanceof ApiRequestError && caught.status === 409 ? caught.code : null;
        setErrorCode(code === 'nothing_to_undo' || code === 'match_locked' ? code : 'undo_failed');
      }
    });
  }, [matchId, enqueue, acceptState]);

  const sendAbandon = useCallback(
    (playerId: string, reason: string | null) => {
      enqueue(async () => {
        try {
          const state = await abandonMatch(matchId, playerId, reason);
          setErrorCode(null);
          acceptState(state);
        } catch {
          setErrorCode('abandon_failed');
        }
      });
    },
    [matchId, enqueue, acceptState],
  );

  const sendResume = useCallback(() => {
    enqueue(async () => {
      try {
        const state = await resumeMatch(matchId);
        setErrorCode(null);
        acceptState(state);
      } catch {
        setErrorCode('resume_failed');
      }
    });
  }, [matchId, enqueue, acceptState]);

  const sendEndPractice = useCallback(() => {
    enqueue(async () => {
      try {
        const state = await endPractice(matchId);
        setErrorCode(null);
        acceptState(state);
      } catch {
        setErrorCode('end_practice_failed');
      }
    });
  }, [matchId, enqueue, acceptState]);

  const sendCheckoutAttempt = useCallback(
    (success: boolean) => {
      enqueue(async () => {
        try {
          const state = await postCheckoutAttempt(matchId, success);
          setErrorCode(null);
          acceptState(state);
        } catch {
          setErrorCode('checkout_attempt_failed');
        }
      });
    },
    [matchId, enqueue, acceptState],
  );

  const sendCheckoutSkip = useCallback(() => {
    enqueue(async () => {
      try {
        const state = await postCheckoutSkip(matchId);
        setErrorCode(null);
        acceptState(state);
      } catch {
        setErrorCode('checkout_skip_failed');
      }
    });
  }, [matchId, enqueue, acceptState]);

  return {
    state,
    lastTurn,
    banner,
    achievements,
    error: errorCode === null ? null : ERROR_TEXT[errorCode],
    errorCode,
    busy,
    connection,
    notFound,
    sendHit,
    sendRestMiss,
    sendUndo,
    sendAbandon,
    sendResume,
    sendEndPractice,
    sendCheckoutAttempt,
    sendCheckoutSkip,
  };
}
