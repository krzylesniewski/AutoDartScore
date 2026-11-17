# AUTO Score

AUTO Score automatycznie liczy wynik w darcie. Dziś trafienia wpisuje się ręcznie na klawiaturze w aplikacji (symulator trafień). Później źródłem trafień będzie kamera USB. Wyjście to wynik na żywo, głosowy odczyt wyniku i efekty dźwiękowe. Projekt działa lokalnie: serwer, baza i front stoją na jednym komputerze w sieci domowej, bez internetu. Da się go też wdrożyć na serwer za wspólnym hasłem, zobacz [deploy/README.md](deploy/README.md).

## Stan projektu

Działa dziś:

- Typy gier: mecz 1v1 (X01, best of 1, 3 lub 5), zabawa dla 2-4 graczy z rankingiem miejsc i trening. Trening ma trzy tryby:
  - Free run: swobodne rzucanie z licznikiem sesji, bez statystyk,
  - Solo 501: zejście z 501 do zera na zasadach X01,
  - „Końcówki”: losowe końcówki z przedziału 2-50 albo 51-100, z podpowiedzią trasy i przyciskami „Udało się”, „Nie udało się” i „Nowa końcówka”. Po pudle końcówka zostaje do ponownej próby.
- Formularz nowej gry na ekranie startowym: typ gry, gracze, dodawanie gracza (imię, avatar emoji, kolor, gość), punkty startowe, liczba legów, tryb treningu i przedział końcówek. Obok lista gier do dokończenia.
- Ekran gry: pasek wyników z kolejką rzutów, trzy sloty rzutek, suma tury, karta zamknięcia, klawiatura (1-20, 25, Bull, Miss, „Reszta Miss”, S/D/T) ze skrótami klawiszowymi, „Cofnij”, panel lega z historią tur i przełączniki głosu i efektów.
- Stan na żywo przez WebSocket, z ponownym połączeniem po zerwaniu.
- Głosowy odczyt wyniku tury, komunikaty „Bust” i „Zwycięzca”, komunikaty osiągnięć i efekty dźwiękowe.
- Statystyki: ranking graczy z kafelkami rekordów, karta gracza z profilem, wykres formy, bilans 1v1 (head-to-head) i widok „Overall” ze wszystkimi grami liczonymi do statystyk razem. Ranking i karta gracza mają filtr typu gier, a wszystkie te widoki filtr okresu.
- Historia wszystkich gier z filtrem typu.
- Porzucanie i wznawianie gry.
- Ustawienia urządzenia: układ klawiatury (koło albo siatka), głos, efekty i komentarze do tury za 0.
- Podsumowanie po końcu gry. Mecz 1v1 ma karty legów z czasem, wykres zejścia z wyniku w ostatnim legu oraz przyciski „Rewanż” i „Nowy mecz”. Zabawa ma tabelę miejsc i ten sam wykres.
- Opcjonalne logowanie wspólnym hasłem, gdy serwer ma ustawione `AUTOSCORE_PASSWORD`.

Jeszcze nie ma:

- Kamery i pakietu `vision`.
- Statusu `pending` i weryfikacji rzutek. Serwer zapisuje `confidence`, ale go nie używa.
- Przycisków „Nowa runda” i „Do weryfikacji”. Nie ma ich na ekranie gry, dopóki nie dostaną działania.
- Widoku TV.

Plan ma 7 etapów:

1. Mac bez kamery: silnik, API, front z symulatorem, statystyki, audio.
2. Mac i jedna kamera USB.
3. Redesign wyglądu „Scena”.
4. Wzmocnienie po audycie kodu.
5. Dwie kamery USB.
6. Mini PC.
7. Wersja online.

## Wymagania

- Node 24. `nvm use` czyta wersję z `.nvmrc`.
- pnpm 12. Dokładna wersja jest w polu `packageManager` w `package.json`.
- Dziś macOS. Docelowo mini PC z Linuksem.

## Instalacja i uruchomienie

```sh
nvm use
pnpm install
pnpm dev
```

`pnpm dev` uruchamia równolegle serwer (`http://localhost:3000`) i front (domyślnie `http://localhost:5173`). Aplikację otwierasz pod adresem frontu. Serwer z `pnpm dev` działa bez hasła, bo skrypt ustawia `AUTOSCORE_AUTH=off`, chyba że zmienna jest już ustawiona.

Tablet w tej samej sieci otwiera `http://<adres-IP-komputera>:5173`. Tablet potrzebuje tylko portu 5173, bo front przekazuje zapytania do API przez proxy `/api`. Jeśli macOS pyta o połączenia przychodzące, zezwól na nie w zaporze (Ustawienia systemowe, Sieć, Zapora).

Serwer przy starcie wykonuje migracje bazy. Plik bazy powstaje domyślnie w `packages/server/autoscore.sqlite`, bo pnpm uruchamia skrypty w katalogu pakietu. Pliki `*.sqlite` są w `.gitignore`.

Sam serwer, bez frontu, bez trybu watch i bez hasła:

```sh
AUTOSCORE_AUTH=off pnpm --filter @autoscore/server start
```

## Konfiguracja

Konfiguracja idzie przez zmienne środowiskowe.

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `PORT` | `3000` | Port serwera API. |
| `HOST` | `0.0.0.0` | Adres nasłuchu serwera. Domyślny pozwala połączyć się z innych urządzeń w sieci. |
| `DATABASE_PATH` | `autoscore.sqlite` | Ścieżka pliku SQLite, względna wobec katalogu, w którym działa proces serwera. |
| `AUTOSCORE_AUTH` | `on` | `on` wymaga hasła w `AUTOSCORE_PASSWORD`, bez niego serwer nie wstaje. `off` wyłącza logowanie, tylko do pracy lokalnej. `AUTOSCORE_PASSWORD`, `AUTOSCORE_TOKEN_SECRET` i błędy startu opisuje [README serwera](packages/server/README.md). |
| `AUTOSCORE_API_URL` | `http://localhost:3000` | Adres serwera, na który proxy Vite przekazuje `/api`. |
| `AUTOSCORE_MATCH_LOCK_MINUTES` | `5` | Ile minut po rzutce kończącej grę da się jeszcze cofać. `0` zamyka grę od razu. Wartość spoza samych cyfr albo większa niż `525600` (rok) zatrzymuje start z błędem `Invalid AUTOSCORE_MATCH_LOCK_MINUTES`. |

`PORT` musi składać się z samych cyfr i nie przekraczać 65535. Inaczej serwer kończy pracę przy starcie z błędem `Invalid PORT`. Po zmianie `PORT` ustaw `AUTOSCORE_API_URL` na ten sam port, na przykład:

```sh
PORT=3100 AUTOSCORE_API_URL=http://localhost:3100 pnpm dev
```

## API w skrócie

Typy żądań, odpowiedzi i wiadomości są zdefiniowane tylko w [packages/schema](packages/schema/README.md) (Zod).

| Metoda | Ścieżka | Opis |
|---|---|---|
| `GET` | `/players` | Lista graczy bez gości, posortowana po imieniu. |
| `POST` | `/players` | Nowy gracz (`CreatePlayerRequest`: `name` 1-40 znaków po obcięciu spacji, opcjonalny `avatar` (dokładnie jedno emoji, np. 🎯, 👍🏽 albo 🇵🇱; tekst daje 400), opcjonalny `color` 1-16, `guest` domyślnie `false`). Bez `color` gracz dostaje stały kolor wyliczony z `id`. Odpowiedź 201 z `Player`. Imię zajęte przez innego zapisanego, niezarchiwizowanego gracza daje 409 `player_name_taken` (nie dotyczy gości). |
| `POST` | `/matches` | Nowa gra (`CreateMatchRequest`, rodzaj w polu `type`). Odpowiedź 201 z `MatchSnapshot`. |
| `GET` | `/matches/:id` | Bieżący stan gry (`MatchSnapshot`). |
| `POST` | `/matches/:id/throws` | Rzutka (`HitEvent`). Odpowiedź 201 z `{ throw, events, state }`. |
| `POST` | `/matches/:id/checkout-attempts` | Próba w treningu checkoutów (`CheckoutAttemptRequest`: `{ success }`). Odpowiedź 201 z `MatchSnapshot`. Po udanej próbie `checkouts` ma nowy cel, po nieudanej ten sam. Sesje zapisane przed wprowadzeniem tej zasady dostają nowy cel po każdej próbie. Inna gra daje 409 `not_checkouts`, zakończony trening 409 `practice_ended`, a porzucony 409 `match_abandoned`. |
| `POST` | `/matches/:id/checkout-skips` | Pominięcie celu w treningu checkoutów: nowy cel bez próby. Body jest opcjonalne (`CommandRequest`: `{ expectedSeq }`, patrz niżej). Odpowiedź 201 z `MatchSnapshot`, w którym `attempts`, `successes` i `history` się nie zmieniają, a `skips` rośnie o 1. Błędy jak przy próbie, nieznana gra daje 404 `not_found`. |
| `POST` | `/matches/:id/rest-miss` | Miss na resztę tury rzucającego (`RestMissRequest`: `{ eventId, expectedSeq? }`). Zapisuje 3, 2 albo 1 rzutkę (przy 0, 1 albo 2 rzutkach w turze) w jednej transakcji, ze `source: "rest-miss"`. Pierwsza dostaje `eventId` z żądania. Odpowiedź 201 z `{ throws, events, state }` (`RestMissResult`). Ponowne wysłanie tego samego `eventId` daje 200 z `throws: []`. Błędy jak przy rzutce: zakończona gra daje 409 `match_finished`, trening checkoutów 409 `throws_not_allowed`. |
| `POST` | `/matches/:id/undo` | Cofnięcie ostatniej rzutki. Body jest opcjonalne (`CommandRequest`: `{ expectedSeq }`, patrz niżej). Odpowiedź 200 z `{ undoneThrowId, state }`. W zakończonej grze działa do `editableUntil` ze stanu gry (`finishedAt` plus `AUTOSCORE_MATCH_LOCK_MINUTES`), potem daje 409 `match_locked`. W meczu turnieju cofnięcie rzutki, która zakończyła mecz, daje 409 `match_locked` także przed `editableUntil`, gdy zaczął się już mecz zależny od jego wyniku (w grupie z play-off każdy mecz drabinki, w pucharze kolejne mecze drabinki). `editableUntil` tego nie uwzględnia. W treningu checkoutów cofa ostatnią próbę albo ostatnie pominięcie, przywraca poprzedni cel i zwraca `undoneThrowId: null`. |
| `GET` | `/matches/:id/summary` | Podsumowanie gry (`MatchSummary`). Każdy wygrany leg w `legs` ma `durationMs`: czas od pierwszej do zamykającej rzutki lega w milisekundach, bez przerw między porzuceniem a wznowieniem. Zabawa ma pustą listę `legs`. Nieznana gra daje 404 `not_found`. |
| `GET` | `/players/:id/stats` | Statystyki gracza (`PlayerStats`), w tym `winRate` (procent wygranych z ukończonych meczów 1v1 i gier w zabawie, z jednym miejscem po przecinku, `null` bez ukończonych gier) i `t20Hits` (trafienia T20 w zamkniętych turach, także z bustem). Parametry: `type` (`all`, `match`, `casual` albo `practice`, domyślnie `all`) i `period` (`30d`, `90d` albo `all`, domyślnie `all`). `30d` i `90d` liczą tylko gry z `createdAt` nie starszym niż zegar serwera minus 30 albo 90 dni. Odpowiedź ma pola `filter` i `period`. Nieznana wartość parametru daje 400 `invalid_request`, nieznany gracz 404 `not_found`. |
| `GET` | `/players/:id/form` | Forma gracza (`PlayerForm`): średnia z ukończonych legów każdej z ostatnich 20 gier. Parametry: `type` (`all`, `match`, `casual` albo `practice`, domyślnie `all`) i `period` (`30d`, `90d` albo `all`, domyślnie `all`). `30d` i `90d` liczą tylko gry z `createdAt` nie starszym niż zegar serwera minus 30 albo 90 dni. Odpowiedź ma pola `filter` i `period`. Nieznana wartość parametru daje 400 `invalid_request`. |
| `GET` | `/players/:id/head-to-head/:opponentId` | Bilans dwóch graczy z ukończonych meczów 1v1 (`HeadToHead`). Parametr `period` (`30d`, `90d` albo `all`, domyślnie `all`). `30d` i `90d` liczą tylko gry z `createdAt` nie starszym niż zegar serwera minus 30 albo 90 dni. Odpowiedź ma pole `period`. Nieznana wartość parametru albo ten sam gracz dwa razy daje 400 `invalid_request`. |
| `GET` | `/stats/rankings` | Ranking graczy i rekordy (`StatsRankings`), w tym lista `winRate` (gracze z co najmniej 3 ukończonymi meczami 1v1 albo grami w zabawie, pusta dla `practice`) i lista `t20Hits` (bez graczy z 0 trafień). Parametry: `type` (`all`, `match`, `casual` albo `practice`, domyślnie `all`) i `period` (`30d`, `90d` albo `all`, domyślnie `all`). `30d` i `90d` liczą tylko gry z `createdAt` nie starszym niż zegar serwera minus 30 albo 90 dni. Odpowiedź ma pola `filter` i `period`. Nieznana wartość parametru daje 400 `invalid_request`. |
| `GET` | `/stats/overall` | Wszystkie gry liczone do statystyk razem, bez filtra po typie (`StatsOverall`). Parametr `period` (`30d`, `90d` albo `all`, domyślnie `all`). `30d` i `90d` liczą tylko gry z `createdAt` nie starszym niż zegar serwera minus 30 albo 90 dni. Odpowiedź ma pole `period`. Nieznana wartość parametru daje 400 `invalid_request`. |
| `POST` | `/tournaments` | Nowy turniej (`CreateTournamentRequest`). Serwer losuje kolejność graczy. Odpowiedź 201 z `TournamentView` (`eventSeq: 1`). Nieznany gracz daje 400 `unknown_player`, zarchiwizowany 400 `archived_player` (goście są dozwoleni). Gdy inny turniej trwa i nie jest zarchiwizowany, 409 `tournament_active`. |
| `GET` | `/tournaments` | Lista turniejów (`TournamentListItem`), od najnowszego. Parametry: `status` (`in_progress` albo `finished`) i `archived=include`. Bez `archived=include` zarchiwizowane turnieje są ukryte. |
| `GET` | `/tournaments/:id` | Bieżący widok turnieju (`TournamentView`), także zarchiwizowanego. Nieznany turniej daje 404 `not_found`. |
| `POST` | `/tournaments/:id/draw` | Ponowne losowanie kolejności. Body jest opcjonalne (`CommandRequest`). Odpowiedź 200 z `TournamentView`. Po starcie pierwszego meczu daje 409 `tournament_started`. |
| `POST` | `/tournaments/:id/fixtures/:fixtureId/start` | Start meczu turnieju jako zwykłego meczu 1v1. Body jest opcjonalne (`CommandRequest`). Odpowiedź 201 z `StartFixtureResult` (`{ matchId, tournament }`). Ponowny start tego samego meczu daje 200 z tym samym `matchId` i niczego nie zapisuje. Mecz, który nie jest gotowy (czeka na wyniki albo jest wolnym losem), daje 409 `fixture_not_ready`, a nieznany mecz 404 `not_found`. |
| `POST` | `/tournaments/:id/archive` | Archiwizacja zakończonego turnieju. Body jest opcjonalne (`CommandRequest`). Odpowiedź 200 z `TournamentView` z `archivedAt`. Trwający turniej daje 409 `tournament_not_finished`, a zarchiwizowany 409 `tournament_archived`. |
| `POST` | `/tournaments/:id/withdrawals` | Wycofanie gracza (`WithdrawPlayerRequest`: `{ playerId, expectedSeq? }`). Jego pozostałe mecze stają się walkowerami (`legsToWin`:0 dla rywala), rozegrane zostają w tabeli. Jego trwający mecz turnieju zostaje porzucony w tym samym zapisie i nie da się go wznowić. Odpowiedź 201 z `TournamentView`. Gracz spoza turnieju daje 400 `not_a_participant`, zakończony turniej 409 `tournament_finished`, a ponowne wycofanie 409 `already_withdrawn`. |
| `POST` | `/tournaments/:id/fixtures/:fixtureId/result` | Ręczna korekta wyniku zakończonego meczu turnieju (`CorrectResultRequest`: `{ legs, expectedSeq? }`, legi w kolejności slotów). Odpowiedź 200 z `TournamentView`, a wynik meczu ma `corrected: true`. Rzutki meczu się nie zmieniają. Działa też w zakończonym turnieju. Przy kilku korektach jednego meczu liczy się ostatnia. Nieznany mecz daje 404 `not_found`, mecz bez wyniku z gry (także walkower) 409 `fixture_not_finished`, zwycięzca bez dokładnie `legsToWin` legów albo przegrany z co najmniej tyloma 400 `invalid_result`, a mecz, od którego wyniku zależy mecz już rozpoczęty, 409 `dependent_started`. |
| WebSocket | `/matches/:id/live` | Strumień stanu i zdarzeń jednej gry. |
| WebSocket | `/tournaments/:id/live` | Widok jednego turnieju (`tournament_updated`). |

Rodzaje gry w `POST /matches`:

- `match`: dokładnie 2 różnych graczy w `playerIds`, `startingScore` 301, 501 lub 701 (domyślnie 301) i długość meczu: `bestOf` 1, 3 lub 5 albo `legsToWin` 1-9 (do N wygranych legów), nigdy oba naraz. Bez żadnego z nich mecz to best of 1. Oba pola naraz dają 400 `invalid_request`,
- `casual`: 2-4 różnych graczy i `startingScore` (domyślnie 301),
- `practice`: `practiceMode` `free_run`, `solo_501` albo `checkouts` i jeden gracz. `checkouts` wymaga `checkoutRange` (`2-50` albo `51-100`), a inne tryby go nie przyjmują.

Okres statystyk (`period`): `30d` i `90d` liczą tylko gry, których `createdAt` jest nie starsze niż teraz minus 30 albo 90 dni (gra sprzed dokładnie 30 dni wchodzi do `30d`). „Teraz” to zegar serwera, nie urządzenia. `90d` to ruchome 90 dni, nie kwartał. `all` nie ma granicy i daje te same liczby co zapytanie bez parametru. Najczęstsze trafienia i podsumowanie gry nie mają okresu.

### Zdarzenie trafienia (`HitEvent`)

```json
{
  "eventId": "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b",
  "matchId": "<MATCH_ID>",
  "source": "keypad",
  "sequence": 0,
  "segment": 20,
  "multiplier": 3,
  "confidence": 1,
  "detectedAt": "2026-10-18T18:30:12.345Z"
}
```

- `eventId`: UUID (małe lub wielkie litery). Ten sam `eventId` wysłany ponownie do tej samej gry nie dubluje rzutki.
- `source`: niepusty tekst, na przykład `keypad` albo `camera-1`.
- `sequence`: liczba całkowita od 0.
- `segment`: 0-20 albo 25. `multiplier`: 0-3.
- `confidence`: liczba od 0 do 1.
- `detectedAt`: data ISO w UTC zakończona `Z`. Przesunięcie strefy, na przykład `+02:00`, jest odrzucane.

Kodowanie: miss to `segment: 0, multiplier: 0`. Outer Bull to `segment: 25, multiplier: 1` (25 pkt). Bull to `segment: 25, multiplier: 2` (50 pkt, liczy się jako double). `segment: 25, multiplier: 3` jest odrzucane.

### Idempotencja i błędy

Ponowne wysłanie rzutki z tym samym `eventId` do tej samej gry daje 200 z zapisaną rzutką i `events: []`, jeśli `source`, `sequence`, `segment`, `multiplier`, `confidence` i `detectedAt` są takie same jak w zapisanej rzutce. Inna treść daje 409 `event_id_conflict`. W obu przypadkach serwer nic nie zapisuje i nic nie wysyła przez WebSocket. Ponowne wysłanie `rest-miss` z tym samym `eventId` działa tak samo i daje 200 z `throws: []`. Cofnięcie jest nowym wpisem w logu. Wiersz rzutki zostaje w bazie.

Dwanaście komend przyjmuje opcjonalne `expectedSeq`: cofnięcie, próba i pominięcie checkoutu, `rest-miss`, porzucenie (`POST /matches/:id/abandon`, `AbandonMatchRequest`), wznowienie (`POST /matches/:id/resume`), koniec treningu (`POST /matches/:id/end`) oraz w turnieju ponowne losowanie, start meczu, archiwizacja, wycofanie gracza i korekta wyniku. `expectedSeq` to ostatni `eventSeq`, który widział klient. Inna wartość niż bieżący `eventSeq` gry daje 409 `stale_state` z bieżącym stanem, a serwer nic nie zapisuje i nic nie wysyła przez WebSocket. Bez `expectedSeq` komenda działa na bieżącym stanie, więc dwa cofnięcia z rzędu zdejmują dwie rzutki. Cofnięcie, wznowienie, koniec treningu, pominięcie checkoutu i trzy komendy turnieju czytają body jako JSON przy każdym `content-type`. Pusty albo niepoprawny JSON i wartość, która nie jest obiektem, znaczą brak body. Obiekt z niepoprawnym `expectedSeq`, na przykład `-1` albo `"3"`, daje 400 `invalid_request`. Kolejność sprawdzeń: błąd body (400), nieznana gra (404), błędy, które nie zależą od logu (`not_checkouts`, `not_practice`, `not_a_participant`, `throws_not_allowed`), w `rest-miss` ponowne wysłanie, potem `stale_state`, a na końcu błędy zależne od logu, na przykład `match_finished` albo `nothing_to_undo`. Dlatego powtórzony `rest-miss` daje 200 także z nieaktualnym `expectedSeq`.

W komendach turnieju `expectedSeq` porównujemy z `eventSeq` widoku turnieju, czyli najwyższym `seq` logu turnieju. Rzutki w meczach turnieju go nie zmieniają. `stale_state` ma wtedy pole `tournament` z bieżącym widokiem zamiast `state` (`TournamentStaleStateError`). Kolejność sprawdzeń: błąd body (400), nieznany turniej (404), przy starcie meczu ponowny start, przy wycofaniu gracz spoza turnieju (400 `not_a_participant`), potem `stale_state`, `tournament_archived`, a na końcu pozostałe błędy. Dlatego powtórzony start meczu daje 200 także z nieaktualnym `expectedSeq`. Przy wycofaniu te pozostałe błędy to kolejno `tournament_finished` i `already_withdrawn`. Przy korekcie to nieznany mecz (404), `fixture_not_finished`, `invalid_result` i `dependent_started`.

Każdy błąd ma postać `{ "error": "<kod>", "message": "<opis>" }` (`ApiError`). `stale_state` ma dodatkowo pole `state` z bieżącym `MatchSnapshot` (`StaleStateError`), a w komendach turnieju pole `tournament` z bieżącym `TournamentView` (`TournamentStaleStateError`).

| Kod | HTTP | Kiedy |
|---|---|---|
| `invalid_request` | 400 | Body nie pasuje do schematu, niepoprawny JSON, brak lub zły `content-type`. |
| `invalid_config` | 400 | Silnik odrzucił konfigurację gry albo turnieju. |
| `unknown_player` | 400 | `playerIds` zawiera nieznanego gracza. |
| `archived_player` | 400 | `playerIds` nowego turnieju zawiera zarchiwizowanego gracza. |
| `match_mismatch` | 400 | `matchId` w body różni się od `:id` w adresie. |
| `not_found` | 404 | Nieznana gra (GET, rzutka, cofnięcie), nieznany turniej albo mecz turnieju, albo nieznana ścieżka. |
| `tournament_active` | 409 | Nowy turniej, gdy inny trwa i nie jest zarchiwizowany. |
| `tournament_started` | 409 | Ponowne losowanie po starcie pierwszego meczu turnieju. |
| `fixture_not_ready` | 409 | Start meczu turnieju, który czeka na wyniki innych meczów, jest wolnym losem albo już ma wynik. |
| `tournament_not_finished` | 409 | Archiwizacja trwającego turnieju. |
| `tournament_archived` | 409 | Komenda w zarchiwizowanym turnieju. |
| `match_finished` | 409 | Rzutka po końcu gry. |
| `throws_not_allowed` | 409 | Rzutka w treningu checkoutów. Ten tryb przyjmuje tylko próby. |
| `not_checkouts` | 409 | Próba albo pominięcie checkoutu w grze, która nie jest treningiem checkoutów. |
| `event_id_conflict` | 409 | `eventId` jest już użyty w innej grze albo w tej samej grze z innym trafieniem. |
| `stale_state` | 409 | `expectedSeq` różni się od bieżącego `eventSeq` gry albo turnieju. Body ma pole `state` z bieżącym stanem gry albo `tournament` z bieżącym widokiem turnieju. Serwer nic nie zapisuje. |
| `nothing_to_undo` | 409 | W logu nie ma rzutki do cofnięcia, a w treningu checkoutów próby ani pominięcia. |
| `player_name_taken` | 409 | Imię zajęte przez innego zapisanego, niezarchiwizowanego gracza. Wielkość liter i nadmiarowe spacje się nie liczą. |
| `match_locked` | 409 | Cofnięcie w zakończonej grze po `editableUntil` albo cofnięcie rzutki kończącej mecz turnieju, gdy zaczął się mecz zależny od jego wyniku. Serwer nic nie zapisuje. |
| `fixture_not_finished` | 409 | Korekta wyniku meczu turnieju, który nie ma wyniku z gry (czeka, jest gotowy, trwa, jest walkowerem albo wolnym losem). |
| `invalid_result` | 400 | Korekta, w której zwycięzca nie ma dokładnie `legsToWin` legów meczu albo przegrany ma ich tyle samo lub więcej. |
| `dependent_started` | 409 | Korekta wyniku meczu turnieju, od którego zależy mecz już rozpoczęty. |
| `already_withdrawn` | 409 | Ponowne wycofanie tego samego gracza z turnieju. |
| `tournament_finished` | 409 | Wycofanie gracza z zakończonego turnieju. |
| `player_withdrawn` | 409 | Wznowienie porzuconego meczu turnieju, gdy jeden z jego graczy wycofał się z turnieju. |
| `internal_error` | 500 | Nieoczekiwany błąd serwera. |

Żądania POST z body muszą mieć nagłówek `content-type: application/json`. Bez niego curl wysyła dane formularza, a serwer odpowiada 400 `invalid_request` („Unsupported Media Type”). Cofnięcie, wznowienie, koniec treningu, pominięcie checkoutu oraz ponowne losowanie, start meczu i archiwizacja turnieju działają z tym nagłówkiem i bez niego.

### WebSocket

Adres bezpośredni: `ws://localhost:3000/matches/:id/live`. Przez proxy frontu: `/api/matches/:id/live`.

- Po połączeniu serwer wysyła jedno `state_updated` z bieżącym stanem.
- Po każdej nowej rzutce z `POST /matches/:id/throws`: `throw_registered`, potem zdarzenia domenowe, potem `state_updated`. Wszystkie mają ten sam `eventSeq`.
- Po `rest-miss`: jedno `throw_registered` na każdą zapisaną rzutkę, każde z `eventSeq` swojej rzutki, potem zdarzenia domenowe i `state_updated` z `eventSeq` ostatniej rzutki. Wcześniejszy `eventSeq` mają tylko `throw_registered` poprzednich rzutek.
- W meczu 1v1 po zdarzeniach domenowych, a przed `state_updated`, mogą przyjść wiadomości `achievement` (rekord gracza albo pierwsza tura 100+, 120+, 140+ lub 180), z tym samym `eventSeq` co `state_updated`.
- Po cofnięciu: `throw_undone`, potem `state_updated`. W treningu checkoutów po próbie, pominięciu i cofnięciu tylko `state_updated`.
- Po wycofaniu gracza z turnieju mecz, który to wycofanie porzuciło, dostaje `state_updated` z ustawionym `abandonment`. Mecz porzucony już wcześniej nie dostaje nic.
- Nieznana gra: serwer zamyka połączenie z kodem 4404.

Zdarzenia domenowe: `turn_completed`, `bust`, `leg_won`, `match_won`, `player_finished`, `casual_finished`. Pełna unia wiadomości to `LiveMessage`.

Turniej ma osobny kanał: `ws://localhost:3000/tournaments/:id/live` (przez proxy frontu `/api/tournaments/:id/live`), z tymi samymi zasadami połączenia i hasła co kanał gry. Jedyna wiadomość to `tournament_updated` z pełnym `TournamentView` (`TournamentLiveMessage`). Serwer wysyła ją po połączeniu, po każdej komendzie turnieju, która coś zapisała, i po każdej zmianie wygranych legów w meczu turnieju (wygrany leg albo cofnięcie rzutki, która go wygrała). Nieznany turniej zamyka połączenie z kodem 4404.

### Przykład z curl

Serwer musi działać na `http://localhost:3000`. Identyfikatory z odpowiedzi wstaw w miejsce `<PLAYER_1_ID>`, `<PLAYER_2_ID>`, `<MATCH_ID>`.

1. Dwóch graczy (201):

   ```sh
   curl -i -X POST http://localhost:3000/players -H 'content-type: application/json' -d '{"name":"Anna","avatar":"🎯"}'
   curl -i -X POST http://localhost:3000/players -H 'content-type: application/json' -d '{"name":"Bartek"}'
   ```

2. Mecz 1v1 (201):

   ```sh
   curl -i -X POST http://localhost:3000/matches -H 'content-type: application/json' \
     -d '{"type":"match","playerIds":["<PLAYER_1_ID>","<PLAYER_2_ID>"],"startingScore":501,"bestOf":3}'
   ```

3. Jedna rzutka, T20 (201). Własny `eventId` daje `uuidgen`, a bieżący czas w UTC `date -u +%Y-%m-%dT%H:%M:%SZ`. Ten sam `eventId` w kolejnej grze daje 409 `event_id_conflict`, więc przy następnej grze wstaw nowy UUID.

   ```sh
   curl -i -X POST http://localhost:3000/matches/<MATCH_ID>/throws -H 'content-type: application/json' \
     -d '{"eventId":"6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b","matchId":"<MATCH_ID>","source":"curl","sequence":0,"segment":20,"multiplier":3,"confidence":1,"detectedAt":"2026-10-18T18:30:12Z"}'
   ```

4. To samo body jeszcze raz (200 z `"events":[]`): powtórz polecenie z kroku 3.

5. Cofnięcie (200 z `undoneThrowId` równym `id` rzutki z kroku 3):

   ```sh
   curl -i -X POST http://localhost:3000/matches/<MATCH_ID>/undo
   ```

## Struktura repozytorium

```
packages/
  engine/   silnik gry: czysta logika X01, zabawy i treningu
  schema/   kontrakt: schematy Zod i typy wspólne dla wszystkich pakietów
  server/   API REST i WebSocket, log zdarzeń w SQLite
  web/      front React (ekran startowy, ekran gry z klawiaturą, statystyki, historia, ustawienia)
  audio/    głos i efekty dźwiękowe z wiadomości na żywo
e2e/        testy end-to-end (Playwright) na konfiguracji produkcyjnej
deploy/     skrypty wdrożenia i kopie zapasowe (opis w deploy/README.md)
design/     tokeny motywu i makiety
spikes/     eksperymenty z kamerą, poza buildem i lintem
rollout/    manifest planu PR-ów
```

Pakiet `vision` i katalog `fixtures` dojdą w etapie 2 (kamera).

README pakietów: [engine](packages/engine/README.md), [schema](packages/schema/README.md), [server](packages/server/README.md), [web](packages/web/README.md), [audio](packages/audio/README.md).

## Komendy

```sh
pnpm test        # testy wszystkich pakietów (Vitest)
pnpm typecheck   # tsc w każdym pakiecie
pnpm lint        # ESLint na całym repo, ostrzeżenie też jest błędem
pnpm format      # formatuje repo Prettierem
pnpm format:check   # sprawdza formatowanie bez zmiany plików
pnpm e2e         # testy end-to-end w Chromium (opis w e2e/README.md)
pnpm --filter @autoscore/engine test   # testy jednego pakietu
```

Kod formatuje Prettier według `.prettierrc.json`: pojedyncze cudzysłowy i szerokość linii 140. Markdown i HTML nie są formatowane, listę wyłączeń ma `.prettierignore`. Commit jednorazowego formatowania jest w `.git-blame-ignore-revs`, więc `git blame` go pomija (lokalnie po `git config blame.ignoreRevsFile .git-blame-ignore-revs`, GitHub sam).

ESLint sprawdza reguły typescript-eslint z informacją o typach, a w `packages/web` także reguły React hooks. Testy `engine` i `schema` liczą pokrycie i nie przechodzą poniżej progów z ich `vitest.config.ts`.

CI (`.github/workflows/ci.yml`) ma 8 jobów:

- `test`: `pnpm test`, w tym progi pokrycia w `engine` i `schema`,
- `typecheck`: `pnpm typecheck`,
- `lint`: `pnpm lint` i `pnpm format:check`,
- `build`: build frontu z `VITE_BASE=/`, jak przy wdrożeniu,
- `smoke`: start serwera bez hasła na pustej bazie i `GET /players` z odpowiedzią 200,
- `e2e`: `pnpm e2e` na zbudowanym froncie i serwerze z hasłem,
- `deploy-scripts`: shellcheck i testy skryptów z `deploy/`,
- `audit`: `pnpm audit --prod --audit-level high`, nie przechodzi przy podatnościach wysokich i krytycznych w zależnościach produkcyjnych.

Dependabot co tydzień proponuje aktualizacje npm i GitHub Actions.

## Zasady gry (X01) w skrócie

- Wyjście double-out: leg zamyka double albo Bull.
- Bust, gdy wynik spadłby poniżej zera, zostałaby dokładnie 1 albo zero padłoby bez doubla. Gracz wraca do wyniku sprzed tury, a tura się kończy.
- Rzutka poza tarczą lub odbita to miss za 0 pkt.
- Wejście straight-in: punkty liczą się od pierwszej rzutki.
- Punkty startowe: 301, 501 lub 701 (domyślnie 301).
- Mecz 1v1: best of 1, 3 lub 5 legów (domyślnie 1). Pierwszego rzucającego losuje serwer, kolejne legi zaczynają gracze na przemian.
- Zabawa dla 2-4 graczy: kto zamknie leg, zajmuje kolejne miejsce i wypada z kolejki. Ostatni grający dostaje ostatnie miejsce.
- Trening: Free run to swobodne rzucanie bez końca, które nie liczy się do statystyk. Solo 501 to zejście z 501 do zera na zasadach X01. Trening checkoutów losuje cel z zakresu `2-50` albo `51-100`, nigdy ten sam dwa razy z rzędu. Gracz zgłasza, czy zamknął. Po pudle cel zostaje, a nowy cel losuje się po udanej próbie albo po pominięciu („Nowa końcówka”). Pominięcie nie jest próbą. Sesja nie liczy się do statystyk.

Pełne zasady są w [CLAUDE.md](CLAUDE.md).

## Motyw i makiety

Motyw „Scena” to światło nad tarczą w ciemnej sali: ciepła czerń, kremowy tekst, czerwień tarczy jako jedyny akcent oraz fonty Barlow Condensed i Barlow. [design/theme.css](design/theme.css) to jedyne źródło kolorów, fontów, rozmiarów, promieni i cieni. Front importuje go w `packages/web/src/theme.css`. Kolor nie może sam nieść znaczenia: bust, wygrana i weryfikacja mają mieć też ikonę i tekst.

Zasady użycia motywu są w [design/scena/README.md](design/scena/README.md), wartości tokenów w [design/scena/tokens.json](design/scena/tokens.json), a makiety ekranów w [design/mockups/scena/](design/mockups/scena/). Liczby i gracze na makietach są przykładowe. Pliki `design/mockups/theme-a-*` to już tylko historyczne makiety dawnego motywu.

## Jak rozwijamy projekt

Projekt rośnie małymi PR-ami, po jednym kroku w każdym. PR trafia do `main` dopiero wtedy, gdy przechodzi wszystkie 8 jobów CI. Plan i decyzje są w [auto-score-dart-pomysly.md](auto-score-dart-pomysly.md), a zasady dla osób i agentów rozwijających kod w [CLAUDE.md](CLAUDE.md).
