// Komendy jednej gry wykonują się po kolei, więc dwa źródła nie przeplatają się między await.
// Różne gry nie blokują się nawzajem.
export type SerialQueue = <T>(key: string, task: () => Promise<T>) => Promise<T>;

export function createSerialQueue(): SerialQueue {
  const tails = new Map<string, Promise<unknown>>();
  return (key, task) => {
    const result = (tails.get(key) ?? Promise.resolve()).then(task);
    const tail = result.catch(() => undefined);
    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) {
        tails.delete(key);
      }
    });
    return result;
  };
}
