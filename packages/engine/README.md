# @autoscore/engine

Silnik gry. Czysta logika X01, zabawy i treningu, bez I/O, UI i czasu systemowego. Dostaje stan i trafienie, zwraca nowy stan i zdarzenia domenowe (`turn_completed`, `bust`, `leg_won`, `match_won`, `player_finished`, `casual_finished`). Stan da się zawsze odtworzyć z listy trafień, więc serwer nie przechowuje go osobno.

Losowania też tu nie ma. Kto zaczyna, podaje wywołujący w konfiguracji (`firstPlayerIndex`).

## API

Każda funkcja `apply*` i `replay*` zwraca `ApplyResult`: `{ state, events }`. Trafienie ma typ `Hit` z `@autoscore/schema`.

Jedno wejście dla wszystkich typów gry (`game.ts`):

- `createGame(config)`, `applyGameThrow(game, hit)`, `replayGame(config, hits)` dla `GameConfig` i `GameState` z polem `type` (`match`, `casual`, `practice`) i `practiceMode`,
- `isGameFinished(game)`,
- `countsToStats(config)`: `false` tylko dla Free run.

Mecz 1v1, best of N legów (`x01-match.ts`):

- `createX01Match`, `applyThrow`, `replayX01Match`, `currentPlayerId`,
- `STARTING_SCORES`: 301, 501, 701.

Zabawa dla 2-4 graczy z miejscami (`casual-match.ts`):

- `createCasualMatch`, `applyCasualThrow`, `replayCasualMatch`.

Trening Solo 501 (`solo-501.ts`):

- `createSolo501`, `applySolo501Throw`, `replaySolo501`, `SOLO_501_STARTING_SCORE`.

Trening Free run, bez zasad i bez zdarzeń domenowych (`free-run.ts`):

- `createFreeRun`, `applyFreeRunThrow`, `replayFreeRun`, `freeRunAverage` (średnia na 3 rzutki).

Punkty (`points.ts`):

- `hitPoints(hit)`, `isDouble(hit)` (Bull też jest doublem), `isBust(after, hit)`.

Błędy (`errors.ts`): `EngineError` z polem `code`:

- `invalid_config`: zła konfiguracja gry, na przykład zła liczba graczy,
- `invalid_hit`: trafienie niezgodne z kodowaniem,
- `match_finished`: rzutka po końcu gry.

## Testy

```sh
pnpm --filter @autoscore/engine test
```

- `x01-match.test.ts`: tura, bust, zamknięcie, legi i mecz, odtwarzanie.
- `casual-match.test.ts`: zabawa, kolejne zamknięcia, wypadanie z kolejki, ostatnie miejsce, bust po zamknięciu innych graczy, odtwarzanie.
- `solo-501.test.ts`: tura, bust, zamknięcie, odtwarzanie.
- `free-run.test.ts`: licznik sesji (rzutki, suma, średnia), odtwarzanie.
- `game.test.ts`: wspólne wejście, `countsToStats`, `isGameFinished`.
