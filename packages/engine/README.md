# @autoscore/engine

Silnik gry. Czysta logika X01, zabawy i treningu, bez I/O, UI i czasu systemowego. Dostaje stan i trafienie, zwraca nowy stan i zdarzenia domenowe (`turn_completed`, `bust`, `leg_won`, `match_won`, `player_finished`, `casual_finished`). Stan da się zawsze odtworzyć z listy trafień (w treningu checkoutów z listy prób i pominięć), więc serwer nie przechowuje go osobno.

Losowania też tu nie ma. Kto zaczyna, podaje wywołujący w konfiguracji (`firstPlayerIndex`). Ziarno celów treningu checkoutów (`seed`) też podaje wywołujący.

## API

Każda funkcja `apply*` i `replay*` zwraca `ApplyResult`: `{ state, events }`. Trafienie ma typ `Hit` z `@autoscore/schema`.

Jedno wejście dla wszystkich typów gry (`game.ts`):

- `createGame(config)`, `applyGameThrow(game, hit)`, `replayGame(config, hits, checkoutSteps = [])` dla `GameConfig` i `GameState` z polem `type` (`match`, `casual`, `practice`) i `practiceMode`,
- `applyGameCheckoutAttempt(game, success)`: próba w treningu checkoutów,
- `applyGameCheckoutSkip(game)`: pominięcie celu w treningu checkoutów,
- `isGameFinished(game)`: trening checkoutów i Free run nigdy się nie kończą,
- `currentRound(game)`: kolejka rzucającego w bieżącym legu, liczona od 1. Bust też jest turą. `null` po końcu gry, w Free run i w treningu checkoutów,
- `dartsInCurrentLeg(game)`: liczone rzutki bieżącego lega, `0` zaraz po wygranym legu i zawsze w treningu checkoutów,
- `countsToStats(config)`: `true` tylko dla meczu 1v1, zabawy i Solo 501, więc `false` dla Free run i treningu checkoutów.

Mecz 1v1, best of N legów (`x01-match.ts`):

- `createX01Match`, `applyThrow`, `replayX01Match`, `currentPlayerId`,
- `STARTING_SCORES`: 301, 501, 701.

Zabawa dla 2-4 graczy z miejscami (`casual-match.ts`):

- `createCasualMatch`, `applyCasualThrow`, `replayCasualMatch`.

Trening Solo 501 (`solo-501.ts`):

- `createSolo501`, `applySolo501Throw`, `replaySolo501`, `SOLO_501_STARTING_SCORE`.

Trening Free run, bez zasad i bez zdarzeń domenowych (`free-run.ts`):

- `createFreeRun`, `applyFreeRunThrow`, `replayFreeRun`, `freeRunAverage` (średnia na 3 rzutki).

Trening checkoutów, bez rzutek i bez zdarzeń domenowych (`checkouts.ts`):

- `CheckoutsConfig` ma `playerId`, `range`, `seed` i `rule` (`CheckoutRule`). `createCheckouts` odrzuca nieznaną zasadę błędem `invalid_config`,
- `CheckoutRule`: `repeat_on_miss` (po nieudanej próbie cel zostaje, nowy po udanej) albo `new_each_attempt` (nowy cel po każdej próbie, zasada sesji zapisanych wcześniej),
- `CheckoutsState` ma bieżący `target`, `attempts`, `skips` i `draws` (ile razy zmienił się cel). Zawsze `target === checkoutTarget(seed, range, draws)`,
- `applyCheckoutAttempt(state, success)`: zapisuje próbę na bieżącym celu i losuje nowy według zasady,
- `applyCheckoutSkip(state)`: losuje nowy cel bez próby i zwiększa `skips`, w obu zasadach,
- `CheckoutStep`: `{ type: 'attempt', success }` albo `{ type: 'skip' }`,
- `replayCheckouts(config, steps)`: stan z prób i pominięć w kolejności z logu,
- `checkoutTarget(seed, range, n)`: cel numer `n` (od 0), wyliczony krokami `nextCheckoutTarget`,
- `nextCheckoutTarget(seed, range, previous, n)`: cel numer `n > 0`. Losowanie jest równomierne i nigdy nie powtarza poprzedniego celu,
- `CHECKOUT_RANGES` (`2-50`, `51-100`), `MAX_CHECKOUT_SEED` (`2 ** 31 - 1`, żeby ziarno mieściło się w kolumnie integer ze znakiem).

Punkty (`points.ts`):

- `hitPoints(hit)`, `isDouble(hit)` (Bull też jest doublem), `isBust(after, hit)`.

Błędy (`errors.ts`): `EngineError` z polem `code`:

- `invalid_config`: zła konfiguracja gry, na przykład zła liczba graczy albo ziarno checkoutów spoza `0..MAX_CHECKOUT_SEED`,
- `invalid_hit`: trafienie niezgodne z kodowaniem,
- `match_finished`: rzutka po końcu gry,
- `wrong_mode`: rzutka w treningu checkoutów albo próba lub pominięcie checkoutu w innym trybie.

## Testy

```sh
pnpm --filter @autoscore/engine test
```

- `x01-match.test.ts`: tura, bust, zamknięcie, legi i mecz, odtwarzanie.
- `casual-match.test.ts`: zabawa, kolejne zamknięcia, wypadanie z kolejki, ostatnie miejsce, bust po zamknięciu innych graczy, odtwarzanie.
- `solo-501.test.ts`: tura, bust, zamknięcie, odtwarzanie.
- `free-run.test.ts`: licznik sesji (rzutki, suma, średnia), odtwarzanie.
- `checkouts.test.ts`: powtarzalność celów, zakres, brak powtórki poprzedniego celu, rozkład na 10 000 celach, próby w obu zasadach, pominięcia, odtwarzanie mieszanych kroków.
- `game.test.ts`: wspólne wejście, `countsToStats`, `isGameFinished`, `wrong_mode`.
