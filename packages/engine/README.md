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

Turniej (`tournament/tournament.ts`, drabinki w `tournament/bracket.ts`, miejsca w `tournament/placements.ts`). Trzy formaty: liga (`league`, każdy z każdym), puchar (`cup`, drabinka z losowania) i grupa z play-off (`group_playoff`, jedna grupa, potem drabinka):

- `computeTournament(input)`: stan turnieju liczony zawsze od nowa, nigdzie nieprzechowywany. `TournamentInput` ma `config` (`TournamentConfig`), `order` (ostatnie losowanie, permutacja `config.playerIds`) i `matches`: jeden `FixtureFact` na rozpoczęty mecz, w kolejności rozpoczęcia,
- `FixtureFact` ma `fixtureId`, `matchId`, `legs` (wygrane legi w kolejności slotów) i `scoring` (`FixtureScoring` dla obu slotów: punkty i rzutki z zamkniętych tur, bust za 0) albo `null`. Silnik nie zna darta, legi i punkty podaje serwer,
- `TournamentState` ma `fixtures` (`Fixture` z `@autoscore/schema`), `standings` (`StandingRow`), `nextFixtureId`, `liveFixtureId`, `status`, `placements` i `canRedraw`,
- mecz bez faktu jest `bye`, gdy jeden slot to wolny los, `ready`, gdy w obu slotach są gracze, a w pozostałych przypadkach `waiting` (czeka na wynik innego meczu albo na koniec grupy). Z faktem bez zwycięzcy jest `in_progress`, a gdy jedna strona ma `legsToWin` legów, `finished` z wynikiem. Każdy mecz ma własne `legsToWin` z `config.legsToWin`: `group` w grupie i w lidze, `r16`, `qf`, `sf` albo `final` według rundy drabinki, `thirdPlace` w meczu o 3. miejsce i `consolation` w każdym meczu pocieszenia,
- `nextFixtureId` to gotowy mecz o najniższym numerze, ale grać można dowolny gotowy. `liveFixtureId` to ostatnio rozpoczęty mecz w trakcie. Czy dwa mecze mogą trwać naraz, decyduje serwer,
- turniej kończy się, gdy każdy mecz jest rozegrany albo jest wolnym losem. W lidze `placements` to wtedy miejsca z tabeli, wcześniej lista jest pusta. W drabinkach miejsce pojawia się, gdy tylko jest rozstrzygnięte (zasady niżej). `canRedraw` jest `true` tylko bez żadnego faktu.

Terminarz to metoda kołowa dla 3-10 graczy: każda para gra raz, przy nieparzystej liczbie graczy jeden pauzuje w każdej rundzie. Rundy grane są w całości. Silnik szuka w głąb takiej kolejności rund i meczów w rundach, żeby nikt nie grał dwóch meczów pod rząd, i bierze pierwszą znalezioną (najpierw kolejność kanoniczna). Dla 3 i 4 graczy takiej kolejności nie ma i zostaje kanoniczna. Mecze dostają numery 1..k i identyfikatory `g-<numer>`.

Tabela: 2 punkty za wygraną, 0 za porażkę, remisów nie ma. O kolejności decydują po kolei:

1. punkty,
2. różnica legów,
3. mecze bezpośrednie: przy dwóch graczach ich mecz, przy trzech i więcej mała tabela (punkty, potem różnica legów) z meczów między nimi. Gdy rozdzieli tylko część graczy, pozostałych rozstrzyga od nowa mała tabela samej tej podgrupy,
4. średnia na 3 rzutki (`null` niżej niż każda liczba),
5. pozycja w losowaniu.

Średnia w tabeli to `3 * Σpunkty / Σrzutki` z rozegranych meczów gracza, które mają `scoring`, zaokrąglona do dwóch miejsc po przecinku (jak średnia w statystykach serwera). `null`, gdy rzutek jest 0. Porównywana jest wartość zaokrąglona, ta sama, którą widać. `averages` meczu są tylko w rozegranym meczu, w którym obie strony mają rzutki.

Drabinki:

- rozstawienie standardowe: zaczynając od `[1, 2]`, każde rozstawienie `s` zastępuje para `s, m + 1 - s` (m to podwojona długość listy), aż lista ma tyle pozycji, ile drabinka. Kolejne pary to mecze pierwszej rundy, niższe rozstawienie w slocie 0. Dla 8: 1-8, 4-5, 2-7, 3-6. Rozstawienia powyżej liczby uczestników to wolne losy (`{ kind: 'bye' }`), które nigdy nie trafiają na siebie,
- puchar (3-16 graczy): drabinka o rozmiarze najmniejszej potęgi dwójki ≥ n, rozstawienie k to `order[k - 1]`, slot `{ kind: 'player', playerId, seed: k }`. Tabeli nie ma (`standings` to pusta lista),
- grupa z play-off: grupa jak w lidze, tabela tylko z jej meczów, a `advances` jest `true` dla wierszy z miejscem ≤ `advance` (bieżąca strefa awansu, w lidze zawsze `false`). Drabinka play-off ma rozmiar `advance` (2, 4 albo 8), rozstawieniem jest miejsce w grupie. Do końca grupy sloty pierwszej rundy to `{ kind: 'standing', place }`, a mecze są `waiting`. Potem to gracze z `seed` równym miejscu w grupie,
- mecze drabinki mają fazę `playoff`, `bracketRound` według liczby graczy w rundzie (16 `r16`, 8 `qf`, 4 `sf`, 2 `final`), `round` od 1 i identyfikatory `p-<bracketRound>-<i>` liczone od góry, a finał `p-f`. W kolejnej rundzie slot 0 zasila mecz wyżej, slot 1 mecz niżej: `{ kind: 'winner_of', fixtureId }`, dopóki zwycięzca nie jest znany, potem gracz z jego rozstawieniem. Każdy slot rozstrzyga się osobno,
- wolny los: mecz `bye` bez `matchId`, wyniku, średnich i przegranego. Slot, który zasila, przejmuje jego drugi slot: gracza z rozstawieniem albo, w trakcie grupy, to samo miejsce w tabeli. Wolne losy są tylko w pierwszej rundzie,
- mecz o 3. miejsce (`thirdPlaceMatch`, puchar i grupa z play-off): `p-3rd`, faza `third_place`, `round: 1`, `bracketRound: null`, sloty `{ kind: 'loser_of' }` z `p-sf-1` i `p-sf-2`, potem gracze. Jest tylko wtedy, gdy drabinka ma półfinały i żaden nie jest wolnym losem, więc nie ma go przy `advance: 2` ani w pucharze dla 3 graczy,
- pocieszenie (`consolation`, tylko grupa z play-off): drabinka graczy z miejsc `advance + 1`..n, gdy jest ich co najmniej 2. Rozstawienie według względnego miejsca (najlepszy z nich ma 1), więc wolne losy dostają najwyżej rozstawieni, a `seed` w slocie to miejsce w grupie. Identyfikatory `c-<bracketRound>-<i>` i `c-f`, faza `consolation`,
- numeracja: mecze do rozegrania dostają 1..k w kolejności grupa (po rundach), rundy play-off przed finałem (po rundach, od góry), rundy pocieszenia (z `c-f`), `p-3rd`, a na końcu `p-f`. Wolne losy to nie mecze, więc mają kolejne numery po nich, od góry. `fixtures` jest posortowane po numerze. Przykład: 6 graczy, `advance: 4`, oba dodatki: `g-1`..`g-15`, `p-sf-1` 16, `p-sf-2` 17, `c-f` 18, `p-3rd` 19, `p-f` 20.

Miejsca w drabinkach są posortowane po miejscu, a przy miejscu dzielonym po rozstawieniu (w pucharze pozycja w losowaniu, w grupie z play-off miejsce w grupie):

- finał: zwycięzca 1, przegrany 2,
- `p-3rd`: zwycięzca 3, przegrany 4. Bez niego przegrani półfinałów dzielą 3. miejsce, gdy oba półfinały są rozstrzygnięte. W pucharze dla 3 graczy przegrany półfinału jest sam na 3. miejscu,
- wcześniejsze rundy play-off (`qf`, `r16`), gdy cała runda jest rozegrana albo jest wolnym losem: pierwsze miejsce rundy to 1 + liczba graczy, którzy przeszli dalej. W pucharze przegrani dzielą to miejsce, w grupie z play-off zajmują kolejne miejsca od niego według miejsca w grupie,
- pocieszenie: zwycięzca `c-f` ma `advance + 1`, przegrany `advance + 2`. Przegrani wcześniejszej rundy pocieszenia, gdy cała runda jest rozstrzygnięta, zajmują kolejne miejsca od `advance + 1` + liczba graczy, którzy przeszli dalej, według miejsca w grupie,
- bez pocieszenia (wyłączone albo mniej niż 2 graczy poza play-off): miejsca `advance + 1`..n według tabeli, gdy grupa się skończy,
- po końcu turnieju każdy gracz ma dokładnie jedno miejsce. Puchar dla 11 graczy bez meczu o 3. miejsce kończy się miejscami 1, 2, 3, 3, 5 (4 razy) i 9 (3 razy).

Punkty (`points.ts`):

- `hitPoints(hit)`, `isDouble(hit)` (Bull też jest doublem), `isBust(after, hit)`.

Błędy (`errors.ts`): `EngineError` z polem `code`:

- `invalid_config`: zła konfiguracja gry, na przykład zła liczba graczy albo ziarno checkoutów spoza `0..MAX_CHECKOUT_SEED`. `createX01Match` odrzuca też `firstPlayerIndex` inny niż 0 lub 1 i `legsToWin` spoza 1-9 (`LegsToWin` z `@autoscore/schema`). `computeTournament` odrzuca liczbę graczy spoza `TOURNAMENT_PLAYER_LIMITS` formatu (liga i grupa z play-off 3-10, puchar 3-16), w grupie z play-off brak `advance`, `advance` inne niż 2, 4 i 8 albo większe od liczby graczy, kolejność losowania, która nie jest permutacją graczy, fakt z nieznanym albo powtórzonym `fixtureId`, fakt dla meczu, który bez niego nie byłby `ready` (`waiting` albo `bye`), pusty albo powtórzony `matchId`, legi spoza 0..`legsToWin` tego meczu albo obie strony z `legsToWin` oraz punkty lub rzutki, które nie są nieujemnymi liczbami całkowitymi,
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
- `tournament/bracket.test.ts`: rozstawienie dla 2, 4, 8 i 16, rozmiar drabinki, nazwy rund i zasilanie slotów, brak pary dwóch wolnych losów dla 3-16 uczestników.
- `tournament/tournament.test.ts`: numeracja i statusy meczów, tabela z makiety, mecz w trakcie, koniec ligi z miejscami, `canRedraw`, średnie meczów, puchar dla 3, 4, 5, 6, 8, 11 i 16 graczy z wolnymi losami, mecz o 3. miejsce, play-off dla `advance` 2, 4 i 8, numeracja turnieju z makiety z dodatkami i bez, pocieszenie dla 1-4 graczy poza play-off, `legsToWin` według fazy, strefa awansu, miejsca w trakcie i na końcu turnieju, odrzucane wejścia (także fakt dla meczu `waiting` i `bye`).
