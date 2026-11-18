import { useEffect, useRef, useState } from 'react';
import { ApiRequestError } from './client';

// Publiczny podgląd nie ma kanału na żywo, więc pyta API co 10 s. Serwer i tak trzyma odpowiedzi do 5 s.
export const PUBLIC_POLL_INTERVAL_MS = 10_000;

export interface PublicPoll<T> {
  readonly status: 'loading' | 'ready' | 'not_found' | 'error';
  readonly data: T | null;
  // Ostatnie odświeżenie się nie udało, a na ekranie zostają wcześniejsze dane.
  readonly refreshFailed: boolean;
}

interface Stored<T> extends PublicPoll<T> {
  readonly key: string;
}

const LOADING = { status: 'loading', data: null, refreshFailed: false } as const;

function isNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}

// Następne zapytanie idzie 10 s po rozstrzygnięciu poprzedniego, więc zapytania nigdy na siebie nie nachodzą.
// 404 kończy odpytywanie, bo nieudostępniony turniej nie wróci bez nowego linku. Inne błędy zostawiają ostatnie dane.
// Hook startuje od nowa tylko przy zmianie ids. Loader może być nową funkcją przy każdym renderze.
export function usePublicPoll<T>(load: () => Promise<T>, ids: readonly string[]): PublicPoll<T> {
  const key = JSON.stringify(ids);
  const loader = useRef(load);
  const [stored, setStored] = useState<Stored<T>>({ key, ...LOADING });

  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(run, PUBLIC_POLL_INTERVAL_MS);
    };
    function run(): void {
      loader.current().then(
        (data) => {
          if (active) {
            setStored({ key, status: 'ready', data, refreshFailed: false });
            schedule();
          }
        },
        (error: unknown) => {
          if (!active) {
            return;
          }
          if (isNotFound(error)) {
            setStored({ key, status: 'not_found', data: null, refreshFailed: false });
            return;
          }
          setStored((previous) =>
            previous.key === key && previous.data !== null
              ? { ...previous, refreshFailed: true }
              : { key, status: 'error', data: null, refreshFailed: false },
          );
          schedule();
        },
      );
    }
    run();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);

  if (stored.key !== key) {
    return LOADING;
  }
  return { status: stored.status, data: stored.data, refreshFailed: stored.refreshFailed };
}
