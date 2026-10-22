# P43-P44: przewijanie karty gracza, trasy podpowiedzi zamknięcia

Feedback graczy z 2026-10-22 (`feedback-graczy.md`), decyzje autora z tego samego dnia. Wspólne zasady z `design/rwd.md` i kryteria stabilności klawiatury z P31 (`design/plan-p31-p32.md`) obowiązują dalej. Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts`, typy i DTO tylko z `packages/schema`, kolor nigdy sam nie niesie znaczenia.

Kolejność: P43 i P44 są niezależne i mogą iść równolegle.

## P43: przewijanie karty gracza na całej szerokości (web)

**Feedback:** „W szczegółach statystyk dla jednej osoby scroll działa tylko, jak masz kursor nad danymi. Popraw tak, żeby działał nie ważne, gdzie jest”.

**Przyczyna:** na karcie gracza (`#/stats/:id`, `PlayerCard` w `packages/web/src/screens/StatsScreen.tsx`) elementem przewijanym jest `<main>` z `mx-auto max-w-4xl overflow-auto`, czyli tylko wyśrodkowana kolumna o szerokości 896 px. Na szerszym ekranie kółko myszy nad pustymi marginesami po bokach nic nie przewija.

**Zmiana:**
1. `<main>` karty gracza zajmuje całą szerokość i wysokość pod paskiem nawigacji i jest elementem przewijanym (`flex min-h-0 flex-1 flex-col overflow-auto`, bez `max-w-*` i bez `mx-auto`).
2. W nim jedna wyśrodkowana kolumna z dotychczasową treścią i odstępami (`mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6`). Wygląd karty się nie zmienia: ta sama szerokość kolumny, te same odstępy, ta sama kolejność sekcji.
3. Pasek przewijania jest przy prawej krawędzi okna, a nie przy kolumnie.
4. Ranking (`#/stats`) i Historia już mają `<main>` na całą szerokość. Nie zmieniają się.

**Testy:** front (`<main>` karty gracza ma `overflow-auto` i nie ma `max-w-4xl`; kolumna wewnątrz ma `mx-auto` i `max-w-4xl` oraz odstępy `p-4 sm:p-6`; istniejący test „scales the player card and keeps long names inside the chips” sprawdza odstępy na kolumnie zamiast na `<main>`). Sprawdzenie w headless Chromium przy 1280×800 i 1920×1080: zdarzenie kółka myszy (`Input.dispatchMouseEvent` typu `mouseWheel`) nad lewym marginesem, poza kolumną, zwiększa `scrollTop` elementu `<main>`; bez poziomego przewijania strony przy 375×812. Wyniki w opisie PR-a.

**Poza zakresem:** zmiany w układzie sekcji karty gracza, przewijanie rankingu na monitorze (kafelki i lista mają własne przewijanie od `xl`), ekran Historia.

## P44: trasy podpowiedzi zamknięcia, singiel zamiast małej trebli (web)

**Feedback:** „co do zakończeń: jak mam 43 punkty do końca, to nie pokazuj T1 D20, tylko 3 + D20”.

**Decyzje 2026-10-22:**
- „3 + D20” to tylko przykładowy zapis. Wygląd panelu zamknięcia zostaje bez zmian (osobne kafelki, singiel jako sama liczba, np. „3”).
- Przeglądamy wszystkie trasy według jawnych reguł poniżej, a nie tylko małe treble.

**Przyczyna:** `suggestCheckout` (`packages/web/src/game/checkout.ts`) bierze pierwszą pasującą rzutkę przygotowującą z listy `SETUP`, która zaczyna się od trebli (T20…T1), a single są dalej. Przygotowanie o wartości 3, 6, 9, 12, 15 albo 18 dostaje małą treblę zamiast singla. Dotyczy dziś 19 wyników: 7, 11, 15, 19, 23, 27, 35, 43-58 co 3 i 103-118 co 3.

**Reguły wyboru trasy** (w tej kolejności; pierwsza reguła, która rozstrzyga, wygrywa):
1. **Najmniej rzutek.** Trasa zamyka w najmniejszej możliwej liczbie rzutek, nie większej niż liczba rzutek zostałych w turze (jak dziś).
2. **Kończący double** w obecnej kolejności preferencji: D20, D16, D18, D12, D10, D8, D14, D6, D4, D2, potem nieparzyste D19, D17, D15, D13, D11, D9, D7, D5, D3, D1, na końcu Bull (lista `FINISHING`, bez zmian).
3. **Rzutka przygotowująca o wartości 1-20 to singiel tego pola** (np. 3, 6, 18), nigdy trebla ani double o tej samej wartości.
4. **Wartość 21-60:** trebla, gdy wartość dzieli się przez 3 (np. 57 = T19, 60 = T20); 25 to zewnętrzny bull („25”); 50 to Bull; pozostałe parzyste wartości do 40 to double (np. 22 = D11, 34 = D17).
5. **Dwie rzutki przygotowujące** (trasa na 3 rzutki): pierwsza z najwyższą treblą, która pozwala dokończyć trasę według reguł 2-4 (jak dziś: T20, potem T19…), druga według reguł 3 i 4.
6. Trasa jest deterministyczna: ta sama liczba punktów i rzutek zawsze daje tę samą podpowiedź.

**Zmiana:**
1. `suggestCheckout` wybiera trasę według reguł 1-6. Sygnatura (`remaining`, `dartsLeft`) i typ wyniku (`Hit[] | null`) bez zmian, panel zamknięcia (`TurnPanel`), Enter z P34 i `checkoutRoute` bez zmian.
2. Komentarz w `checkout.ts` streszcza reguły i odsyła do tej sekcji.
3. **Opis PR-a:** tabela wszystkich wyników 2-170 dla 3 rzutek w turze, w których trasa się zmieniła (wynik, trasa przed, trasa po), oraz liczba wyników bez zmian.

**Testy:**
- 43 → `3 D20`, 46 → `6 D20`, 58 → `18 D20`, 7 → `3 D2`, 35 → `3 D16`, 106 → `T20 6 D20`, 118 → `T20 18 D20`.
- Trasy, które reguły zostawiają bez zmian: 170 → `T20 T20 Bull`, 100 → `T20 D20`, 110 → `T20 Bull`, 40 → `D20`, 50 → `Bull`, 2 → `D1`.
- Dla każdego wyniku 2-170 i każdej liczby rzutek 1-3: suma punktów trasy równa się wynikowi, ostatnia rzutka to double albo Bull, liczba rzutek jest minimalna (istniejący test z `minimalDarts`), a żadna rzutka przygotowująca o wartości 1-20 nie jest treblą ani doublem.
- Brak trasy (np. 169, 1 rzutka przy 41) zwraca `null` jak dziś.

**Poza zakresem:** wygląd panelu zamknięcia, znak „+” między rzutkami, trasy zależne od gracza (ulubione double), podpowiedź „zostaw sobie double” po pudle, zmiany w serwerze i silniku.
