# P46-P47: trening „Końcówki” (losowana końcówka, udało się albo nie)

Pomysł autora z 2026-10-26 (`feedback-graczy.md`), decyzje z tego samego dnia. Wspólne zasady z `design/rwd.md` i kryteria stabilności klawiatury z P31 (`design/plan-p31-p32.md`) obowiązują dalej. Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts`, typy i DTO tylko z `packages/schema`, kolor nigdy sam nie niesie znaczenia.

Kolejność: P47 zależy od P46.

**Pomysł:** „W sekcji nowa gra, trening, przygotuj nowy tryb gry: końcówki. I tam powinna się losować końcówka lega w dwóch przedziałach: 0-50 i 51-100. I podczas treningu zaznaczam, czy mi się udało, czy nie. Jest to trening per osoba”.

**Decyzje 2026-10-26:**
- nowy tryb treningu „Końcówki” obok Free run i Solo 501, zawsze jeden gracz;
- przedział wybierany w kreatorze: „2-50” albo „51-100” (od 2, bo 0 i 1 nie da się zamknąć); cała sesja losuje z wybranego przedziału;
- na jedną końcówkę gracz ma jedną turę (3 lotki); lotek nie wpisuje;
- wynik próby gracz zaznacza przyciskami „Udało się” i „Nie udało się”, po czym losuje się następna końcówka;
- sesja bez limitu, jak Free run: trwa, aż gracz kliknie „Zakończ trening”; licznik prób i procent udanych w trakcie i na podsumowaniu;
- trening nie wchodzi do statystyk X01 (`countsToStats: false`), wyniki prób zostają w logu zdarzeń.

## P46: tryb „Końcówki” w silniku, kontrakcie i API (engine, schema, server)

**Dziś:** `PracticeMode` (`packages/schema/src/match.ts`) ma `free_run` i `solo_501`. Silnik ma osobny moduł na każdy tryb (`packages/engine/src/free-run.ts`, `solo-501.ts`, wybór w `game.ts`). Log gry (`MatchEventType` w `packages/server/src/db/database.ts`) zna `throw`, `undo`, `match_abandoned`, `match_resumed` i `practice_ended`. Losowanie (kto zaczyna) robi serwer przez wstrzykiwane `random` (`app.ts`, `match-service.ts`), a silnik losowości nie ma.

**Zmiana:**
1. **Schema:** `PracticeMode` dostaje `checkouts`. Nowy typ `CheckoutRange` (`'2-50' | '51-100'`), wymagany przy tworzeniu gry z `practiceMode: 'checkouts'` i zabroniony w pozostałych (walidacja Zod z testami). Snapshot gry treningu „Końcówki” pokazuje: przedział, bieżącą końcówkę (`target`), liczbę prób, liczbę udanych i listę zakończonych prób (`target`, `success`) w kolejności. Podsumowanie i lista gier (Historia, niedokończone gry) dostają te same liczby, żeby wiersz mógł pokazać np. „7/12 · 58%”.
2. **Losowanie bez losowości w silniku:** przy tworzeniu gry serwer losuje ziarno (`seed`, liczba całkowita) przez `random` i zapisuje je razem z przedziałem w danych gry (migracja dodająca kolumny, tylko dopisanie, bez zmian w istniejących wierszach). Silnik wylicza końcówkę numer `n` czystą, deterministyczną funkcją `checkoutTarget(seed, range, n)`: równomierny rozkład w przedziale, a kolejna końcówka różni się od poprzedniej. Ta sama gra po odświeżeniu, na drugim ekranie i po restarcie serwera pokazuje tę samą końcówkę.
3. **Zdarzenie próby:** nowy wpis w logu `checkout_attempt` z polem `success` (true/false), dopisywany przez `POST /matches/:id/checkout-attempts` (`{ success }`). Końcówka próby wynika z odtworzenia (numer próby i ziarno), więc nie jest zapisywana jako dane od klienta. Cofnij (`POST /matches/:id/undo`) usuwa ostatnią próbę i przywraca jej końcówkę jako bieżącą. Próba po zakończeniu treningu lub w innym typie gry zwraca błąd 409 albo 400 jak inne niedozwolone akcje. Zmiana stanu idzie do klientów przez WebSocket jak po rzutce.
4. **Bez lotek:** w trybie „Końcówki” rzutka (`POST .../throws`) jest odrzucana (409), bo tryb nie liczy lotek.
5. **Koniec i porzucenie:** „Zakończ trening” (`POST /matches/:id/end`) działa jak w Free run; zakończona sesja jest tylko do odczytu. Trening nie ma „Porzuć”, jak pozostałe tryby treningu.
6. **Statystyki:** `countsToStats: false`; agregaty X01 nie zmieniają się. Bez nowych statystyk na karcie gracza.

**Testy:**
- silnik: `checkoutTarget` deterministyczny (to samo ziarno, przedział i numer dają tę samą końcówkę), zawsze w przedziale, kolejna różna od poprzedniej, oba przedziały pokryte w całości przy dużej liczbie prób; stan po próbach udanych i nieudanych; Cofnij;
- schema: tworzenie gry „Końcówki” z przedziałem i bez (błąd), przedział przy innym trybie (błąd), snapshot i podsumowanie;
- serwer: tworzenie z wstrzykniętym `random`, próby i licznik, Cofnij, odrzucona rzutka, próba po „Zakończ trening” (błąd), odtworzenie po restarcie daje te same końcówki, migracja na bazie z istniejącymi grami, statystyki gracza bez zmian po sesji.

**Poza zakresem:** front (P47), wpisywanie lotek w tym trybie, procent końcówek na karcie gracza, inne przedziały, ważenie losowania.

## P47: trening „Końcówki” w kreatorze i na ekranie treningu (web)

**Dziś:** kreator (`NewGameForm.tsx`, `game/game-setup.ts`) po wyborze „Trening” pokazuje tryby Free run i Solo 501. Ekran gry (`GameScreen.tsx`) pokazuje klawiaturę, a Free run ma „Zakończ trening” (`EndPracticeDialog`) i podsumowanie (`MatchSummaryPanel`).

**Zmiana:**
1. **Kreator:** trzeci tryb treningu „Końcówki” (opis np. „losowa końcówka, udało się albo nie”), a po jego wyborze wybór przedziału „2-50” albo „51-100” (domyślnie „2-50”), w tym samym stylu co wybór punktów startowych. Podsumowanie ustawień (`GameSetupSummary`) pokazuje tryb i przedział.
2. **Ekran treningu:** zamiast klawiatury duża bieżąca końcówka (np. „43”) z podpowiedzią trasy zamknięcia na 3 lotki z istniejącej funkcji `suggestCheckout` (`game/checkout.ts`, ten sam wygląd kafelków co panel zamknięcia), oraz dwa duże przyciski: „Udało się” (ikona i tekst) i „Nie udało się” (ikona i tekst), co najmniej 44×44 px na telefonie. Kolor nie niesie znaczenia sam. Obok licznik: próby, udane i procent (np. „7 z 12 · 58%”) oraz lista ostatnich prób (końcówka i wynik z ikoną). Cofnij cofa ostatnią próbę. „Zakończ trening” jak w Free run, dostępne od pierwszej próby.
3. **Skróty klawiatury** (jak P34): np. Enter albo „1” = „Udało się”, „0” = „Nie udało się”, Backspace = Cofnij; bez kolizji z istniejącymi skrótami, z podpowiedzią w `title` przycisku.
4. **Podsumowanie po zakończeniu:** liczba prób, udane, procent i lista wszystkich prób (końcówka i wynik z ikoną).
5. **Historia i niedokończone gry:** wiersz pokazuje tryb, przedział i wynik („Końcówki 2-50 · 7/12 · 58%”); niedokończoną sesję da się wznowić jak Free run.
6. **Głos:** bez komunikatów w tym trybie.
7. **RWD:** końcówka, przyciski i licznik mieszczą się bez przewijania na 375×812 i 768×1024, bez poziomego przewijania; na monitorze układ jak ekran gry (lewa kolumna z licznikiem, prawa z końcówką i przyciskami).

**Testy:** kreator (trzeci tryb, wybór przedziału, wysłane `practiceMode` i przedział), ekran treningu (końcówka i trasa, przyciski wysyłają próbę, licznik i procent, Cofnij, skróty, „Zakończ trening”), podsumowanie (liczby i lista prób), wiersz Historii, brak klawiatury w tym trybie. Zrzuty ekranu przy 375×812, 768×1024 i 1920×1080 w opisie PR-a.

**Poza zakresem:** zmiany w serwerze i silniku (P46), wpisywanie lotek, odczyt końcówki głosem, ranking najczęściej nieudanych końcówek, statystyki końcówek na karcie gracza, wybór przedziału w trakcie sesji.
