# P33-P35: klawiatura po kole jak na tarczy

Decyzja 2026-10-21 po dyskusji nad makietą „Klawiatura wpisu: warianty” (warianty M4 na monitor i D na telefon). Dane z 2032 rzutek graczy: Miss 23%, single 67%, double 4%, treble 5%, Bull i 25 2%; najczęstsze trafienia leżą wokół dwudziestki (S1, S20, S18, S5, S12). Gracze klikają głównie w przeglądarce na komputerze (myszka), czasem na telefonie.

Wspólne zasady: `design/rwd.md` i kryteria stabilności z P31 (`design/plan-p31-p32.md`) obowiązują dalej: klawiatura nie zmienia położenia ani rozmiaru w trakcie gry. Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts`, kolor nigdy sam nie niesie znaczenia.

**Kolejność liczb z tarczy** (zgodnie z ruchem wskazówek zegara, od góry): 20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5. Jedna stała w kodzie, używana przez oba układy.

## P33: koło, siatka z kolejnością z tarczy, duży Miss, Reszta Miss (web)

**Zmiana:**
1. **Układ „koło” (domyślny):** 20 okrągłych przycisków na okręgu w kolejności z tarczy, 20 na górze (wyróżniona ramką jaśniejszą niż reszta, żeby od razu złapać orientację). Pozycje liczone z kąta (−90° + i·18°) w procentach rozmiaru kontenera, więc koło skaluje się z dostępnym miejscem. W środku koła dwa przyciski: „25” (25×1) i „Bull” (25×2). Oba działają niezależnie od przełącznika S/D/T i przywracają go do S, jak każde trafienie.
   - **Od `lg` (monitor, tablet poziomo):** po lewej przełącznik S/D/T w pionie, w środku koło (ok. 450 px, przyciski ok. 56 px), po prawej duży przycisk „Miss” (wysoki, w stałym miejscu) i pod nim „Reszta Miss”.
   - **Poniżej `lg` (telefon, tablet pionowo):** przełącznik S/D/T w rzędzie nad kołem, koło na prawie całą szerokość (na 390 px ok. 366 px, przyciski co najmniej 44 px, dziś wychodzi 46 px), pod kołem szeroki „Miss” (3/4 szerokości) i „Reszta Miss”.
2. **Układ „siatka” (alternatywa):** dzisiejsza siatka, ale liczby w kolejności z tarczy (5 kolumn poniżej `lg`, 10 od `lg`), duży „Miss” i „Reszta Miss” jak wyżej. 25 i Bull jako dwa osobne przyciski, jak w kole.
3. **Przełącznik układu:** mały przycisk w obrębie klawiatury (ikona i tekst „Siatka” albo „Koło”, `aria-label`), wybór zapamiętany na urządzeniu w `localStorage` (klucz `autoscore.keypadLayout`, wartości `ring` | `grid`, brak wpisu albo niedostępny `localStorage` = `ring`). Przełączenie nie zmienia stanu gry ani mnożnika.
4. **„Reszta Miss”:** wpisuje Miss za każdą pozostałą rzutkę bieżącej tury (3 minus wpisane), po kolei, każda z własnym `eventId`, przez to samo API co pojedyncza rzutka. Nieaktywny, gdy klawiatura jest nieaktywna. Kolejna rzutka czeka na odpowiedź poprzedniej; błąd przerywa resztę i pokazuje komunikat jak dziś.
5. **Duży „Miss”:** wyraźnie większy niż przyciski liczb, w stałym miejscu w obu układach.
6. **Stabilność (P31):** w żadnym układzie klawiatura nie zmienia położenia ani rozmiaru w trakcie gry; przełączenie układu może zmienić jej wysokość, ale nie w trakcie samego wpisywania.

**Kryteria akceptacji:** headless Chromium przy 375×812, 390×844, 768×1024, 1280×800 i 1920×1080: w układzie „koło” wszystkie przyciski liczb mają co najmniej 44×44 px i nie nachodzą na siebie (prostokąty przycisków rozłączne), cała klawiatura mieści się w widoku bez poziomego przewijania strony, a pomiary stabilności z P31 dają ten sam wynik (±1 px) dla obu układów. Kolejność liczb w DOM (dla czytnika ekranu i klawisza Tab) to kolejność z tarczy od 20.

**Testy:** kolejność z tarczy w obu układach; 25 i Bull niezależne od mnożnika; „Reszta Miss” wysyła tyle Miss, ile brakuje do 3, i nic przy nieaktywnej klawiaturze; przełącznik układu zapisuje i odczytuje `localStorage` (także gdy jest niedostępny); istniejące testy klawiatury dostosowane tylko tam, gdzie zmienia się kolejność lub układ.

**Poza zakresem:** skróty z klawiatury fizycznej i dotykalne zamknięcie (P34), najczęstsze trafienia gracza (P35), zmiany w serwerze.

## P34: skróty klawiaturowe i zamknięcie jednym kliknięciem (web)

**Zależy od:** P33.

**Zmiana:**
1. **Skróty klawiatury fizycznej na ekranie gry:**
   - `Spacja`: Miss.
   - `S`, `D`, `T`: mnożnik (S wraca sam po trafieniu, jak dziś).
   - Cyfry: liczba 1-20. Pierwsza cyfra czeka na drugą do 1 s; `Enter` zatwierdza od razu; cyfra, której nie da się już uzupełnić do 1-20 (np. 3-9), zatwierdza się od razu. `0` po `1` albo `2` daje 10 albo 20.
   - `B`: 25; `Shift+B`: Bull (25×2).
   - `Backspace`: Cofnij.
   - `Enter` bez rozpoczętej liczby: wpisuje pierwszą rzutkę z podpowiedzi zamknięcia (jak kliknięcie, punkt 3).
2. **Bez kolizji z przeglądarką:** spacja i `Enter` nie „klikają” przycisku z fokusem (skrót przejmuje zdarzenie). Skróty nie działają w polach tekstowych, w otwartych oknach dialogowych, przy nieaktywnej klawiaturze i z wciśniętym `Ctrl`, `Cmd` albo `Alt`.
3. **Dotykalne zamknięcie:** panel zamknięcia (np. „D12”) jest przyciskiem, który wpisuje pierwszą rzutkę z podpowiedzi. Tekst „Kliknij albo Enter, aby wpisać D12” (na dotyku: „Dotknij, aby wpisać D12”).
4. **Podpowiedzi skrótów na przyciskach:** od `lg` małe etykiety klawiszy (S, D, T, B, Spacja, Backspace) na odpowiednich przyciskach; poniżej `lg` ukryte.
5. Wpis ze skrótu daje ten sam efekt wciśnięcia i mignięcia przycisku co kliknięcie (P22).

**Testy:** każdy skrót, łączenie cyfr (1→0 = 10, 2→0 = 20, 3 od razu, 1 po 1 s = 1, 1+Enter = 1), spacja nie klika przycisku z fokusem, brak reakcji w polu tekstowym, w oknie dialogowym, przy nieaktywnej klawiaturze i z modyfikatorami, `Enter` i kliknięcie zamknięcia wpisują pierwszą rzutkę podpowiedzi.

**Poza zakresem:** zmiana układu klawiatury, konfiguracja skrótów.

## P35: najczęstsze trafienia rzucającego (schema, server, web)

**Zależy od:** P33.

**Zmiana:**
1. **API:** `GET /players/:id/frequent-hits` zwraca do 6 najczęstszych trafień gracza (bez Miss) z gier liczonych do statystyk, w kolejności od najczęstszego (remis: wyższa wartość punktowa, potem segment), z liczbą wystąpień. Typy `FrequentHit` i `FrequentHitsResponse` w `packages/schema`. Liczone z rzutek, które nadal się liczą (cofnięte pominięte), jak reszta statystyk. Gracz bez rzutek: pusta lista. Wymaga tokena jak inne trasy.
2. **Front:** rząd „Najczęstsze: <imię>” z przyciskami trafień rzucającego (np. S20, S1, T20). Od `lg` obok „Miss” (w kole) albo nad siatką; poniżej `lg` w kole pomijany (brak miejsca), w siatce nad liczbami. Lista pobierana przy zmianie rzucającego i po zakończonej grze; brak danych albo błąd: rząd się nie pokazuje, a klawiatura nie zmienia położenia (miejsce zarezerwowane albo rząd poza blokiem klawiatury).
3. Kliknięcie wpisuje dokładnie to trafienie (z mnożnikiem), niezależnie od przełącznika S/D/T, i przywraca go do S.

**Testy:** schema (kształt odpowiedzi), serwer (kolejność, remisy, pominięcie Miss, cofniętych rzutek i gier spoza statystyk, pusty gracz, 404 dla nieznanego gracza, 401 bez tokena przy włączonym haśle), front (rząd dla rzucającego, zmiana gracza, wpis trafienia, brak rzędu przy pustej liście i błędzie).

**Poza zakresem:** personalizacja kolejności liczb, statystyki trafień na ekranie statystyk.
