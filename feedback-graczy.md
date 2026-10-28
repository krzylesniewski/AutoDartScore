# Feedback od graczy

Uwagi z prawdziwych gier: co przeszkadza, czego brakuje, co się podoba. Plik zbiera surowe zgłoszenia; decyzje i plan zostają w `auto-score-dart-pomysly.md`, a zadania w rolloucie.

## Jak dopisywać

- Nowy wpis na górę sekcji „Wpisy”, jeden wpis na jedną sprawę.
- Słowa gracza zapisuj możliwie dosłownie, bez oceniania. Interpretację dopisz osobno w „Uwagach”.
- Kto zgłosił: imię albo „autor”. Bez danych kontaktowych.
- Gdy wpis trafi do planu, uzupełnij „Status” i link (PR, sekcja planu).
- Przebieg: wpis ze statusem `nowy` → kilka wpisów razem trafia do planu i manifestu rolloutu (`zaplanowany`) → rollout wdraża zmiany, a po scaleniu status `zrobiony` z numerem PR-a. Szczegóły w `CLAUDE.md`, sekcja „Feedback graczy: od zgłoszenia do rolloutu”.

**Rodzaj:** `błąd` · `utrudnienie` · `pomysł` · `pochwała`
**Obszar:** `ekran gry` · `klawiatura` · `głos` · `statystyki` · `kreator` · `historia` · `telefon` · `online` · `inne`
**Status:** `nowy` · `do decyzji` · `zaplanowany` · `zrobiony` · `odrzucony` (z powodem)

### Szablon

```markdown
### RRRR-MM-DD: krótki tytuł
- **Zgłosił:** …
- **Rodzaj / obszar:** … / …
- **Co powiedział:** „…”
- **Kontekst:** urządzenie, typ gry, sytuacja
- **Status:** nowy
- **Uwagi:** …
```

## Wpisy

### 2026-10-28: zakładka „Overall” ze statystykami wszystkich graczy razem
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** pomysł / statystyki
- **Co powiedział:** „W settingsach nowa zakładka overall. I tam liczba lotek całkowita, średnia z 3 całkowita. I może statystyki kto jest powyżej, a kto poniżej”
- **Kontekst:** podsumowanie wszystkich gier, nie jednego gracza
- **Status:** zrobiony (P53, PR #64)
- **Uwagi:** dziś ranking (`#/stats`, `buildRankings` w `packages/server/src/stats/rankings.ts`, `StatsRankings` w `packages/schema/src/stats.ts`) ma już łączną liczbę gier i legów oraz średnią na 3 rzutki każdego gracza (z ukończonych legów, ranking od `MIN_LEGS_FOR_AVERAGE` legów, filtr po typie gry). Brakuje łącznej liczby lotek, łącznej średniej wszystkich graczy i porównania z nią. Kierunek: serwer liczy z tej samej tabeli rzutek (zasada: statystyki z rzutek, nie z liczników) i tym samym filtrem `countsToStats` oraz typem gry; front pokazuje zakładkę z kafelkami i listą graczy podzieloną na „powyżej średniej” i „poniżej średniej”, z różnicą (np. „+4,2”) pokazaną liczbą i znakiem, a nie samym kolorem. Propozycje Claude do tej zakładki: łączne punkty, gry i legi; łączna liczba 180, 140+, 100+ i 60+; łączny % doubli; najczęstsze trafienie wszystkich graczy (jest już `buildFrequentHits` dla jednego gracza w `frequent-hits.ts`); rekordy wszech czasów (najwyższe zakończenie, najkrótszy leg, najwyższa tura) w skrócie z linkiem do rankingu; gracz z największą liczbą lotek („najbardziej zapracowany”); wykres łącznej średniej w czasie (wzór `FormChart`). Decyzje autora 2026-10-28: zakładka „Overall” na ekranie Statystyki, na prawo od „Trening” w przełączniku typu gier (Wszystkie / Mecze 1v1 / Zabawa / Trening / Overall; w zgłoszeniu „settingsy” oznaczały ten przełącznik); średnia ogólna to średnia ze średnich graczy (każdy gracz waży tyle samo); do porównania powyżej/poniżej wchodzą wszyscy gracze, także poniżej progu legów rankingu; na razie z propozycji Claude tylko liczba lotek każdego gracza. Do potwierdzenia przy planowaniu: Overall liczy wszystkie gry wliczane do statystyk razem (jak „Wszystkie”, bez Free run), a gracz bez ukończonego lega nie ma średniej i nie wchodzi do porównania. Decyzja autora 2026-10-28 przy briefie: średnie i różnice z dwoma miejscami po przecinku, jak w rankingu (`formatAverage`).

### 2026-10-28: wyłączanie komentarzy do tury za zero w ustawieniach
- **Zgłosił:** autor
- **Rodzaj / obszar:** pomysł / głos
- **Co powiedział:** „Zmiana w wymaganiach. Komunikaty przy wynikach 0 z trzech lotek w każdym trybie gry powinny mieć opcję wyłączenia ich w settingsach”
- **Kontekst:** wszystkie typy gier, w których czytana jest suma tury
- **Status:** zrobiony (P52, PR #62)
- **Uwagi:** zmiana wymagań względem P51 (PR #59), który miał w „Poza zakresem” „ustawienie wyłączające same komentarze”. Dziś komentarz dokleja `announcementFor` w `packages/audio/src/announcement.ts` (warunek `main.kind === 'score'` i suma 0, losowo `zero_1`/`zero_2`), bez żadnego przełącznika; da się go uciszyć tylko wyłączając cały głos. Kierunek: nowy przełącznik „Komentarze do zera” w sekcji dźwięku na ekranie „Ustawienia” (`SettingsScreen.tsx`, obok `VoiceToggle` i `EffectsToggle`), zapis per urządzenie w localStorage jak głos i efekty (`use-announcer.ts`, np. klucz `autoscore.zeroComments`), a `announcementFor` dostaje opcję pomijającą komentarz. Suma 0 i osiągnięcia czytane dalej. Decyzje autora 2026-10-28: komentarze domyślnie wyłączone (brak wpisu w localStorage oznacza wyłączone, inaczej niż przy głosie i efektach); przy wyłączonym głosie przełącznik jest nieaktywny.

### 2026-10-26: śmieszny komentarz do tury za zero
- **Zgłosił:** autor
- **Rodzaj / obszar:** pomysł / głos
- **Co powiedział:** „A jakieś 2-3 śmieszne komentarze do wyniku zero?”
- **Kontekst:** odczyt wyniku po turze
- **Status:** zrobiony (P51 PR #59, `design/plan-p48-p51.md`)
- **Uwagi:** dziś po turze gra tylko nagranie sumy (`scores/<suma>.mp3`), żarty mają tylko nagrania busta (`events/bust_1..3.mp3`, `packages/audio/src/announcement.ts`). Autor nagrał dwa komentarze w ElevenLabs (`events/zero_1.mp3`, 6,1 s, i `events/zero_2.mp3`, 4,9 s, w `packages/web/public/audio/pl/`). Decyzje autora 2026-10-26: po sumie 0 gra losowo jeden z komentarzy, przy każdej takiej turze (nie przy buście); najpierw suma, potem komentarz, potem ewentualne osiągnięcia; nagrania zostają w obecnej długości. Nagrania do 100, 120, 140 i 180 okazały się nagraniami pierwszych razy i należą do wpisu o osiągnięciach.

### 2026-10-26: osiągnięcia, np. rekord życiowy z 3 lotek
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** pomysł / ekran gry
- **Co powiedział:** „Przydałyby się osiągnięcia. Czyli podczas gry jak gracz rzuci swoją życiową wartość z 3 rzutów”
- **Kontekst:** w trakcie gry
- **Status:** zrobiony (P50 PR #57, P51 PR #59, `design/plan-p48-p51.md`)
- **Uwagi:** dziś najwyższa tura, najwyższy checkout i najlepszy leg są liczone tylko w statystykach, po fakcie (`packages/server/src/stats/tally.ts`, `rankings.ts`); w trakcie gry nic nie porównuje wyniku z rekordem gracza. Kierunek: serwer wykrywa osiągnięcia przy zamknięciu tury i lega i wysyła je na żywo (P50), ekran gry pokazuje komunikat z ikoną i tekstem, a głos czyta nagranie po odczycie wartości (P51). Silnik bez zmian. Osiągnięcia w paczce (autor, 2026-10-26): rekord tury z 3 lotek, rekord checkoutu, najkrótszy leg, najdłuższy leg („trochę złośliwości się przyda”), pierwsze 100+, 120+, 140+ i 180. Nagrania autora z ElevenLabs w `packages/web/public/audio/pl/events/` (`achievement_*.mp3`, `first_*.mp3`). Decyzje autora 2026-10-26: tylko mecze 1v1 i tylko profile (goście bez osiągnięć); od drugiej gry profilu, także pierwsze razy; najdłuższy leg z każdego lega gracza, także przegranego; najpierw wartość, potem komentarz do zera, potem osiągnięcia, wszystko po kolei; nagrania w obecnej długości. Odłożone: rekord średniej w legu i Bull na zamknięcie (brak nagrań). Na później: seria wygranych meczów, licznik meczów (10, 50, 100), seria udanych prób w treningu końcówek.

### 2026-10-26: powtórka tej samej końcówki po nieudanej próbie
- **Zgłosił:** autor
- **Rodzaj / obszar:** pomysł / inne (trening końcówek)
- **Co powiedział:** „Chcę kilka razy próbować jedną końcówkę. Czyli fail, niech nie losuje nowej. Nowa to 3 opcja poniżej”
- **Kontekst:** trening „Końcówki”, po nieudanej próbie
- **Status:** zrobiony (P49 PR #58, `design/plan-p48-p51.md`)
- **Uwagi:** dziś każda próba, udana czy nie, losuje nowy cel: `applyCheckoutAttempt` w `packages/engine/src/checkouts.ts` zawsze woła `nextCheckoutTarget`. Kierunek: po „Nie udało się” cel zostaje, a losowanie nowego idzie do osobnego, trzeciego przycisku pod dwoma obecnymi (`CheckoutActions` w `packages/web/src/components/CheckoutPracticePanel.tsx`). „Nowa końcówka” bez próby to nowe zdarzenie w logu (pominięcie), żeby odtworzenie dawało ten sam cel. Decyzje autora 2026-10-26: po „Udało się” losuje się nowa końcówka, po „Nie udało się” zostaje ta sama; „Nowa końcówka” (skrót N) nie liczy się do licznika prób, Cofnij cofa też ją; stare sesje odtwarzają się jak dziś.

### 2026-10-26: brak efektu kliknięcia w treningu końcówek
- **Zgłosił:** autor
- **Rodzaj / obszar:** utrudnienie / inne (trening końcówek)
- **Co powiedział:** „Brakuje efektu kliknięcia w treningu końcówek”
- **Kontekst:** trening „Końcówki”, przyciski wyniku próby
- **Status:** zrobiony (P48 PR #56, `design/plan-p48-p51.md`)
- **Uwagi:** przyciski „Udało się”, „Nie udało się” i „Cofnij” w `CheckoutActions` (`packages/web/src/components/CheckoutPracticePanel.tsx`) to zwykłe `<button>` bez stanu wciśnięcia i bez mignięcia, a klawiatura ekranu gry ma oba (`KeypadKey` z `flashOnPress`, P22). Kierunek: ten sam efekt wciśnięcia co na klawiaturze, z tokenów motywu.

### 2026-10-26: trening „Końcówki”
- **Zgłosił:** autor
- **Rodzaj / obszar:** pomysł / kreator
- **Co powiedział:** „W sekcji nowa gra, trening, przygotuj nowy tryb gry: końcówki. I tam powinna się losować końcówka lega w dwóch przedziałach: 0-50 i 51-100. I podczas treningu zaznaczam, czy mi się udało, czy nie. Jest to trening per osoba”
- **Kontekst:** kreator gry, trening jednego gracza
- **Status:** zrobiony (P46 PR #53, P47 PR #54, `design/plan-p46-p47.md`)
- **Uwagi:** dziś trening ma tylko Free run i Solo 501 (`PracticeMode` w `packages/schema/src/match.ts`). Silnik nie losuje, więc serwer losuje ziarno przy tworzeniu gry, a silnik wylicza z niego kolejne końcówki deterministycznie (ta sama końcówka po odświeżeniu i na drugim ekranie). Wynik próby to nowe zdarzenie w logu. Decyzje autora 2026-10-26: przedział wybierany w kreatorze (2-50 albo 51-100, od 2, bo 0 i 1 nie da się zamknąć); jedna tura (3 lotki) na końcówkę, bez wpisywania lotek; przyciski „Udało się” i „Nie udało się”; sesja bez limitu do „Zakończ trening”, z licznikiem prób i procentem udanych; nie wchodzi do statystyk X01.

### 2026-10-26: wykres zejścia z wyniku na podsumowaniu gry
- **Zgłosił:** autor
- **Rodzaj / obszar:** pomysł / statystyki
- **Co powiedział:** „Nowy wykres na widoku zakończonej gry/podsumowanie. Pod Leg 1 wykres, na którym są stan punktów, a na poziomej ilość lotek. Chcę zobaczyć, jak szybko schodzimy z wyniku”
- **Kontekst:** podsumowanie zakończonej gry, pod kartą lega („Leg 1”)
- **Status:** zrobiony (P45, PR #51, `design/plan-p45.md`)
- **Uwagi:** dziś zakończony mecz 1v1 pokazuje `MatchEndView` (`packages/web/src/components/MatchEndView.tsx`) z kartami legów (`LegCards`), a zakończona zabawa `MatchSummaryPanel`. Oba biorą dane z `GET /matches/:id/summary` (`MatchSummary` w `packages/schema/src/stats.ts`, liczone w `packages/server/src/stats-service.ts` i `stats/tally.ts` ze zdarzeń domenowych). Podsumowanie nie ma przebiegu wyniku. Kierunek: `MatchSummary` rozszerzone o przebieg ostatniego lega (wynik każdego gracza po każdej lotce, z oznaczeniem bustu), liczony na serwerze przez odtworzenie zdarzeń, i wykres SVG na froncie bez nowej biblioteki (wzór: `FormChart`). Zakończona gra otwarta z Historii trafia do tych samych widoków. Decyzje autora 2026-10-26: wszyscy gracze lega na jednym wykresie, każdy swoją linią (kolor awatara plus legenda z imieniem); oś pionowa to pozostały wynik, oś pozioma to dokładna liczba lotek, punkt po każdej lotce; przy buście linia wraca do wyniku sprzed tury, ze znacznikiem „Bust”; wykres tylko dla ostatniego lega; mecz 1v1 i zabawa tak, trening (Solo 501 i Free run) bez wykresu. Opis także w `auto-score-dart-pomysly.md` (sekcja „Wykres zejścia z wyniku na podsumowaniu gry”).

### 2026-10-22: podpowiedź zamknięcia z T1 zamiast pojedynczej 3
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** utrudnienie / ekran gry
- **Co powiedział:** „co do zakończeń: jak mam 43 punkty do końca, to nie pokazuj T1 D20, tylko 3 + D20”
- **Kontekst:** panel zamknięcia na ekranie gry (np. 43 do końca, początek tury)
- **Status:** zaplanowany (P44, `design/plan-p43-p44.md`; decyzja autora 2026-10-22: przegląd wszystkich tras według jawnych reguł)
- **Uwagi:** przyczyna w kodzie: `suggestCheckout` (`packages/web/src/game/checkout.ts`) bierze pierwszą pasującą rzutkę przygotowującą z listy `SETUP`, a ta zaczyna się od trebli (T20…T1), dopiero potem są single. Gdy przygotowanie to wielokrotność 3 do 18, wygrywa mała trebla zamiast singla o tej samej wartości. Dotyczy 19 wyników: 7 (T1 D2), 11, 15, 19, 23, 27, 35 (T1 z D4…D16), 43-58 co 3 (T1…T6 D20) i 103-118 co 3 (T20 T1…T6 D20). Kierunek poprawki: rzutka przygotowująca o wartości do 20 to singiel (43 → 3 D20, 46 → 6 D20, 106 → T20 6 D20), trebla tylko powyżej 20; reszta tras bez zmian. Panel i Enter (P34) korzystają z tej samej trasy (`checkoutRoute`), więc zmiana obejmie oba. Singiel już dziś wyświetla się jako sama liczba („3”), bez „S”. Decyzja autora 2026-10-22: „3 + D20” to tylko przykładowy zapis, wygląd panelu zostaje bez zmian (osobne kafelki, singiel jako sama liczba); zmienia się tylko wybór rzutki przygotowującej. Decyzja autora 2026-10-22: przeglądamy wszystkie trasy według jawnych reguł (plan P44).

### 2026-10-22: przewijanie karty gracza działa tylko nad danymi
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** błąd / statystyki
- **Co powiedział:** „W szczegółach statystyk dla jednej osoby scroll działa tylko, jak masz kursor nad danymi. Popraw tak, żeby działał nie ważne, gdzie jest”
- **Kontekst:** karta gracza (`#/stats/:id`), monitor lub laptop z myszą, kursor na pustym marginesie obok kolumny z danymi
- **Status:** zaplanowany (P43, `design/plan-p43-p44.md`)
- **Uwagi:** przyczyna w kodzie: na karcie gracza przewija się `<main>` z `mx-auto max-w-4xl overflow-auto` (`PlayerCard` w `packages/web/src/screens/StatsScreen.tsx`), czyli tylko wyśrodkowana kolumna o szerokości 896 px. Kółko myszy nad pustymi marginesami po bokach nic nie przewija. Kierunek poprawki: `<main>` na całą szerokość pod paskiem nawigacji jako element przewijany (`flex-1 overflow-auto`), a w nim wyśrodkowana kolumna `mx-auto max-w-4xl` z dotychczasowymi odstępami. Testy do dopasowania: „scales the player card…” w `StatsScreen.test.tsx` sprawdza odstępy na `<main>`. Ranking (`#/stats`) i Historia mają `<main>` na całą szerokość, więc ich to nie dotyczy.

### 2026-10-22: zniknęła opcja porzucenia partii
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** błąd / ekran gry
- **Co powiedział:** „zniknęła opcja porzucenia partii, albo nie możemy jej znaleźć”
- **Kontekst:** ekran gry w trakcie meczu, po zmianie domyślnych ustawień na 301 i best of 1 (P32)
- **Status:** zrobiony (P41, PR #45, `design/plan-p41-p42.md`; decyzje autora 2026-10-22: porzucenie meczu i zabawy od startu gry, także przed pierwszą rzutką; trening (Free run i Solo 501) tylko z „Zakończ trening”; porzucona gra bez ukończonego lega nie liczy się do statystyk; na telefonie przycisk zostaje w menu, a porzucić grę można też z ekranu Historia)
- **Uwagi:** przycisk „Porzuć mecz” istnieje, ale pokazuje się tylko po co najmniej jednym ukończonym legu (`canAbandon` w `packages/web/src/game/can-abandon.ts`, reguła od P10): w meczu 1v1 przy `legIndex >= 1`, w zabawie gdy ktoś zajął już miejsce, w treningu nigdy. Od P32 mecz domyślnie ma best of 1, więc jedyny leg kończy mecz i w meczu 1v1 przycisk w praktyce nie pojawia się wcale. Ta sama reguła ukrywa ikonę porzucenia na liście niedokończonych gier na ekranie startowym (`UnfinishedGames.tsx`). Dodatkowo poniżej `lg` przycisk jest schowany w menu gry (ikona ☰ w `MatchHeader.tsx`), więc na telefonie i tablecie w pionie łatwo go przeoczyć. Serwer porzucenia nie ogranicza (komentarz w `can-abandon.ts`). Decyzja autora 2026-10-22: porzucenie od pierwszej rzutki w każdym typie gry, także w treningu (gra bez ukończonego lega też może trafić do porzuconych). Zmiana w `canAbandon` (front) i w testach, serwer już na to pozwala. Do ustalenia przy planowaniu: czy przed pierwszą rzutką też (dziś pusta gra zostaje na liście do dokończenia); jak porzucenie ma się do „Zakończ trening” w Free run (dwa przyciski czy jeden); czy porzucona gra bez ukończonego lega liczy się do statystyk (dziś przerwany leg porzuconego meczu nie wchodzi do średniej ani rankingu). Decyzja autora 2026-10-22 (telefon): „Porzuć mecz” nie wychodzi z menu gry; zamiast tego porzucenie ma być dostępne także z ekranu Historia (dziś `HistoryScreen.tsx` go nie ma, jest tylko ikona na liście niedokończonych gier na ekranie startowym), z tym samym oknem `AbandonDialog`.

### 2026-10-22: więcej niż top 3 w kafelkach rankingu statystyk
- **Zgłosił:** autor
- **Rodzaj / obszar:** pomysł / statystyki
- **Co powiedział:** „zobacz jeszcze, czy to celowo w statystykach pokazujemy top 3? Bo jeśli tak, zwiększyłbym to do top 5 albo nawet 10. Jak się nie zmieści, to dodałbym scrolla”
- **Kontekst:** ekran statystyk, ranking (kafelki obok listy średnich)
- **Status:** zrobiony (P42, PR #44, `design/plan-p41-p42.md`; decyzja autora 2026-10-22: top 5, przewijanie w kafelku jak dziś tylko od `xl`, bez wyróżnienia podium, próg „za mało graczy” zostaje na 3)
- **Uwagi:** tak, celowo: top 3 jest od pierwszej wersji ekranu statystyk (P10, makieta motywu A, `design/mockups/theme-a-stats.png`) i potem potwierdzone w `design/stats-highest-turn.md` („Ranking top 3”). Dotyczy tylko czterech kafelków: najlepsza średnia lega, najwyższe zakończenie, najkrótszy leg, najwyższa tura. Lista średnich po lewej pokazuje już wszystkich graczy z przewijaniem. Limit jest w serwerze (`const TOP = 3` w `packages/server/src/stats/rankings.ts`, remisy dzielą miejsce, więc wpisów może być więcej niż 3), schema go nie ogranicza. Front ma przewijanie w kafelku tylko od `xl` (`xl:overflow-y-auto` w `RankingBoard.tsx`), a komunikat „za mało graczy” pokazuje się przy mniej niż 3 wpisach (stała 3 też w `RankingBoard.tsx`). Do decyzji: 5 czy 10; przewijanie w kafelku na wszystkich szerokościach czy tylko na monitorze (na telefonie kafelki są jeden pod drugim, więc 10 wierszy × 4 kafelki to długa strona); czy wyróżnić podium (1-3) na tle reszty; czy próg „za mało graczy” zostaje na 3.

### 2026-10-21: wybór klawiatury kołowej albo starej prostokątnej w ustawieniach
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** pomysł / klawiatura
- **Co powiedział:** „czy już jest zaplanowane włączenie w settingsach nowe kołowej albo starej prostokątnej klawiatury”
- **Kontekst:** po zaplanowaniu klawiatury po kole (P33)
- **Status:** zaplanowany (P40, `design/plan-p36-p40.md`; decyzja 2026-10-21: wybór układu na nowym ekranie „Ustawienia” zamiast przełącznika przy klawiaturze, bez wariantu 1-20)
- **Uwagi:** P33 ma przełącznik „Koło” / „Siatka”, ale różni się od prośby w dwóch miejscach: (1) przełącznik jest małym przyciskiem w obrębie klawiatury, zapamiętanym na urządzeniu (`localStorage`, `autoscore.keypadLayout`), a nie w ustawieniach, bo ekranu „Ustawienia” jeszcze nie ma (w `AppNav.tsx` jest nieaktywna pozycja „Ustawienia · wkrótce”); (2) „Siatka” to nie stara klawiatura: liczby są w kolejności z tarczy, a nie 1-20, do tego duży Miss, „Reszta Miss” i osobne 25 i Bull. Do decyzji: czy zostawić siatkę z kolejnością z tarczy, czy dodać trzeci wariant ze starą kolejnością 1-20 (albo przełącznik kolejności w siatce); czy wybór ma trafić do ekranu „Ustawienia” (wtedy razem z innymi ustawieniami urządzenia, np. głosem), czy wystarczy przełącznik przy klawiaturze. Zmiana przed startem P33 to tylko poprawka planu.

### 2026-10-21: czas trwania lega na ekranie gry
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** pomysł / ekran gry
- **Co powiedział:** „W widoku trwającego lega trzeba by gdzieś pokazać […] może czas trwania”
- **Kontekst:** ekran gry w trakcie lega
- **Status:** zaplanowany (P39, `design/plan-p36-p40.md`; decyzja 2026-10-21: czas lega na żywo, czas gry w podsumowaniu, bez przerw między porzuceniem a wznowieniem)
- **Uwagi:** dziś ekran gry nie pokazuje czasu. Czas trwania meczu był już świadomie wyłączony z zakresu ekranu końca meczu („Poza zakresem” w `design/rwd.md`, makieta ma to pole). Dane są: każdy wpis w logu zdarzeń ma `created_at`, a snapshot ma `createdAt`, więc czas da się wyliczyć w serwerze lub froncie (silnik bez czasu systemowego). Do decyzji: czas lega czy całego meczu (albo oba); od czego liczyć (utworzenie meczu czy pierwsza rzutka lega); co z przerwą przy porzuceniu i wznowieniu; licznik na żywo czy tylko w podsumowaniu; gdzie na ekranie, żeby nie przesuwać klawiatury (P31). Warto połączyć z czasem na ekranie końca meczu.

### 2026-10-21: numer kolejki na ekranie gry
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** pomysł / ekran gry
- **Co powiedział:** „W widoku trwającego lega trzeba by gdzieś pokazać, która to już jest kolejka”
- **Kontekst:** ekran gry w trakcie lega
- **Status:** zaplanowany (P39, `design/plan-p36-p40.md`; decyzja 2026-10-21: kolejka = numer tury rzucającego w legu, tura z bustem też się liczy)
- **Uwagi:** dziś ekran gry nie pokazuje numeru kolejki (w planie, makietach i kodzie `web` brak takiego pola). „Kolejka” rozumiana jako runda: każdy grający rzucił raz po 3 rzutki (do potwierdzenia z graczami). Numer wynika z odtworzenia rzutek lega, więc nie wymaga nowego zapisu. Do decyzji: liczyć w silniku i oddawać w snapshocie (schema) czy we froncie; jak liczyć w zabawie, gdy gracze wypadają z kolejki; czy pokazywać w Free run; miejsce na ekranie bez przesuwania klawiatury (P31), np. przy etykiecie „Kolejka rzutów” lub numerze lega.

### 2026-10-21: zakończonego meczu nie powinno dać się zmienić po czasie
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** utrudnienie / historia, ekran gry
- **Co powiedział:** „Zakończonego meczu po jakimś czasie nie powinno dać się już zmienić”
- **Kontekst:** mecz po wygranej (ekran końca meczu)
- **Status:** zaplanowany (P38, `design/plan-p36-p40.md`; decyzja 2026-10-21: Cofnij jeszcze 5 minut po rzutce kończącej grę)
- **Uwagi:** dziś `POST /matches/:id/undo` blokuje tylko mecz porzucony i zakończony trening, a mecz wygrany cofa bez limitu czasu (`match-service.ts:199-221`, nie ma sprawdzenia `isGameFinished`). Ekran końca meczu ma przycisk Cofnij (`MatchEndView.tsx:207-238`). Cofnięcie ostatniej rzutki „odkończa” mecz, więc zmienia wynik i statystyki (np. wygrane mecze, head-to-head) nawet długo po grze. Do decyzji: po jakim czasie mecz się zamyka (np. kilka minut po `match_won`, przy starcie następnej gry albo po wyjściu z ekranu końca meczu); czy liczyć czas od zdarzenia w logu (silnik bez czasu systemowego, więc sprawdzenie w serwerze); co z weryfikacją rzutek (`verify`) i ręczną korektą w zamkniętym meczu (zasada 5 i 7); czy zamknięcie to jawne zdarzenie w logu (zasada 4); komunikat w UI zamiast aktywnego przycisku Cofnij.

### 2026-10-21: kolor awatara zmienia się między zakładkami
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** błąd / inne (awatary na wszystkich ekranach)
- **Co powiedział:** „kolory w awatarach różnią się w zależności od zakładki. Dodaj prosty kolor picker z 16 kolorów podczas tworzenia usera i edycji”
- **Kontekst:** ten sam gracz na ekranie startowym, w grze, w statystykach i na końcu meczu
- **Status:** zaplanowany (P36, `design/plan-p36-p40.md`)
- **Uwagi:** przyczyna w kodzie: gracz nie ma zapisanego koloru. `Avatar` dostaje `colorIndex`, czyli pozycję gracza na liście danego ekranu (np. `known.findIndex` w `HomeScreen.tsx:81` i `StatsScreen.tsx:160`, kolejność w meczu w `MatchEndView.tsx:105`), a kolor to ta pozycja modulo 4 (`--color-avatar-1..4`). Inna lista = inny kolor. Prośba graczy: wybór koloru z 16 przy tworzeniu i edycji gracza. Do rozwiązania przy planowaniu: pole koloru w profilu gracza (schema, zapis w `player_changes`, migracja), 16 tokenów `--color-avatar-*` w `design/theme.css` z kontrastem tekstu na awatarze, domyślny kolor dla istniejących graczy i gości (np. stały, wyliczony z id), wszystkie ekrany biorą kolor z gracza zamiast z pozycji.

### 2026-10-21: można utworzyć graczy o tych samych nazwach
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** błąd / kreator
- **Co powiedział:** „da się utworzyć userów o tych samych nazwach”
- **Kontekst:** dodawanie gracza („+ Nowy gracz” w kreatorze)
- **Status:** zaplanowany (P37, `design/plan-p36-p40.md`; decyzja 2026-10-21: blokada duplikatu bez wielkości liter i spacji, goście i zarchiwizowani nie blokują)
- **Uwagi:** serwer nie sprawdza unikalności imienia: `POST /players` i `PATCH /players/:id` przyjmują dowolne imię, a tabela `players` nie ma ograniczenia na nazwę (jedyne `unique` w migracjach dotyczy `event_id`). Do decyzji: blokować duplikat (np. błąd 409 i komunikat w kreatorze) czy tylko ostrzegać; czy porównywać bez wielkości liter i spacji; jak traktować gości i zarchiwizowanych graczy. Zmiana nazwy nie może dawać duplikatu tak samo jak nowy gracz.

### 2026-10-20: klawiatura na ekranie gry skacze
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** utrudnienie / klawiatura, ekran gry
- **Co powiedział:** „klawiatura na widoku gry skacze. nie da się wygodnie z niej korzystać”
- **Kontekst:** urządzenie i moment skoku nieznane, poprawka obejmuje wszystkie szerokości
- **Status:** zaplanowany (P31, `design/plan-p31-p32.md`)
- **Uwagi:** prawdopodobne przyczyny w kodzie (do potwierdzenia na urządzeniu):
  - `EventBanner` (bust, wygrana) renderuje się pod klawiaturą w tym samym przyklejonym do dołu bloku (`GameScreen.tsx:103-124`), więc na telefonie jego pojawienie się podnosi klawiaturę,
  - panel zamknięcia (`TurnPanel`, np. „D12”) pojawia się i znika zależnie od wyniku (`return null`), co zmienia wysokość nad klawiaturą na tablecie i monitorze,
  - zmiany w pasku wyników (rotacja kolejki) i w blokach porzucenia lub końca treningu nad klawiaturą.
  - Kierunek poprawki: stałe miejsce na baner i panel zamknięcia (zarezerwowana wysokość albo nakładka), żeby klawiatura nie zmieniała położenia.

### 2026-10-20: domyślnie 301 i best of 1 przy nowej grze
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** utrudnienie / kreator
- **Co powiedział:** „default na start nowej gry daj 301 i best of 1”
- **Kontekst:** start nowej gry w kreatorze
- **Status:** zaplanowany (P32, `design/plan-p31-p32.md`)
- **Uwagi:** dziś domyślnie 501 i best of 3: kreator (`INITIAL_SETUP` w `packages/web/src/game/game-setup.ts`) i domyślne wartości API (`CreateMatchRequest` w `packages/schema`). Decyzja dopisana do `CLAUDE.md` (2026-10-20): domyślnie 301 i best of 1.

### 2026-10-20: wyłączenie komentarzy w nagraniach
- **Zgłosił:** autor
- **Rodzaj / obszar:** pomysł / głos
- **Co powiedział:** „pierwsza opcja [w ustawieniach] to wyłączenie tych dodatkowych nagrań komentujących rzuty typu »za dużo dobrego«”
- **Kontekst:** po wdrożeniu nagranych komunikatów (P21)
- **Status:** odrzucony (decyzja autora 2026-10-20: zamykamy temat bez wdrażania, nagrania zostają jak są)
- **Uwagi:** „Za dużo dobrego” to część nagrania busta (`bust_1`); wszystkie trzy nagrania busta mają żart, neutralnego „Bust.” nie ma. Do ustalenia: co grać przy wyłączonych komentarzach, czy wyłączać też emocje w odczycie wyniku, nowa zakładka „Ustawienia”.

### 2026-10-20: z odczytem wyniku gra się lepiej
- **Zgłosił:** autor
- **Rodzaj / obszar:** pochwała / głos
- **Co powiedział:** „po kilku testach bez i z wynikami lepiej gra się, jak wynik jest odtwarzany”
- **Kontekst:** gry na kilku urządzeniach
- **Status:** zrobiony
- **Uwagi:** zniesiono zasadę „audio hosta”: głos i efekty domyślnie włączone na każdym urządzeniu (commit `d1f3317`).

### 2026-10-20: brak reakcji klawiatury na dotyk
- **Zgłosił:** autor
- **Rodzaj / obszar:** utrudnienie / klawiatura
- **Co powiedział:** dotknięcie przycisku na telefonie i tablecie nie daje żadnej reakcji, nie wiadomo, czy trafienie się zapisało
- **Kontekst:** telefon, tablet
- **Status:** zrobiony
- **Uwagi:** stan wciśnięcia i mignięcie po trafieniu (P22, PR #20).

### 2026-10-20: statystyki nieczytelne na telefonie
- **Zgłosił:** autor
- **Rodzaj / obszar:** utrudnienie / statystyki, telefon
- **Co powiedział:** górny pasek zajmuje 3 wiersze, treść nachodzi na pasek, filtry i kafle się zawijają, liczby z kropką
- **Kontekst:** iPhone 375×812, ranking i karta gracza
- **Status:** zrobiony
- **Uwagi:** P23 (PR #21). Do sprawdzenia: procent doubli przy szerokości 640-720 px może wyjść poza kolumnę.
