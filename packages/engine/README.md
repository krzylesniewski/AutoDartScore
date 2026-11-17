# @autoscore/engine

Silnik gry. Czysta logika X01, zabawy, treningu i turniejów, bez I/O, UI i czasu systemowego. Dostaje stan i trafienie, zwraca nowy stan i zdarzenia domenowe (`turn_completed`, `bust`, `leg_won`, `match_won`, `player_finished`, `casual_finished`). Stan da się zawsze odtworzyć z listy trafień (w treningu checkoutów z listy prób i pominięć), więc serwer nie przechowuje go osobno.

Losowania też tu nie ma. Kto zaczyna, podaje wywołujący w konfiguracji (`firstPlayerIndex`). Ziarno celów treningu checkoutów (`seed`) i kolejność losowania turnieju (`order`) też podaje wywołujący.

## API

Każda funkcja `apply*` i `replay*` zwraca `ApplyResult<S>`: `{ state, events }` (`apply-result.ts`). Trafienie ma typ `Hit` z `@autoscore/schema`.

Zasady tury X01 (bust, zamknięcie, trzecia rzutka) są w jednym wewnętrznym module `x01-turn.ts`, wspólnym dla meczu 1v1, zabawy i Solo 501. Nie jest eksportowany.

Jedno wejście dla wszystkich typów gry (`game.ts`):

- `createGame(config)`, `applyGameThrow(game, hit)`, `replayGame(config, hits, checkoutSteps = [])` dla `GameConfig` i `GameState` z polem `type` (`match`, `casual`, `practice`) i `practiceMode`,
- `applyGameCheckoutAttempt(game, success)`: próba w treningu checkoutów,
- `applyGameCheckoutSkip(game)`: pominięcie celu w treningu checkoutów,
- `isGameFinished(game)`: trening checkoutów i Free run nigdy się nie kończą,
- `currentRound(game)`: kolejka rzucającego w bieżącym legu, liczona od 1. Bust też jest turą. `null` po końcu gry, w Free run i w treningu checkoutów,
- `dartsInCurrentLeg(game)`: liczone rzutki bieżącego lega, `0` zaraz po wygranym legu i zawsze w treningu checkoutów,
- `countsToStats(config)`: `true` tylko dla meczu 1v1, zabawy i Solo 501, więc `false` dla Free run i treningu checkoutów.

Mecz 1v1 do N wygranych legów, N od 1 do 9 (`x01-match.ts`):

- `createX01Match`, `applyThrow`, `replayX01Match`, `currentPlayerId`,
- wynik startowy to `StartingScore`, a dozwolone wartości (301, 501, 701) są w `STARTING_SCORES` z `@autoscore/schema`.

Zabawa dla 2-4 graczy z miejscami (`casual-match.ts`):

- `createCasualMatch`, `applyCasualThrow`, `replayCasualMatch`.

Trening Solo 501 (`solo-501.ts`):

- `createSolo501`, `applySolo501Throw`, `replaySolo501`, `SOLO_501_STARTING_SCORE`.

Trening Free run, bez zasad i bez zdarzeń domenowych (`free-run.ts`):

- `createFreeRun`, `applyFreeRunThrow`, `replayFreeRun`, `freeRunAverage` (średnia na 3 rzutki).

Trening checkoutów, bez rzutek i bez zdarzeń domenowych (`checkouts.ts`):

- `CheckoutsConfig` ma `playerId`, `range`, `seed` i `rule` (`CheckoutRule`). `createCheckouts` odrzuca nieznaną zasadę błędem `invalid_config`,
- `CheckoutRule` z `@autoscore/schema`: `repeat_on_miss` (po nieudanej próbie cel zostaje, nowy po udanej) albo `new_each_attempt` (nowy cel po każdej próbie, zasada sesji zapisanych wcześniej),
- `CheckoutsState` ma bieżący `target`, `attempts`, `skips` i `draws` (ile razy zmienił się cel). Zawsze `target === checkoutTarget(seed, range, draws)`,
- `applyCheckoutAttempt(state, success)`: zapisuje próbę na bieżącym celu i losuje nowy według zasady,
- `applyCheckoutSkip(state)`: losuje nowy cel bez próby i zwiększa `skips`, w obu zasadach,
- `CheckoutStep`: `{ type: 'attempt', success }` albo `{ type: 'skip' }`,
- `replayCheckouts(config, steps)`: stan z prób i pominięć w kolejności z logu,
- `checkoutTarget(seed, range, n)`: cel numer `n` (od 0), wyliczony krokami `nextCheckoutTarget`,
- `nextCheckoutTarget(seed, range, previous, n)`: cel numer `n > 0`. Losowanie jest równomierne i nigdy nie powtarza poprzedniego celu,
- `CHECKOUT_RANGES` (`2-50`, `51-100`), `MAX_CHECKOUT_SEED` (`2 ** 31 - 1`, żeby ziarno mieściło się w kolumnie integer ze znakiem).

Turniej (`tournament/tournament.ts`). Na razie tylko liga (`format: 'league'`), drabinki dojdą później:

- `computeTournament(input)`: stan turnieju liczony zawsze od nowa, nigdzie nieprzechowywany. `TournamentInput` ma `config` (`TournamentConfig`), `order` (ostatnie losowanie, permutacja `config.playerIds`) i `matches`: jeden `FixtureFact` na rozpoczęty mecz, w kolejności rozpoczęcia,
- `FixtureFact` ma `fixtureId`, `matchId`, `legs` (wygrane legi w kolejności slotów) i `scoring` (`FixtureScoring` dla obu slotów: punkty i rzutki z zamkniętych tur, bust za 0) albo `null`. Silnik nie zna darta, legi i punkty podaje serwer,
- `TournamentState` ma `fixtures` (`Fixture` z `@autoscore/schema`), `standings` (`StandingRow`), `nextFixtureId`, `liveFixtureId`, `status`, `placements` i `canRedraw`,
- mecz bez faktu jest `ready`, z faktem bez zwycięzcy `in_progress`, a gdy jedna strona ma `legsToWin` legów, `finished` z wynikiem. `legsToWin` każdego meczu ligi to `config.legsToWin.group`,
- `nextFixtureId` to gotowy mecz o najniższym numerze, ale grać można dowolny gotowy. `liveFixtureId` to ostatnio rozpoczęty mecz w trakcie. Czy dwa mecze mogą trwać naraz, decyduje serwer,
- liga kończy się, gdy wszystkie mecze są rozegrane. Wtedy `placements` to miejsca z tabeli, wcześniej lista jest pusta. `canRedraw` jest `true` tylko bez żadnego faktu.

Terminarz to metoda kołowa dla 3-10 graczy: każda para gra raz, przy nieparzystej liczbie graczy jeden pauzuje w każdej rundzie. Rundy grane są w całości. Silnik szuka w głąb takiej kolejności rund i meczów w rundach, żeby nikt nie grał dwóch meczów pod rząd, i bierze pierwszą znalezioną (najpierw kolejność kanoniczna). Dla 3 i 4 graczy takiej kolejności nie ma i zostaje kanoniczna. Mecze dostają numery 1..k i identyfikatory `g-<numer>`.

Tabela: 2 punkty za wygraną, 0 za porażkę, remisów nie ma. O kolejności decydują po kolei:

1. punkty,
2. różnica legów,
3. mecze bezpośrednie: przy dwóch graczach ich mecz, przy trzech i więcej mała tabela (punkty, potem różnica legów) z meczów między nimi. Gdy rozdzieli tylko część graczy, pozostałych rozstrzyga od nowa mała tabela samej tej podgrupy,
4. średnia na 3 rzutki (`null` niżej niż każda liczba),
5. pozycja w losowaniu.

Średnia w tabeli to `3 * Σpunkty / Σrzutki` z rozegranych meczów gracza, które mają `scoring`, zaokrąglona do dwóch miejsc po przecinku (jak średnia w statystykach serwera). `null`, gdy rzutek jest 0. Porównywana jest wartość zaokrąglona, ta sama, którą widać. `averages` meczu są tylko w rozegranym meczu, w którym obie strony mają rzutki.

Punkty (`points.ts`):

- `hitPoints(hit)`, `isDouble(hit)` (Bull też jest doublem), `isBust(after, hit)`.

Błędy (`errors.ts`): `EngineError` z polem `code`:

- `invalid_config`: zła konfiguracja gry, na przykład zła liczba graczy albo ziarno checkoutów spoza `0..MAX_CHECKOUT_SEED`. `createX01Match` odrzuca też `firstPlayerIndex` inny niż 0 lub 1 i `legsToWin` spoza 1-9 (`LegsToWin` z `@autoscore/schema`). `computeTournament` odrzuca format inny niż `league`, liczbę graczy spoza 3-10, kolejność losowania, która nie jest permutacją graczy, fakt z nieznanym albo powtórzonym `fixtureId`, pusty albo powtórzony `matchId`, legi spoza 0..`legsToWin` albo obie strony z `legsToWin` oraz punkty lub rzutki, które nie są nieujemnymi liczbami całkowitymi,
- `invalid_hit`: trafienie niezgodne z kodowaniem,
- `match_finished`: rzutka po końcu gry,
- `wrong_mode`: rzutka w treningu checkoutów albo próba lub pominięcie checkoutu w innym trybie.

## Testy

```sh
pnpm --filter @autoscore/engine test
```

Testy liczą pokrycie (v8) i nie przechodzą, gdy spadnie ono poniżej progów w `vitest.config.ts`.

- `x01-turn.test.ts`: jedna rzutka w turze X01, otwarta tura, trzecia rzutka, trzy rodzaje bustu, zamknięcie na doublu i Bullu, zła rzutka, 4. rzutka w turze.
- `x01-match.test.ts`: konfiguracja, tura, bust, zamknięcie, legi i mecz, odtwarzanie.
- `casual-match.test.ts`: zabawa, kolejne zamknięcia, wypadanie z kolejki, ostatnie miejsce, bust po zamknięciu innych graczy, odtwarzanie.
- `solo-501.test.ts`: tura, bust, zamknięcie, odtwarzanie.
- `free-run.test.ts`: licznik sesji (rzutki, suma, średnia), odtwarzanie.
- `checkouts.test.ts`: powtarzalność celów, zakres, brak powtórki poprzedniego celu, rozkład na 10 000 celach, próby w obu zasadach, pominięcia, odtwarzanie mieszanych kroków.
- `game.test.ts`: wspólne wejście, `countsToStats`, `isGameFinished`, `wrong_mode`.
- `replay-golden.test.ts`: odtworzenia meczu 1v1, zabawy, Solo 501, Free run i treningu checkoutów (także urwane w trakcie tury) porównane z migawką w `__snapshots__`, nagraną na silniku sprzed wspólnego rdzenia tury. Migawki się nie nadpisuje.
- `tournament/round-robin.test.ts`: terminarz dla 3-10 graczy (każda para raz, gracz raz w rundzie, liczba rund, pauzy, brak meczów pod rząd od 5 graczy), wektory dla 3, 4, 5 i 6 graczy, zła liczba graczy i złe identyfikatory.
- `tournament/standings.test.ts`: wiersze tabeli, średnia ważona rzutkami, każdy poziom rozstrzygania remisów, remisy trzech graczy rozstrzygane małą tabelą.
- `tournament/tournament.test.ts`: numeracja i statusy meczów, tabela z makiety, mecz w trakcie, koniec ligi z miejscami, `canRedraw`, średnie meczów, odrzucane wejścia.
