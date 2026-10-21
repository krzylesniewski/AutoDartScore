# P36-P40: kolor gracza, unikalne imiona, blokada meczu, kolejka i czas lega, ekran Ustawienia

Feedback graczy z 2026-10-21 (`feedback-graczy.md`), decyzje autora z tego samego dnia. Wspólne zasady z `design/rwd.md` i kryteria stabilności klawiatury z P31 (`design/plan-p31-p32.md`) obowiązują dalej: nowe elementy ekranu gry nie zmieniają położenia ani rozmiaru klawiatury w trakcie gry. Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts`, typy i DTO tylko z `packages/schema`, kolor nigdy sam nie niesie znaczenia. Silnik zostaje bez czasu systemowego: czas dokłada serwer z logu zdarzeń.

Kolejność: P36 → P37 (oba zmieniają profil gracza), P38 → P39 → P40 (snapshot, ekran gry, klawiatura). P39 i P40 czekają też na P34, który zmienia `Keypad` i `TurnPanel`.

## P36: stały kolor awatara z wyborem z 16 (schema, server, web)

**Feedback:** „kolory w awatarach różnią się w zależności od zakładki. Dodaj prosty kolor picker z 16 kolorów podczas tworzenia usera i edycji”.

**Przyczyna:** `Avatar` dostaje `colorIndex`, czyli pozycję gracza na liście danego ekranu (`HomeScreen`, `StatsScreen`, `MatchEndView` i inne), a kolor to ta pozycja modulo 4. Inna lista daje inny kolor.

**Zmiana:**
1. **Tokeny:** 16 kolorów `--color-avatar-1` … `--color-avatar-16` w `design/theme.css` (obecne 4 zostają pod tymi samymi numerami). Każdy z `--color-on-avatar` ma kontrast co najmniej 4.5:1. Kolory wyraźnie różne od siebie i od `--color-accent`.
2. **Schema:** `color: z.int().min(1).max(16)` w `Player` i w graczach snapshotu meczu, statystyk i historii (wszędzie, gdzie front rysuje awatar). W `CreatePlayerRequest` i `UpdatePlayerRequest` pole opcjonalne.
3. **Serwer:** migracja `0004` dodaje kolumnę `color` (nullable) do `players` i `player_changes`. Zmiana koloru to nowy wpis w `player_changes`, jak zmiana imienia. Gracz bez zapisanego koloru (istniejący gracze, goście bez wyboru) dostaje kolor domyślny wyliczony ze swojego `id` (stała, deterministyczna funkcja, np. suma kodów znaków modulo 16 + 1), więc odpowiedzi API zawsze mają `color`. Nowy gracz bez podanego koloru dostaje ten sam kolor domyślny.
4. **Front:** `Avatar` przyjmuje `color` (1-16) zamiast `colorIndex`; wszystkie ekrany biorą kolor z gracza. Wybór koloru przy tworzeniu gracza („+ Nowy gracz” w kreatorze) i przy edycji (`PlayerProfile`): 16 okrągłych próbek jako grupa radio z polskimi nazwami kolorów w `aria-label`, zaznaczona próbka ma ramkę i znacznik ✓, podgląd awatara obok. Próbki co najmniej 44×44 px na telefonie.

**Testy:** schema (zakres 1-16, pole opcjonalne w żądaniach); serwer (migracja na bazie z istniejącymi graczami, kolor domyślny stały dla tego samego `id`, zapis i zmiana koloru, kolor w snapshocie meczu i w statystykach); front (ten sam gracz ma ten sam kolor na ekranie startowym, w grze, w statystykach i na końcu meczu; wybór koloru w kreatorze i w edycji wysyła `color`).

**Poza zakresem:** własny kolor spoza 16, zdjęcie jako avatar, zmiana `--color-on-avatar`.

## P37: unikalne imiona graczy (schema, server, web)

**Zależy od:** P36.

**Feedback:** „da się utworzyć userów o tych samych nazwach”.

**Decyzja 2026-10-21:** blokujemy duplikat.

**Zmiana:**
1. **Reguła:** dwa niezarchiwizowane profile (nie goście) nie mogą mieć tego samego imienia. Porównanie po normalizacji: obcięte spacje na brzegach, wiele spacji w środku jak jedna, bez wielkości liter (`toLocaleLowerCase('pl')`). Goście nie są sprawdzani i nie blokują imion. Zarchiwizowani nie blokują imion.
2. **Serwer:** `POST /players` (bez `guest`), `PATCH /players/:id` ze zmianą imienia, zapisanie gościa (`guest: false`) i przywrócenie z archiwum (`archived: false`) zwracają 409 `player_name_taken`, gdy imię jest zajęte przez innego gracza. Zmiana wielkości liter własnego imienia jest dozwolona. Sprawdzenie i zapis w jednej transakcji. Bez ograniczenia `unique` w bazie (istniejące duplikaty zostają, a gracze z tym samym imieniem mogą już być w danych): przy takim konflikcie blokujemy tylko kolejne zmiany, które tworzą duplikat.
3. **Kod błędu:** `player_name_taken` w tabeli błędów serwera i w `packages/schema`, jeśli tam są kody błędów.
4. **Front:** kreator i edycja gracza pokazują przy polu imienia komunikat „Gracz o imieniu „…” już istnieje” (z ikoną, nie tylko kolorem) i nie zamykają formularza. Przed wysłaniem front może też sprawdzić imię na znanej liście graczy, ale źródłem prawdy jest odpowiedź serwera.

**Testy:** serwer (duplikat przy tworzeniu, przy zmianie imienia, przy zapisaniu gościa i przy przywróceniu z archiwum; inna wielkość liter i spacje to duplikat; gość i zarchiwizowany nie blokują; zmiana wielkości liter własnego imienia przechodzi); front (komunikat w kreatorze i w edycji, formularz zostaje otwarty).

**Poza zakresem:** scalanie istniejących duplikatów, unikalność między kontami online.

## P38: zakończony mecz tylko do odczytu po 5 minutach (schema, server, web)

**Feedback:** „Zakończonego meczu po jakimś czasie nie powinno dać się już zmienić”.

**Decyzja 2026-10-21:** Cofnij działa jeszcze 5 minut po rzutce kończącej grę, potem gra jest zamknięta.

**Zmiana:**
1. **Czas zakończenia:** serwer wylicza `finishedAt` = `receivedAt` rzutki, która zakończyła grę (ostatnia rzutka, która nadal się liczy, gdy gra jest zakończona). Dotyczy meczu 1v1, zabawy i Solo 501. Zakończony trening Free run ma już `endedAt` i undo jest w nim zablokowane jak dziś.
2. **Snapshot:** nowe pola `finishedAt` (ISO albo `null`) i `editableUntil` (ISO albo `null`: `finishedAt` + czas blokady, `null` dla gry w toku).
3. **Serwer:** `POST /matches/:id/undo` dla zakończonej gry, gdy bieżący czas serwera jest po `editableUntil`, zwraca 409 `match_locked` i nic nie dopisuje do logu. Czas blokady z `AUTOSCORE_MATCH_LOCK_MINUTES` (domyślnie 5, `0` = blokada od razu, wartość niepoprawna = błąd startu jak przy `PORT`). Zegar wstrzykiwany do serwisu, żeby testy nie czekały. Blokada nie jest zdarzeniem w logu: nic się nie zmienia w stanie, serwer tylko odrzuca zmianę.
4. **Front:** na ekranie końca gry „Cofnij” jest aktywne do `editableUntil` (z pozostałym czasem, np. „Cofnij (4:12)”), potem nieaktywne z tekstem „Mecz zamknięty, nie można go już zmienić” i ikoną kłódki. Odpowiedź 409 `match_locked` pokazuje ten sam komunikat. Czas porównywany z zegarem urządzenia tylko do wyświetlania; decyduje serwer.
5. **Dokumentacja:** nowa zmienna w `README.md` i `deploy/README.md` (lista zmiennych środowiskowych).

**Testy:** serwer (undo w zakończonym meczu przed i po 5 minutach, zabawa i Solo 501, `AUTOSCORE_MATCH_LOCK_MINUTES` z `0` i z wartością niepoprawną, `finishedAt` i `editableUntil` w snapshocie, po udanym undo w oknie gra wraca do toku i `finishedAt` znika); front (licznik na przycisku, przycisk nieaktywny po czasie, komunikat po 409).

**Poza zakresem:** weryfikacja i ręczna korekta rzutek w zamkniętym meczu (do decyzji przy kroku 7, zasady 5 i 7), ręczne „zamknij mecz”, zmiany w statystykach.

## P39: numer kolejki i czas lega na ekranie gry (engine, schema, server, web)

**Zależy od:** P38 (snapshot i czasy z logu), P34 (`TurnPanel`).

**Feedback:** „W widoku trwającego lega trzeba by gdzieś pokazać, która to już jest kolejka i może czas trwania”.

**Decyzja 2026-10-21:** czas lega na żywo, czas meczu w podsumowaniu; tura z bustem to też kolejka; przerwa między porzuceniem a wznowieniem gry nie wlicza się do czasu.

**Zmiana:**
1. **Kolejka:** numer tury rzucającego w bieżącym legu, od 1 (pierwsza tura gracza w legu = kolejka 1; tura z bustem też się liczy). W meczu 1v1 i w zabawie wszyscy grający mają ten sam numer w danej rundzie; gracz, który wypadł z kolejki w zabawie, nie zmienia numeru pozostałych. Silnik: licznik tur każdego gracza w legu w stanie X01, zabawy i Solo 501, zerowany na początku lega (testy w `engine`).
2. **Snapshot:** `round` (int ≥ 1 albo `null` po końcu gry i w Free run) oraz `legStartedAt` (ISO `receivedAt` pierwszej liczącej się rzutki bieżącego lega albo `null` przed nią) i `startedAt` (pierwsza licząca się rzutka gry albo `null`). W Free run `legStartedAt` to początek sesji.
   - **Przerwy:** `legPausedMs` i `pausedMs` (int ≥ 0): suma przerw od porzucenia (`match_abandoned`) do wznowienia (`match_resumed`) z logu, liczona od `legStartedAt` (dla lega) i od `startedAt` (dla gry). Przerwa, która zaczęła się przed pierwszą rzutką lega, liczy się tylko od `legStartedAt`. Gra może być porzucana i wznawiana wiele razy. W porzuconej grze trwająca przerwa nie jest w sumie, a licznik stoi na czasie porzucenia (`abandonment.at`).
3. **Front, ekran gry:** w nagłówku meczu obok numeru lega etykieta „Kolejka 7” i czas lega „12:34” (powyżej godziny „1:02:03”), odświeżany co sekundę z `legStartedAt` i zegara urządzenia, z ikoną zegara i `aria-label` „Czas lega 12 min 34 s”; licznik nie jest ogłaszany przez czytnik ekranu co sekundę. Czas lega = teraz − `legStartedAt` − `legPausedMs`. Przed pierwszą rzutką lega „0:00”. W porzuconej grze licznik stoi na `abandonment.at` − `legStartedAt` − `legPausedMs`, a po wznowieniu liczy dalej bez przerwy. Free run: tylko czas sesji, bez kolejki. Stała szerokość cyfr (`tabular-nums`), żeby tekst nie przesuwał niczego obok.
4. **Front, koniec gry:** „Czas gry” (`finishedAt` − `startedAt` − `pausedMs`) w podsumowaniu, w miejscu przewidzianym na makiecie końca meczu (`design/rwd.md`, sekcja widoku końca meczu), także dla zabawy i Solo 501.
5. **Stabilność:** pomiary klawiatury z P31 dają ten sam wynik (±1 px) przy zmianie kolejki i tyknięciach licznika.

**Testy:** engine (numer kolejki w 1v1, zabawie z wypadającymi graczami i Solo 501; bust liczy się jako tura; nowy leg zaczyna od 1); serwer (`round`, `legStartedAt`, `startedAt`, `legPausedMs` i `pausedMs` w snapshocie, także po undo pierwszej rzutki lega, przy kilku porzuceniach i wznowieniach oraz przy porzuceniu przed pierwszą rzutką lega; czasy z wstrzykiwanego zegara); front (etykieta kolejki, format czasu, licznik z fałszywym zegarem, zatrzymany licznik w porzuconej grze, „Czas gry” bez przerw na końcu).

**Poza zakresem:** czas w statystykach (np. średni czas lega), ręczna pauza bez porzucenia gry, czas tury.

## P40: ekran Ustawienia (web)

**Zależy od:** P39, P34 (oba zmieniają ekran gry i klawiaturę).

**Feedback:** „czy już jest zaplanowane włączenie w settingsach nowej kołowej albo starej prostokątnej klawiatury”.

**Decyzja 2026-10-21:** wybór układu klawiatury przenosimy do nowego ekranu „Ustawienia”, zamiast przełącznika przy klawiaturze (P33, punkt 3).

**Zmiana:**
1. **Ekran `#/settings`:** pozycja „Ustawienia” w `AppNav` staje się aktywnym linkiem (bez „wkrótce”), widocznym także na telefonie. Ustawienia dotyczą tego urządzenia (tekst pod nagłówkiem: „Zapisane na tym urządzeniu”).
2. **Sekcje:**
   - **Klawiatura:** „Koło” (domyślne) i „Siatka” jako dwie karty wyboru (grupa radio) z małym podglądem układu. Zapis jak dziś: `autoscore.keypadLayout` w `localStorage`.
   - **Dźwięk:** „Głos” i „Efekty” jako przełączniki, te same klucze co dziś (`autoscore.voice`, `autoscore.effects`), domyślnie włączone.
3. **Klawiatura:** przycisk „Siatka” / „Koło” znika z klawiatury; `Keypad` czyta układ z ustawień. Przełącznik głosu w nagłówku gry i na końcu meczu zostaje (CLAUDE.md: gracz wyłącza głos na drugim ekranie) i pokazuje ten sam stan co Ustawienia.
4. Ustawienia działają bez `localStorage` (wartości domyślne, zmiana działa do przeładowania), jak dziś.

**Testy:** nawigacja do ekranu, zmiana układu zapisuje `localStorage` i klawiatura w grze ma wybrany układ, przełączniki głosu i efektów zgodne z przełącznikiem w grze, brak przycisku układu w klawiaturze, niedostępny `localStorage`.

**Poza zakresem:** ustawienia zapisywane na serwerze lub na koncie, tryb „zweryfikuj później”, rotacja kolejki jako ustawienie, siatka w kolejności 1-20.
