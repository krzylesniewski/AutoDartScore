# Etap 5: turnieje (T1-T19)

Źródło: rozmowa z autorem z 2026-11-16 i plansza „Etap 5: wszystkie decyzje” na kanwie https://claude.ai/artifact/Uw59Q2VKaZLe1R3CWH4Haq (strona „Etap 5: Turnieje”). Makiety widoków: `design/mockups/turnieje/` (kopie z kanwy, spis w `README.md` tego katalogu). Wzór: turniej „Jama jesień 09.11.2026” rozegrany w n01 (grupa 6 graczy, play-off, mecz pocieszenia).

Rollout `autoscore-etap5` na gałęzi integracyjnej `feat/tournaments`. Do `main` gałąź wchodzi PR-em autora po każdym kamieniu milowym. Dwie kamery USB przesuwają się na etap 6, mini PC na 7, wersja online na 8.

## Kamienie milowe

- **K1 rdzeń (T1-T11):** silnik, zapis, kreator, ekran turnieju. Da się rozegrać cały turniej w każdym z trzech formatów przy jednej tarczy, wycofać gracza i poprawić wynik.
- **K2 podgląd (T12-T17):** filtr „Turniej” w statystykach, średnie w tabeli i drabince, statystyki turnieju, mecz po ID z przebiegiem legów, publiczny link z QR.
- **K3 na żywo (T18-T19):** widok TV, testy e2e całego przebiegu, dokumentacja.

## Decyzje (wiążące)

Ustalone z autorem 2026-11-16:

1. **Formaty:** liga (każdy z każdym, wynik to tabela), puchar (drabinka, przegrany odpada), grupa + play-off (najpierw grupa, potem drabinka). Jedna grupa; do play-off wychodzi 2, 4 albo 8 graczy, pary 1-4 i 2-3 (przy 8: 1-8, 4-5, 2-7, 3-6; przy 2 od razu finał 1-2). Kilka grup później.
2. **Mecze:** długość „do N wygranych legów”, osobno dla grupy, każdej rundy play-off, finału i meczów dodatkowych (domyślnie grupa 3, rundy play-off 3, finał 4, mecz o 3. miejsce 2, pocieszenie 2). Punkty startowe raz na turniej (301/501/701, domyślnie 501). Kto zaczyna mecz: losowanie, potem legi na przemian. Zasady X01 bez zmian.
3. **Tabela grupy i ligi:** 2 pkt za wygraną, 0 za porażkę, bez remisów. Przy równych punktach: bilans legów, potem mecz bezpośredni, potem średnia z 3 rzutek. W komórce wynik meczu i średnia gracza z tego meczu, przy imieniu średnia z całej grupy.
4. **Puchar:** drabinka losowana, losowanie można powtórzyć przed startem, wolne losy dopełniają drabinkę do potęgi dwójki.
5. **Mecze dodatkowe:** dwa niezależne przełączniki w kreatorze: mecz o 3. miejsce (przegrani półfinałów) i pocieszenie dla graczy spoza play-off (jak w n01: 5. z 6.).
6. **Awarie:** wycofany gracz przegrywa pozostałe mecze walkowerem, bez wpływu na statystyki rzutów. Wynik zakończonego meczu można poprawić ręcznie w turnieju; poprawka to zdarzenie w logu i przelicza tabelę oraz drabinkę.
7. **Gracze i statystyki:** grać może każdy (profile i goście, goście jak dziś bez statystyk). Mecze turniejowe liczą się do statystyk ogólnych i gracza. Filtr „1v1” obejmuje turnieje, filtr „Turniej” pokazuje tylko je; head-to-head liczy mecze turniejowe.
8. **Widoki:** ekran turnieju (tabela z kolejnością meczów, drabinka, „Zagraj mecz”), mecz po ID (statystyki i przebieg legów tura po turze), statystyki całego turnieju, widok TV na żywo.
9. **Publiczny link:** podgląd turnieju i meczów po losowym, trudnym do zgadnięcia ID, bez logowania, tylko do odczytu, z kodem QR. Udostępnianie można wyłączyć.
10. **Tarcze:** model danych od razu na kilka tarcz, interfejs i kolejka meczów dla jednej.

Propozycje z kanwy, przyjęte w planie (do potwierdzenia przez autora przed startem rolloutu, patrz „Otwarte pytania”):

11. Turniej ma nazwę (domyślnie z datą, np. „Jama jesień 16.11.2026”).
12. Jeden aktywny turniej naraz; zakończone zostają do podglądu.
13. Publiczny link pokazuje imiona, emoji i kolory awatarów, bez zdjęć profilowych.
14. Budowa: moduł turnieju w silniku (czysta logika), turniej jako log zdarzeń, mecz turniejowy to zwykły mecz 1v1 z odnośnikiem do turnieju.

Doprecyzowania planu (nie było ich w rozmowie; też do potwierdzenia):

15. **Liczba graczy:** liga i grupa 3-10, puchar 3-16. W grupie + play-off liczba awansujących nie może przekraczać liczby graczy.
16. **N w „do N legów”:** 1-9.
17. **Walkower** liczy się w tabeli jako wygrana N:0 (N z ustawień tej fazy); średnie i statystyki rzutów go pomijają. Mecze wycofanego gracza rozegrane wcześniej zostają w tabeli. Mecz wycofanego gracza będący w toku zostaje porzucony (`abandoned`) i liczy się jako walkower.
18. **Poprawka wyniku** podaje nowy wynik w legach (zwycięzca ma dokładnie N legów). Jest odrzucana (409), gdy od wyniku zależy mecz, który już się zaczął (np. poprawka w grupie po starcie play-off). Rzutki meczu zostają w logu bez zmian; statystyki rzutów liczą się dalej z rzutek.
19. **Cofnij po końcu meczu turniejowego** działa jak dziś (5 minut), ale jest odrzucane, gdy zaczął się mecz zależny od tego wyniku.
20. **Pocieszenie** to drabinka graczy spoza play-off w kolejności z tabeli (2 graczy: jeden mecz 5. z 6.; więcej: pary najwyższy z najniższym, wolne losy dla najwyższych). Mecz o 3. miejsce istnieje tylko, gdy drabinka ma półfinały.
21. **Numeracja meczów:** grupa według kolejności rund, potem rundy play-off, pocieszenie, mecz o 3. miejsce, finał na końcu. „Następny mecz” to gotowy mecz o najniższym numerze, ale zagrać można każdy gotowy.
22. **Losowanie:** serwer losuje kolejność graczy przy tworzeniu turnieju (w lidze i grupie wyznacza kolejność meczów, w pucharze drabinkę). „Losuj ponownie” działa w każdym formacie do startu pierwszego meczu. Osobnego stanu „szkic” nie ma.
23. **Publiczny podgląd odświeża się odpytywaniem** co 10 s (bez WebSocketu dla niezalogowanych). Udostępnianie domyślnie włączone, przełącznik w kreatorze i na ekranie turnieju.
24. **Klasyfikacja końcowa:** liga z tabeli; puchar i play-off z drabinki (1., 2., 3. i 4. z meczu o 3. miejsce albo wspólne 3. bez niego, dalej według rundy odpadnięcia i tabeli grupy; miejsca spoza play-off z pocieszenia albo z tabeli).

## Zasady wspólne dla T1-T19

- **Zasady z `CLAUDE.md` wiążą:** backend jest źródłem prawdy, log zdarzeń tylko do dopisywania, typy i DTO tylko z `packages/schema`, statystyki z tabeli rzutek, warstwa danych bez funkcji specyficznych dla SQLite (migracje: tylko `text`, `integer`, `real`, bez funkcji JSON; każda z testem na bazie sprzed migracji), kolory tylko z tokenów, teksty po polsku z `i18n/pl.ts`, kolor nie niesie znaczenia sam.
- **Silnik turnieju to czysta logika:** bez I/O, czasu i losowości. Wylosowaną kolejność podaje wywołujący. Każda reguła ma test.
- **Stan turnieju wynika z odtworzenia:** konfiguracja + log zdarzeń turnieju + wyniki podpiętych meczów (z ich własnych logów). Tabela, drabinka, kolejka i klasyfikacja nie są nigdzie zapisywane.
- **Mecz turniejowy to `match.type = 'match'`** z polami `tournamentId` i `fixtureId`. Ekran gry, zasady, głos i Cofnij działają jak w meczu 1v1.
- **Makiety wiążą układ i hierarchię**, nie liczby i nie kolory wpisane w plikach (kolory z `design/theme.css`, komponenty z `design/scena/`). Zasady RWD z `design/rwd.md`: ekrany turnieju mają działać od 390 px (tabela krzyżowa przewija się w ramce, na telefonie tabela skrócona jak w `T5Publiczny`).
- **Dotychczasowe zachowanie bez zmian** poza tym, co sekcja PR-a wymienia. Mecz 1v1 z kreatora dalej wybiera best of 1/3/5.
- **Dokumentacja:** PR aktualizuje README pakietu, który zmienia, i tabelę API w głównym `README.md`, gdy zmienia API.
- **Pliki tylko do czytania:** `CLAUDE.md`, `auto-score-dart-pomysly.md`, `rollout/**`, `design/plan-etap5.md`, `design/scena/**`, `design/mockups/**`, `fixtures/**`.
- **Niejasność albo decyzja spoza planu:** pytanie zamiast zgadywania.

## Model

### Kontrakt (`packages/schema`, T2)

- `TournamentFormat`: `league | cup | group_playoff`.
- `LegsToWin`: liczba całkowita 1-9 (T1).
- `TournamentConfig`: `name`, `format`, `playerIds` (różne), `startingScore`, `advance` (2/4/8, tylko `group_playoff`), `thirdPlaceMatch`, `consolation` (tylko `group_playoff`), `legsToWin` z osobną wartością dla: `group`, każdej rundy drabinki (`r16`, `qf`, `sf`), `final`, `thirdPlace`, `consolation`; `sharing` (boolean).
- `Fixture`: `id` (stały klucz, np. `g-7`, `p-sf-1`, `p-f`, `p-3rd`, `c-f`), `number` (kolejność meczu, od 1), `phase` (`group | playoff | third_place | consolation`), `round`, `board` (zawsze 1 w tej wersji), `legsToWin`, dwa miejsca (`slots`): gracz albo opis źródła (`winner of`, `loser of`, miejsce w tabeli, wolny los), `status` (`waiting | ready | in_progress | finished | walkover | bye`), `matchId`, `result` (`legs` obu stron, `winnerId`, `corrected`), `averages` obu stron (od T13, wcześniej `null`).
- `StandingRow`: gracz, miejsce, mecze, wygrane, przegrane, legi za i przeciw, bilans, punkty, `average` (od T13), `withdrawn`, `advances`.
- `TournamentView`: id, nazwa, format, konfiguracja, `status` (`in_progress | finished`), `createdAt`, `finishedAt`, gracze (jak `MatchSnapshotPlayer`: id, imię, avatar, kolor, gość), `fixtures`, `standings` (liga i grupa), `nextFixtureId`, `liveFixtureId`, `placements` (klasyfikacja, częściowa w trakcie), `sharing`, `canRedraw`, `eventSeq`.
- Żądania: `CreateTournamentRequest`, `CorrectResultRequest`, `WithdrawPlayerRequest`, `SharingRequest`; wszystkie komendy z opcjonalnym `expectedSeq` jak w meczach.
- Zdarzenia logu turnieju: `draw` (kolejność graczy), `fixture_started` (`fixtureId`, `matchId`), `player_withdrawn`, `result_corrected`, `sharing_changed`, `archived`.
- `MatchSnapshot` i `MatchListItem` dostają `tournament: { id, name, fixtureId, label } | null` (`label` np. „Półfinał 2”, „Grupa, mecz 7”).

### Silnik (`packages/engine/src/tournament/`, T3-T5)

Jedna funkcja odtwarzająca: konfiguracja + wylosowana kolejność + lista faktów (wyniki meczów z legami i średnią, walkowery, poprawki, wycofania) → mecze z obsadą i statusem, tabela, następny mecz, klasyfikacja. Silnik nie zna rzutek; wynik meczu i średnią dostaje od serwera.

### Serwer (T6, T7)

- Tabele: `tournaments` (id, nazwa, format, konfiguracja w kolumnach i tabeli pomocniczej albo jako tekst JSON czytany w kodzie, `created_at`), `tournament_players` (kolejność zgłoszenia), `tournament_events` (`tournament_id`, `seq`, `type`, pola zdarzenia, `created_at`), kolumny `matches.tournament_id` i `matches.fixture_id`.
- Id turnieju: `t_` + co najmniej 128 bitów losowości (to samo id służy publicznemu linkowi).
- API (z logowaniem): `POST /tournaments`, `GET /tournaments` (lista, z filtrem aktywnych), `GET /tournaments/:id`, `POST /tournaments/:id/draw`, `POST /tournaments/:id/fixtures/:fixtureId/start` (tworzy mecz 1v1 i zwraca jego id; idempotentne: drugi start zwraca ten sam mecz), `POST /tournaments/:id/withdrawals`, `POST /tournaments/:id/fixtures/:fixtureId/result`, `POST /tournaments/:id/sharing`, `POST /tournaments/:id/archive`.
- Na żywo: subskrypcja turnieju na istniejącym kanale WebSocket; wiadomość `tournament_updated` z `TournamentView` po każdej zmianie turnieju i po każdej zmianie wyniku w legach podpiętego meczu.

### Front

Trasy: `#/tournaments` (aktywny turniej albo lista zakończonych), `#/tournaments/:id` (zakładki Grupa/Tabela, Play-off/Drabinka, Statystyki), `#/tournaments/:id/matches/:matchId`, `#/tournaments/:id/tv`, publiczne `#/t/:id` i `#/t/:id/matches/:matchId`. Pozycja „Turniej” w nawigacji.

---

## K1: rdzeń

### T1: długość meczu „do N wygranych legów” (engine, schema, server)

**Dziś:** silnik przyjmuje tylko `legsToWin` wynikające z best of 1/3/5 (`LEGS_TO_WIN` w `packages/engine/src/x01-match.ts`), a `CreateMatchRequest` zna tylko `bestOf`.

**Zmiana:** `LegsToWin` (1-9) w `packages/schema`; silnik przyjmuje każdą wartość z tego zakresu; `CreateMatchRequest` dla `match` przyjmuje `bestOf` (jak dziś) albo `legsToWin`, nigdy oba. Kreator meczu 1v1 i jego teksty bez zmian. Tam, gdzie front albo serwer wylicza opis „best of N” z `legsToWin`, wartości spoza 1/3/5 dają opis „do N legów”.

**Testy:** mecz do 4 legów kończy się przy 4 (wynik 4:3 po siedmiu legach, na przemian zaczynający); `legsToWin` 0 i 10 odrzucone; żądanie z oboma polami odrzucone; stare żądania z `bestOf` dają to samo co dziś.

### T2: kontrakt turnieju (schema)

**Zależy od:** T1.

**Zmiana:** typy z sekcji „Kontrakt” z walidacją (m.in. `advance` i `consolation` tylko w `group_playoff`, `thirdPlaceMatch` nie w lidze, liczba graczy według decyzji 15, różne id graczy, nazwa 1-60 znaków po przycięciu). `MatchSnapshot.tournament` i `MatchListItem.tournament` (na razie zawsze `null` po stronie serwera).

**Testy:** poprawne i błędne konfiguracje każdego formatu; domyślne długości meczów (3/3/4/2/2) i domyślne 501.

### T3: silnik, liga i tabela (engine)

**Zależy od:** T2.

**Zmiana:** terminarz każdy z każdym metodą kołową dla 3-10 graczy z numeracją meczów (nikt nie gra dwóch meczów z rzędu, gdy da się tego uniknąć; przy nieparzystej liczbie jeden gracz pauzuje w rundzie). Tabela według decyzji 3, z remisami rozstrzyganymi po kolei: punkty, bilans legów, mecz bezpośredni (przy trzech i więcej graczach z równymi punktami i bilansem: mała tabela między nimi), średnia, na końcu kolejność z losowania. Status meczów, następny mecz, koniec ligi i klasyfikacja z tabeli.

**Testy:** terminarz dla 3, 4, 5, 6 i 10 graczy (każda para raz, numeracja); tabela z przykładu z makiety `T5Turniej`; każdy poziom rozstrzygania remisu osobno; remis trzech graczy; liga w toku i zakończona.

### T4: silnik, drabinki i mecze dodatkowe (engine)

**Zależy od:** T3.

**Zmiana:** puchar z wylosowanej kolejności z wolnymi losami (3-16 graczy; wolny los daje awans bez meczu, dwa wolne losy nie trafiają na siebie); play-off z tabeli grupy (pary według decyzji 1), obsadzany dopiero po zakończeniu grupy; mecz o 3. miejsce; pocieszenie według decyzji 20; długości meczów z konfiguracji dla rundy; numeracja według decyzji 21; opisy źródeł wolnych miejsc („zwycięzca półfinału 2”); klasyfikacja końcowa według decyzji 24.

**Testy:** puchar dla 3, 4, 5, 6, 8, 11 i 16 graczy; play-off dla 2, 4 i 8 awansujących; turniej z makiet (6 graczy, 4 awansuje, oba mecze dodatkowe, razem 20 meczów); każdy przełącznik osobno i oba wyłączone; pocieszenie dla 2, 3 i 4 graczy; klasyfikacja w trakcie i na końcu.

### T5: silnik, walkower i poprawka wyniku (engine)

**Zależy od:** T4.

**Zmiana:** wycofanie gracza według decyzji 17 (w grupie, lidze, drabince i meczach dodatkowych; wycofanie gracza, który już odpadł albo skończył mecze, nic nie zmienia poza oznaczeniem); poprawka według decyzji 18 (silnik zwraca błąd domenowy, gdy zależny mecz już się zaczął; poprawka poprawki działa; poprawka może zmienić zwycięzcę); pytanie „czy od tego meczu zależy rozpoczęty mecz” jako funkcja dla serwera (decyzja 19).

**Testy:** wycofanie w trakcie grupy (tabela z walkowerami N:0, średnia bez walkowerów); wycofanie w półfinale; poprawka zmieniająca kolejność w tabeli i obsadę play-off; poprawka odrzucona po starcie meczu zależnego; dwie poprawki tego samego meczu.

### T6: serwer, zapis turnieju i mecze z terminarza (server, schema)

**Zależy od:** T1, T5.

**Zmiana:** migracja i warstwa danych z sekcji „Serwer”; `POST /tournaments` (walidacja, gracze muszą istnieć i nie być zarchiwizowani, odmowa `tournament_active`, gdy trwa inny turniej; losowanie kolejności generatorem serwera), `GET /tournaments`, `GET /tournaments/:id`, `POST …/draw` (tylko przed pierwszym meczem), `POST …/fixtures/:fixtureId/start` (tylko mecz gotowy; `legsToWin` i punkty z turnieju, zaczynający z losowania jak w 1v1), `POST …/archive`. Widok budowany z odtworzenia logu turnieju i podpiętych meczów (z pamięci podręcznej odtworzeń). `tournament` w `MatchSnapshot` i `MatchListItem`. Kanał na żywo `tournament_updated`. Porzucony mecz turniejowy zostaje podpięty i da się go wznowić jak dziś.

**Testy:** cała liga 4 graczy przez API (tworzenie, start meczu, rzutki, tabela po każdym meczu, koniec turnieju); puchar z wolnym losem; grupa + play-off do finału; drugi aktywny turniej odrzucony; start meczu niegotowego odrzucony; powtórzony start zwraca ten sam mecz; losowanie po pierwszym meczu odrzucone; `tournament_updated` po wygranym legu; migracja na bazie sprzed zmiany; widok po restarcie serwera taki sam.

### T7: serwer, wycofanie, poprawka i blokada Cofnij (server)

**Zależy od:** T6.

**Zmiana:** `POST …/withdrawals` (mecz w toku wycofanego gracza zostaje porzucony w tej samej operacji), `POST …/fixtures/:fixtureId/result` (decyzja 18, kody błędów w `packages/schema`), odmowa Cofnij w meczu turniejowym, od którego zależy rozpoczęty mecz (decyzja 19, kod jak przy zablokowanym meczu). Każda komenda z `expectedSeq`.

**Testy:** scenariusze z T5 przez API; Cofnij ostatniej rzutki finału grupy przed i po starcie półfinału; poprawka i wycofanie rozgłaszane przez `tournament_updated`.

### T8: kreator turnieju i nawigacja (web)

**Zależy od:** T6. **Makieta:** `T5Kreator`.

**Zmiana:** czwarty typ gry „Turniej” w kreatorze: nazwa (domyślnie z dzisiejszą datą), format, gracze (profile i goście, dodawanie jak dziś), punkty startowe, „Do play-off” (tylko grupa + play-off), przełączniki meczów dodatkowych (tylko tam, gdzie mają sens), długości meczów z krokiem −/+ dla faz danego formatu, panel „Plan turnieju” z liczbą meczów na fazę i sumą, przełącznik publicznego linku, „Rozpocznij turniej”. Błędy walidacji i `tournament_active` po polsku. Pozycja „Turniej” w nawigacji i trasa `#/tournaments` (aktywny turniej, inaczej lista zakończonych i przycisk „Nowy turniej”). Po utworzeniu przejście na `#/tournaments/:id` (do T9 ekran zastępczy z nazwą i listą meczów).

**Testy:** liczba meczów w planie dla każdego formatu i przełączników; pola zależne od formatu; żądanie wysłane do API; układ przy 390, 1280 i 1920 px.

### T9: ekran turnieju, tabela i kolejka meczów (web)

**Zależy od:** T8. **Makieta:** `T5Turniej`.

**Zmiana:** nagłówek (format, punkty, nazwa, stan fazy „9 z 15 meczów”), zakładki; tabela krzyżowa ligi/grupy (miejsce, gracz, komórki z wynikiem albo numerem meczu w kółku, bieżący mecz wyróżniony ramką i napisem, M/W/P/+/-/PKT, awansujący oznaczeni także tekstem albo ikoną), karta „Następny mecz” z „Zagraj mecz”, lista „Kolejka” (każdy gotowy mecz da się zagrać), „Losuj ponownie” do startu pierwszego meczu, trwający mecz z „Wróć do meczu”. Ekran gry w meczu turniejowym pokazuje etykietę meczu, a po końcu meczu „Wróć do turnieju” zamiast rewanżu. Ekran słucha `tournament_updated`. Średnie w komórkach i przy imieniu dochodzą w T14.

**Testy:** tabela z danych makiety; numery meczów i wyróżnienie bieżącego; start meczu przenosi na ekran gry; powrót po końcu meczu; odświeżenie po `tournament_updated`; telefon 390 px bez przewijania strony w poziomie.

### T10: zakładka play-off, drabinka i klasyfikacja (web)

**Zależy od:** T9. **Makieta:** `T5Drabinka`.

**Zmiana:** drabinka pucharu i play-off (rundy z nagłówkami „PÓŁFINAŁY · DO 3”, pola meczu z rozstawieniem, graczami albo opisem źródła, legami, stanem „zakończony / na żywo / po półfinałach”, wolne losy), mecze dodatkowe pod drabinką, karta „Trwa” z wynikiem w legach i „Wróć do meczu”, klasyfikacja końcowa (częściowa w trakcie). W lidze zakładki drabinki nie ma, w pucharze nie ma zakładki grupy. Drabinka do 16 graczy przewija się w ramce.

**Testy:** drabinka 4, 8 i 16 graczy; wolne losy; stan z makiety; klasyfikacja po finale; zwycięzca oznaczony nie tylko kolorem.

### T11: wycofanie gracza, poprawka wyniku i archiwizacja (web)

**Zależy od:** T7, T10.

**Zmiana:** „Popraw wynik” (wybór zakończonego meczu, nowy wynik w legach, potwierdzenie z informacją, co się przeliczy; błąd, gdy zaczął się mecz zależny) i „Wycofaj gracza” (wybór gracza, potwierdzenie z liczbą walkowerów) jako okna na wspólnym komponencie okna; poprawione wyniki i walkowery oznaczone w tabeli i drabince tekstem; wycofany gracz oznaczony w tabeli; archiwizacja zakończonego turnieju z listy.

**Testy:** oba przebiegi z potwierdzeniem i z błędem; oznaczenia w tabeli i drabince; obsługa klawiaturą i czytnikiem (role, fokus) jak w pozostałych oknach.

---

## K2: podgląd

### T12: statystyki, filtr „Turniej” (server, schema)

**Zależy od:** T7.

**Zmiana:** `StatsFilter` dostaje `tournament` (tylko mecze z `tournamentId`); `match` dalej obejmuje wszystkie mecze 1v1, także turniejowe; head-to-head liczy mecze turniejowe; `MatchListQuery` dostaje filtr `tournamentId`. Walkowery nie są meczami w statystykach (nie mają rzutek ani wpisu w `matches`).

**Testy:** statystyki, rankingi, forma i head-to-head z filtrem `tournament`, `match` i `all` na bazie z meczami obu rodzajów.

### T13: średnie w widoku turnieju, statystyki turnieju, przebieg legów meczu (server, schema)

**Zależy od:** T12.

**Zmiana:** `Fixture.averages` (średnia z 3 rzutek każdego gracza w meczu, ze wszystkich zamkniętych tur) i `StandingRow.average` (z meczów grupy; ta sama wartość rozstrzyga remisy w silniku); `GET /tournaments/:id/stats`: wiersz na gracza ze wszystkich meczów turnieju (mecze W-P, legi, bilans, średnia, First 9, 100+, 140+, 180, najwyższe zamknięcie, najlepszy leg) oraz rekordy turnieju (najwyższa średnia w meczu, najwyższe zamknięcie, najkrótszy leg, najwyższa tura; każdy z graczem i meczem); `GET /matches/:id/legs`: zamknięte tury każdego lega (`LegTurn`), kto zaczynał, zwycięzca, zamknięcie, liczba rzutek, średnia lega.

**Testy:** średnie zgodne z `GET /matches/:id/summary`; statystyki turnieju na danych z kilku meczów; rekordy przy remisie (pierwszy osiągnięty); przebieg legów z bustem i z meczem w toku.

### T14: średnie w tabeli i drabince, zakładka „Statystyki”, filtr w statystykach (web)

**Zależy od:** T11, T13. **Makiety:** `T5Turniej`, `T5Drabinka`, `T5Statystyki`.

**Zmiana:** średnia gracza z meczu w komórkach tabeli i polach drabinki, średnia grupy przy imieniu; zakładka „Statystyki”: podium (po zakończeniu), rekordy turnieju z odnośnikiem do meczu, tabela graczy z sortowaniem po kolumnie (`aria-sort`, najlepsza wartość w kolumnie oznaczona nie tylko kolorem); filtr „Turniej” na ekranie statystyk i karcie gracza; w historii gier etykieta turnieju przy meczu turniejowym z odnośnikiem do turnieju.

**Testy:** sortowanie; oznaczenie najlepszych wartości; filtr wysyła `type=tournament`; etykieta w historii.

### T15: mecz po ID, statystyki i przebieg lega (web)

**Zależy od:** T14. **Makieta:** `T5Mecz`.

**Zmiana:** trasa `#/tournaments/:id/matches/:matchId`: wynik w legach, etykieta i długość meczu, data i czas trwania, tabela statystyk obu graczy (lepsza wartość wyróżniona), przebieg lega z zakładkami legów (Zdobył / Zostało / Rzutki, zamknięcie oznaczone, zdanie podsumowujące leg). Wejście z komórki tabeli, pola drabinki, rekordów i kolejki zakończonych meczów. Mecz w toku pokazuje dotychczasowe legi i odświeża się na żywo.

**Testy:** dane z makiety; bust w przebiegu; mecz w toku; telefon 390 px.

### T16: publiczny podgląd, API tylko do odczytu (server, schema)

**Zależy od:** T13.

**Zmiana:** trasy bez logowania: `GET /public/tournaments/:id`, `GET /public/tournaments/:id/stats`, `GET /public/tournaments/:id/matches/:matchId` (podsumowanie i przebieg legów; tylko mecz należący do tego turnieju). Odpowiedzi w osobnych typach publicznych: imiona, emoji i kolor awatara, bez zdjęć, bez danych spoza turnieju. Wyłączone udostępnianie, turniej zarchiwizowany i nieznane id dają tę samą odpowiedź 404. `POST /tournaments/:id/sharing` (z logowaniem). Limit zapytań per adres klienta na trasach publicznych i krótka pamięć podręczna odpowiedzi. Trasy publiczne nie przyjmują żadnych zapisów.

**Testy:** odczyt bez tokenu; 404 w trzech przypadkach nie do odróżnienia; mecz spoza turnieju 404; zdjęcie awatara nie wychodzi; limit zapytań; pozostałe trasy dalej wymagają tokenu.

### T17: publiczna strona, udostępnianie z kodem QR (web)

**Zależy od:** T15, T16. **Makieta:** `T5Publiczny`.

**Zmiana:** trasy `#/t/:id` i `#/t/:id/matches/:matchId` działające bez logowania (nie pokazują ekranu logowania, nie mają nawigacji aplikacji ani żadnej akcji zapisu), zakładki Wyniki / Grupa / Play-off / Statystyki, odświeżanie co 10 s, komunikat przy 404. Na ekranie turnieju „Udostępnij”: okno z adresem, „Kopiuj link”, kodem QR i przełącznikiem udostępniania. Kod QR generowany w przeglądarce (mała biblioteka bez zależności, bez wysyłania adresu na zewnątrz).

**Testy:** strona publiczna bez tokenu w pamięci przeglądarki; brak akcji zapisu; odświeżanie; okno udostępniania; wyłączenie udostępniania.

---

## K3: na żywo

### T18: widok TV turnieju (web)

**Zależy od:** T17. **Makieta:** `T5TV`.

**Zmiana:** trasa `#/tournaments/:id/tv` (z logowaniem): trwający mecz (dwie karty graczy: avatar, imię, „RZUCA” przy rzucającym, średnia meczu i ostatnia tura, legi, bardzo duży pozostały wynik; bieżąca tura i zamknięcie), obok play-off albo tabela (zależnie od fazy), następny mecz, kod QR publicznego linku (gdy udostępnianie włączone). Bez klawiatury i bez głosu. Gdy nie trwa żaden mecz: następny mecz i tabela albo drabinka na całą szerokość. Widok sam przechodzi na kolejny mecz. Wejście z ekranu turnieju („Widok TV”).

**Testy:** mecz w toku z danych makiety; przejście między meczami po `tournament_updated`; brak meczu; czytelność przy 1280×720 i 1920×1080 (bez przewijania).

### T19: testy e2e turnieju i dokumentacja (e2e, docs)

**Zależy od:** T18.

**Zmiana:** scenariusze e2e na konfiguracji produkcyjnej: liga 3 graczy od kreatora do klasyfikacji; grupa + play-off 4 graczy z meczem o 3. miejsce, poprawką wyniku i wycofaniem; publiczny link bez logowania i po wyłączeniu udostępniania; sprawdzenia układu ekranu turnieju, drabinki i TV. README główne i pakietów: turnieje, API, trasy frontu.

**Testy:** wszystkie joby CI zielone; czas joba `e2e` przed i po w opisie PR.

---

## Poza zakresem etapu 5

Kilka grup, kilka tarcz w interfejsie, podwójna eliminacja, rewanże w lidze, sety, harmonogram godzinowy, konta i role organizatora, turnieje na karcie gracza, eksport wyników, powiadomienia, rozstawienie ręczne.

## Otwarte pytania do autora (przed startem rolloutu)

1. Decyzje 11-13 z kanwy (nazwa, jeden aktywny turniej, awatary w publicznym linku): potwierdzone?
2. Decyzje 15-24 (doprecyzowania planu): zwłaszcza limity graczy (15), walkower jako N:0 (17), blokada poprawki po starcie meczu zależnego (18) i odświeżanie publicznego podglądu co 10 s (23).
3. Tryb scalania PR-ów w rolloucie: automatycznie do `feat/tournaments` (jak etapy 3 i 4) czy z akceptacją każdego PR-a.
