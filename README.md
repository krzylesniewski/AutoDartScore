# AUTO Score

AUTO Score automatycznie liczy wynik w darcie. Dziś trafienia wpisuje się ręcznie na klawiaturze w aplikacji (symulator trafień). Później źródłem trafień będzie kamera USB. Wyjście to wynik na żywo, głosowy odczyt wyniku i efekty dźwiękowe. Projekt działa lokalnie: serwer, baza i front stoją na jednym komputerze w sieci domowej, bez internetu.

## Stan projektu

Działa na `main`:

- typy gier: mecz 1v1 (X01), zabawa dla 2-4 graczy z rankingiem miejsc, trening (Free run, Solo 501 i „Końcówki”: losowe końcówki z przedziału 2-50 albo 51-100, z podpowiedzią trasy i przyciskami „Udało się”, „Nie udało się” i „Nowa końcówka”. Po pudle końcówka zostaje do ponownej próby),
- kreator nowej gry: typ gry, lista graczy, dodawanie gracza (imię, avatar emoji, kolor, gość), punkty startowe, liczba legów w meczu 1v1, tryb treningu i przedział końcówek,
- ekran gry: pasek wyników, trzy sloty rzutek, suma tury, podpowiedź zamknięcia, klawiatura (1-20, 25, Miss, S/D/T) i przycisk „Cofnij”,
- stan na żywo przez WebSocket, z ponownym połączeniem po zerwaniu,
- głosowy odczyt wyniku tury, komunikaty „Bust” i „Zwycięzca” oraz efekty dźwiękowe, każde z przełącznikiem na ekranie gry.

Jeszcze nie ma:

- Statystyk i ekranu podsumowania lega lub meczu.
- Historii meczów oraz przerywania i wznawiania gry.
- Działających przycisków „Nowa runda” i „Do weryfikacji”. Na ekranie gry są nieaktywne, z etykietą „Wkrótce”.
- Weryfikacji rzutek na ekranie gry. Serwer już przyjmuje rzutki do weryfikacji (`confidence` poniżej progu), oznaczenia i weryfikacje, ale ekran ich jeszcze nie pokazuje.
- Kamery. Detekcja przyjdzie w etapie 2.

Etap 1 (Mac bez kamery) nie jest jeszcze skończony.

## Wymagania

- Node 24. `nvm use` czyta wersję z `.nvmrc`.
- pnpm 12. Dokładna wersja jest w polu `packageManager` w `package.json`.
- Dziś macOS. Docelowo mini PC z Linuksem.
- ffmpeg i ffprobe na `PATH`. Potrzebuje ich pakiet `vision` i jego testy, więc także `pnpm test`.

## Instalacja i uruchomienie

```sh
nvm use
pnpm install
pnpm dev
```

`pnpm dev` uruchamia równolegle serwer (`http://localhost:3000`) i front (domyślnie `http://localhost:5173`). Aplikację otwierasz pod adresem frontu.

Tablet w tej samej sieci otwiera `http://<adres-IP-komputera>:5173`. Tablet potrzebuje tylko portu 5173, bo front przekazuje zapytania do API przez proxy `/api`. Jeśli macOS pyta o połączenia przychodzące, zezwól na nie w zaporze (Ustawienia systemowe, Sieć, Zapora).

Serwer przy starcie wykonuje migracje bazy. Plik bazy powstaje domyślnie w `packages/server/autoscore.sqlite`, bo pnpm uruchamia skrypty w katalogu pakietu. Pliki `*.sqlite` są w `.gitignore`.

Sam serwer, bez frontu i bez trybu watch:

```sh
pnpm --filter @autoscore/server start
```

## Konfiguracja

Konfiguracja idzie przez zmienne środowiskowe.

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `PORT` | `3000` | Port serwera API. |
| `HOST` | `0.0.0.0` | Adres nasłuchu serwera. Domyślny pozwala połączyć się z innych urządzeń w sieci. |
| `DATABASE_PATH` | `autoscore.sqlite` | Ścieżka pliku SQLite, względna wobec katalogu, w którym działa proces serwera. |
| `AUTOSCORE_API_URL` | `http://localhost:3000` | Adres serwera, na który proxy Vite przekazuje `/api`. Czyta go też pakiet `vision`, gdy wysyła klatkę z kamery. Musi być adresem `http:` albo `https:`, inaczej `vision` kończy pracę z błędem `Invalid AUTOSCORE_API_URL`. |
| `AUTOSCORE_MATCH_LOCK_MINUTES` | `5` | Ile minut po wpisie kończącym grę (rzutce albo weryfikacji) da się jeszcze cofać, oznaczać i weryfikować rzutki. `0` zamyka grę od razu. Wartość spoza samych cyfr albo większa niż `525600` (rok) zatrzymuje start z błędem `Invalid AUTOSCORE_MATCH_LOCK_MINUTES`. |
| `AUTOSCORE_PENDING_CONFIDENCE` | `0.8` | Rzutka z `confidence` poniżej tego progu czeka na weryfikację. Liczba dziesiętna od `0` do `1`, na przykład `0.75`. Inna wartość zatrzymuje start z błędem `Invalid AUTOSCORE_PENDING_CONFIDENCE`. |
| `AUTOSCORE_CAMERA_NAME` | `HD Pro Webcam C920:none` | Nazwa kamery w AVFoundation (macOS) dla pakietu `vision`. Kamerę wybieramy po nazwie, bo indeksy zmieniają się po restarcie. |
| `AUTOSCORE_CAMERA_VIDEO` | brak | Nagranie wideo zamiast kamery w pakiecie `vision`. Wygrywa z `AUTOSCORE_CAMERA_NAME`. Ścieżka względna liczy się od katalogu, w którym działa proces. |
| `AUTOSCORE_PASSWORD` (`vision`) | brak | Hasło, którym pakiet `vision` loguje się do serwera (`POST /auth/login`) przed wysłaniem klatki. Ustaw to samo hasło co na serwerze. Puste albo brak oznacza wysyłkę bez logowania. |

`PORT` musi składać się z samych cyfr i nie przekraczać 65535. Inaczej serwer kończy pracę przy starcie z błędem `Invalid PORT`. Po zmianie `PORT` ustaw `AUTOSCORE_API_URL` na ten sam port, na przykład:

```sh
PORT=3100 AUTOSCORE_API_URL=http://localhost:3100 pnpm dev
```

## API w skrócie

Typy żądań, odpowiedzi i wiadomości są zdefiniowane tylko w [packages/schema](packages/schema/README.md) (Zod).

| Metoda | Ścieżka | Opis |
|---|---|---|
| `GET` | `/players` | Lista graczy bez gości, posortowana po imieniu. |
| `POST` | `/players` | Nowy gracz (`CreatePlayerRequest`: `name` 1-40 znaków po obcięciu spacji, opcjonalny `avatar` 1-16 znaków, opcjonalny `color` 1-16, `guest` domyślnie `false`). Bez `color` gracz dostaje stały kolor wyliczony z `id`. Odpowiedź 201 z `Player`. Imię zajęte przez innego zapisanego, niezarchiwizowanego gracza daje 409 `player_name_taken` (nie dotyczy gości). |
| `POST` | `/matches` | Nowa gra (`CreateMatchRequest`, rodzaj w polu `type`). Odpowiedź 201 z `MatchSnapshot`. |
| `GET` | `/matches/:id` | Bieżący stan gry (`MatchSnapshot`). |
| `POST` | `/matches/:id/throws` | Rzutka (`HitEvent`). Odpowiedź 201 z `{ throw, events, state }`. Rzutka do weryfikacji i rzutka, która czeka za nią, dają `events: []`. |
| `POST` | `/matches/:id/throws/:throwId/flag` | Ręczne oznaczenie rzutki ostatniej tury do weryfikacji (powód `manual`). Body jest ignorowane. Rzutka i kolejne rzutki jej tury przestają się liczyć, aż do weryfikacji. Oznaczenie rzutki kończącej grę otwiera grę na nowo. Odpowiedź 200 z `ReviewResult` (`{ throw, events, state }`) i `events: []`. |
| `POST` | `/matches/:id/throws/:throwId/verify` | Weryfikacja rzutki do weryfikacji (`VerifyThrowRequest`: `{ segment, multiplier }`). Ta sama wartość potwierdza odczyt, inna go poprawia. Odpowiedź 200 z `ReviewResult`, w którym `events` to zdarzenia domenowe wywołane weryfikacją. |
| `GET` | `/matches/:id/review-queue` | Rzutki do weryfikacji (`status: 'pending'`) w kolejności z logu. Odpowiedź 200 z `ReviewQueue` (`{ matchId, eventSeq, throws }`). |
| `POST` | `/matches/:id/checkout-attempts` | Próba w treningu checkoutów (`CheckoutAttemptRequest`: `{ success }`). Odpowiedź 201 z `MatchSnapshot`. Po udanej próbie `checkouts` ma nowy cel, po nieudanej ten sam. Sesje zapisane przed wprowadzeniem tej zasady dostają nowy cel po każdej próbie. Inna gra daje 409 `not_checkouts`, zakończony trening 409 `practice_ended`, a porzucony 409 `match_abandoned`. |
| `POST` | `/matches/:id/checkout-skips` | Pominięcie celu w treningu checkoutów: nowy cel bez próby. Body jest ignorowane. Odpowiedź 201 z `MatchSnapshot`, w którym `attempts`, `successes` i `history` się nie zmieniają, a `skips` rośnie o 1. Błędy jak przy próbie, nieznana gra daje 404 `not_found`. |
| `POST` | `/matches/:id/undo` | Cofnięcie ostatniej rzutki, także rzutki do weryfikacji albo rzutki, która się nie liczy. Body jest ignorowane. Odpowiedź 200 z `{ undoneThrowId, state }`. W zakończonej grze działa do `editableUntil` ze stanu gry (`finishedAt` plus `AUTOSCORE_MATCH_LOCK_MINUTES`), potem daje 409 `match_locked`. W treningu checkoutów cofa ostatnią próbę albo ostatnie pominięcie, przywraca poprzedni cel i zwraca `undoneThrowId: null`. |
| WebSocket | `/matches/:id/live` | Strumień stanu i zdarzeń jednej gry. |
| `PUT` | `/cameras/:cameraId/snapshot` | Ostatnia klatka z kamery jako JPEG (`content-type: image/jpeg`, do 8 MiB). Odpowiedź 204. Body, które nie jest JPEG-iem, daje 400 `invalid_request`. Serwer trzyma klatkę tylko w pamięci. |
| `GET` | `/cameras/:cameraId/snapshot` | Ostatnia klatka (`image/jpeg`, `cache-control: no-store`). 404 `not_found`, dopóki kamera nic nie wysłała od startu serwera. |
| `PUT` | `/cameras/:cameraId/calibration` | Zapis kalibracji (`CameraCalibration`: rozmiar obrazu i 4 punkty). Odpowiedź 200 z zapisaną kalibracją. Każdy zapis to nowy wiersz, nic nie jest nadpisywane. |
| `GET` | `/cameras/:cameraId/calibration` | Ostatnio zapisana kalibracja. 404 `not_found`, gdy jej nie ma. |

`cameraId` to małe litery, cyfry i `-` (do 32 znaków), inny daje 400 `invalid_request`. MVP ma jedną kamerę, `camera-1`.

Rodzaje gry w `POST /matches`:

- `match`: dokładnie 2 różnych graczy w `playerIds`, `startingScore` 301, 501 lub 701 (domyślnie 301), `bestOf` 1, 3 lub 5 (domyślnie 1),
- `casual`: 2-4 różnych graczy i `startingScore` (domyślnie 301),
- `practice`: `practiceMode` `free_run`, `solo_501` albo `checkouts` i jeden gracz. `checkouts` wymaga `checkoutRange` (`2-50` albo `51-100`), a inne tryby go nie przyjmują.

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

Opcjonalne pole `review` przysyła detektor, gdy odczyt jest niepewny: `reason` (`low_confidence`, `near_wire`, `detector_disagreement` albo `occlusion`), `candidates` (do 10 odczytów z `probability` od 0 do 1, domyślnie pusta lista), opcjonalne `frames` (`before` i `after`, ścieżki względne bez `..`) i opcjonalny `tip` (`x` i `y` w pikselach obrazu). Serwer zapisuje je przy rzutce bez zmian.

Kodowanie: miss to `segment: 0, multiplier: 0`. Outer Bull to `segment: 25, multiplier: 1` (25 pkt). Bull to `segment: 25, multiplier: 2` (50 pkt, liczy się jako double). `segment: 25, multiplier: 3` jest odrzucane.

### Weryfikacja rzutek

Rzutka z `confidence` poniżej `AUTOSCORE_PENDING_CONFIDENCE` dostaje oznaczenie do weryfikacji od systemu, z powodem z `review.reason` albo `low_confidence`. Gracz może też ręcznie oznaczyć rzutkę ostatniej tury. Rzutka do weryfikacji (`status: 'pending'`) się nie liczy: tura zostaje otwarta, wynik nie jest odczytywany, a kolejne rzutki tej tury czekają za nią (`scoring: 'waiting'`). Czwarta rzutka w takiej turze daje 409 `turn_pending`. Weryfikacja ustala wartość rzutki, a serwer odtwarza log od nowa, więc poprawka przelicza turę, bust, leg, checkout i zwycięzcę. Gdy po weryfikacji tura kończy się przed czekającymi rzutkami (bust albo zamknięcie lega), te rzutki się nie liczą (`scoring: 'void'`) i nie przechodzą na następnego gracza.

`MatchSnapshot` ma `lastTurnThrows` (rzutki ostatniej tury jako `ReviewedThrow`) i `awaitingReview` (czy któraś rzutka czeka). `ReviewedThrow` ma pierwotny odczyt w `reading`, wartość po weryfikacji w `value` i ostatnie oznaczenie w `review` (`resolved` po weryfikacji). Oznaczenia i weryfikacje są nowymi wpisami w logu, a wiersz rzutki się nie zmienia.

### Idempotencja i błędy

Ponowne wysłanie rzutki z tym samym `eventId` do tej samej gry daje 200 z zapisaną rzutką i `events: []`. Serwer nic wtedy nie zapisuje, niczego nie oznacza i nic nie wysyła przez WebSocket. Cofnięcie jest nowym wpisem w logu. Wiersz rzutki zostaje w bazie.

Każdy błąd ma postać `{ "error": "<kod>", "message": "<opis>" }` (`ApiError`).

| Kod | HTTP | Kiedy |
|---|---|---|
| `invalid_request` | 400 | Body nie pasuje do schematu, niepoprawny JSON, brak lub zły `content-type`. |
| `invalid_config` | 400 | Silnik odrzucił konfigurację gry. |
| `unknown_player` | 400 | `playerIds` zawiera nieznanego gracza. |
| `match_mismatch` | 400 | `matchId` w body różni się od `:id` w adresie. |
| `not_found` | 404 | Nieznana gra (GET, rzutka, cofnięcie, oznaczenie, weryfikacja, kolejka weryfikacji), rzutka spoza tej gry w oznaczeniu albo weryfikacji, albo nieznana ścieżka. |
| `match_finished` | 409 | Rzutka po końcu gry. |
| `throws_not_allowed` | 409 | Rzutka, oznaczenie albo weryfikacja w treningu checkoutów. Ten tryb przyjmuje tylko próby. |
| `turn_pending` | 409 | Czwarta rzutka w turze, która czeka na weryfikację. Serwer nic nie zapisuje. |
| `throw_not_flaggable` | 409 | Oznaczenie rzutki spoza ostatniej tury, rzutki, która się nie liczy (`void`), albo rzutki cofniętej. |
| `throw_already_pending` | 409 | Oznaczenie rzutki, która już czeka na weryfikację. |
| `throw_not_pending` | 409 | Weryfikacja rzutki, która nie czeka na weryfikację. |
| `not_checkouts` | 409 | Próba albo pominięcie checkoutu w grze, która nie jest treningiem checkoutów. |
| `event_id_conflict` | 409 | `eventId` jest już użyty w innej grze. |
| `nothing_to_undo` | 409 | W logu nie ma rzutki do cofnięcia, a w treningu checkoutów próby ani pominięcia. |
| `player_name_taken` | 409 | Imię zajęte przez innego zapisanego, niezarchiwizowanego gracza. Wielkość liter i nadmiarowe spacje się nie liczą. |
| `match_locked` | 409 | Cofnięcie, oznaczenie albo weryfikacja w zakończonej grze po `editableUntil`. Serwer nic nie zapisuje. |
| `internal_error` | 500 | Nieoczekiwany błąd serwera. |

Żądania POST z body muszą mieć nagłówek `content-type: application/json`. Bez niego curl wysyła dane formularza, a serwer odpowiada 400 `invalid_request` („Unsupported Media Type”). Cofnięcie i oznaczenie działają z tym nagłówkiem i bez niego.

### WebSocket

Adres bezpośredni: `ws://localhost:3000/matches/:id/live`. Przez proxy frontu: `/api/matches/:id/live`.

- Po połączeniu serwer wysyła jedno `state_updated` z bieżącym stanem.
- Po każdej nowej rzutce: `throw_registered`, potem zdarzenia domenowe, potem `state_updated`. Wszystkie wiadomości jednej komendy mają ten sam `eventSeq`, czyli seq ostatniego zapisanego wpisu.
- Po rzutce do weryfikacji: `throw_registered`, `throw_flagged`, `state_updated`. Po rzutce, która czeka za nią: `throw_registered`, `state_updated`. Zdarzeń domenowych wtedy nie ma.
- Po oznaczeniu: `throw_flagged`, potem `state_updated`.
- Po weryfikacji: `throw_verified`, potem zdarzenia domenowe, potem `achievement`, potem `state_updated`.
- W meczu 1v1 po zdarzeniach domenowych rzutki albo weryfikacji, a przed `state_updated`, mogą przyjść wiadomości `achievement` (rekord gracza albo pierwsza tura 100+, 120+, 140+ lub 180), z tym samym `eventSeq`.
- Po cofnięciu: `throw_undone`, potem `state_updated`. W treningu checkoutów po próbie, pominięciu i cofnięciu tylko `state_updated`.
- Nieznana gra: serwer zamyka połączenie z kodem 4404.

Zdarzenia domenowe: `turn_completed`, `bust`, `leg_won`, `match_won`, `player_finished`, `casual_finished`. Przychodzą dopiero wtedy, gdy rzutki się liczą. Pełna unia wiadomości to `LiveMessage`.

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
  web/      front React (ekran gry, kreator, klawiatura)
  audio/    głos i efekty dźwiękowe z wiadomości na żywo
  vision/   źródła klatek, geometria tarczy, homografia, ewaluacja detekcji i wysyłka klatki do kalibracji
design/     tokeny motywu i makiety
spikes/     eksperymenty z kamerą, poza buildem i lintem
fixtures/   klatki z tarczy z oznaczonym wynikiem, zestaw testowy detekcji
rollout/    manifest planu PR-ów
```

Pakiet `vision` ma źródła klatek, geometrię tarczy, homografię z obrazu na tarczę, ewaluację detekcji na zestawie z `fixtures/` i komendę, która wysyła jedną klatkę do kalibracji. Detektor to na razie baseline, który nie odczytuje segmentu. Odczyt trafień dojdzie w kolejnych krokach etapu 2.

### Kalibracja kamery

1. Uruchom serwer (`pnpm dev` albo `pnpm --filter @autoscore/server start`).
2. Na komputerze z kamerą wyślij jedną klatkę: `pnpm --filter @autoscore/vision snapshot`. Kamerę na żywo uruchamia człowiek, bo zgodę na kamerę w macOS dostaje Terminal. Przy innym porcie serwera albo z hasłem ustaw `AUTOSCORE_API_URL` i `AUTOSCORE_PASSWORD`.
3. Otwórz Ustawienia → Kalibracja kamery i dotknij 4 punktów na zewnętrznej krawędzi pierścienia double, w kolejności z ekranu. Lupa pod palcem pomaga trafić w drut, a siatka segmentów na obrazie pokazuje, czy punkty pasują.
4. Zapisz kalibrację. Tryb „Plik JPEG” wczytuje zdjęcie z dysku i pobiera `calibration.json` dla sesji w `/fixtures`, bez zapisu na serwerze.

README pakietów: [engine](packages/engine/README.md), [schema](packages/schema/README.md), [server](packages/server/README.md), [web](packages/web/README.md), [audio](packages/audio/README.md), [vision](packages/vision/README.md).

## Komendy

```sh
pnpm test        # testy wszystkich pakietów (Vitest)
pnpm typecheck   # tsc w każdym pakiecie
pnpm lint        # ESLint na całym repo
pnpm --filter @autoscore/engine test   # testy jednego pakietu
pnpm --filter @autoscore/vision eval   # ewaluacja detekcji na fixtures/ (--json <plik> zapisuje raport)
```

CI uruchamia te same trzy checki: `test`, `typecheck` i `lint`.

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

[design/theme.css](design/theme.css) to jedyne źródło kolorów, fontów, rozmiarów i promieni (motyw A, ciemny klasyczny). Front importuje go w `packages/web/src/theme.css`. Kolor nie może sam nieść znaczenia: bust, wygrana i weryfikacja mają mieć też ikonę i tekst.

Makiety są w [design/mockups](design/mockups). Liczby i gracze na nich są przykładowe. Makiety ekranu gry nie mają klawiatury ręcznego wpisu, dodanej w tym samym stylu.

**Ekran gry:** [2 graczy](design/mockups/theme-a-2-players.png), [4 graczy](design/mockups/theme-a-4-players.png).

![Ekran gry, 2 graczy](design/mockups/theme-a-2-players.png)

**Ekran startowy (Home, „Nowa gra”):** [makieta](design/mockups/theme-a-new-game.png) ([HTML](design/mockups/theme-a-new-game.html)), [wariant z 10 graczami](design/mockups/theme-a-new-game-10-players.png) ([HTML](design/mockups/theme-a-new-game-10-players.html)).

![Ekran startowy](design/mockups/theme-a-new-game.png)

**Statystyki:** [makieta](design/mockups/theme-a-stats.png) ([HTML](design/mockups/theme-a-stats.html)).

![Ekran statystyk](design/mockups/theme-a-stats.png)

Makiety ekranu startowego i statystyk powstały przed decyzjami z planu. Obowiązuje opis w [auto-score-dart-pomysly.md](auto-score-dart-pomysly.md), sekcja „Ekran startowy i statystyki: punkty do implementacji” wraz z „Decyzjami” (np. statystyki to lista graczy według średniej i 4 kafelki top 3).

## Jak rozwijamy projekt

Projekt rośnie małymi PR-ami, po jednym kroku w każdym. PR trafia do `main` dopiero przy zielonych `test`, `typecheck` i `lint`. Plan i decyzje są w [auto-score-dart-pomysly.md](auto-score-dart-pomysly.md), a zasady dla osób i agentów rozwijających kod w [CLAUDE.md](CLAUDE.md).
