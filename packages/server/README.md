# @autoscore/server

Serwer API: REST i WebSocket na Fastify. Jest jedynym źródłem prawdy o stanie gry.

Serwer zapisuje jako wpis w logu zdarzeń w SQLite:

- każdą rzutkę,
- każdą próbę i każde pominięcie checkoutu,
- każde cofnięcie,
- każde porzucenie i wznowienie gry,
- zakończenie treningu.

Stan gry nie jest zapisywany. Serwer odtwarza go z rzutek, prób i pominięć, które nadal się liczą, przez silnik z `@autoscore/engine`. Status porzucenia wynika z wpisów porzucenia i wznowienia, a status `ended` z wpisu zakończenia treningu. Komendy jednej gry wykonują się po kolei, a różne gry nie blokują się nawzajem.

Trening checkoutów:

- Wiersz gry ma zakres i ziarno losowania celów, które serwer losuje raz przy utworzeniu, oraz zasadę losowania w kolumnie `checkout_rule`.
- Nowe sesje mają `repeat_on_miss` (po nieudanej próbie cel zostaje). Migracja `0006_checkout_rule` daje sesjom zapisanym wcześniej `new_each_attempt` (nowy cel po każdej próbie), więc odtwarzają się jak dotąd. Inne gry mają `null`.
- Ziarno i zasada nie wychodzą poza serwer.
- Wpisy w logu: `checkout_attempt` (z `success`), `checkout_attempt_undone`, `checkout_skipped` (`POST /matches/:id/checkout-skips`) i `checkout_skip_undone`.
- Cofnięcie zdejmuje ostatni krok, próbę albo pominięcie. Wpis cofnięcia, który nie pasuje do ostatniego kroku, to uszkodzony log.

Profil gracza też nie jest nadpisywany:

- Wiersz w `players` zostaje taki, jak przy utworzeniu gracza. Każda zmiana imienia, avatara, koloru, archiwizacji albo zapisu gościa dopisuje do `player_changes` pełny profil z kolejnym `seq`.
- Każdy odczyt gracza bierze wiersz z najwyższym `seq`, więc gry, historia i ranking pokazują aktualne imię.
- Gracz bez wybranego koloru dostaje kolor 1-16 wyliczony z `id` (`defaultPlayerColor`), więc zawsze ten sam.
- Dwóch zapisanych, niezarchiwizowanych graczy nie może mieć tego samego imienia, bez względu na wielkość liter i nadmiarowe spacje. Dawne duplikaty zostają w danych, a serwer odrzuca z 409 `player_name_taken` tylko utworzenie albo zmianę, która tworzy nowy duplikat.

Baza to SQLite przez wbudowany moduł `node:sqlite` i Kysely, bez natywnych bindingów. Migracje używają tylko typów text, integer i real i nie używają funkcji JSON, żeby dało się przejść na PostgreSQL.

## Uruchomienie

```sh
pnpm --filter @autoscore/server dev     # node --watch, restart po zmianie kodu
AUTOSCORE_AUTH=off pnpm --filter @autoscore/server start
```

Oba skrypty uruchamiają `src/main.ts` przez `jiti`, bez kroku budowania. Przy starcie serwer wykonuje migracje. `start` bez hasła wymaga `AUTOSCORE_AUTH=off`, inaczej serwer nie wstaje. `dev` ustawia `AUTOSCORE_AUTH=off`, chyba że zmienna jest już ustawiona. Z hasłem ustawionym w powłoce `pnpm dev` wymaga więc `AUTOSCORE_AUTH=on`, inaczej zatrzymuje się na błędzie konfliktu (niżej). Zmienne `PORT`, `HOST` i `DATABASE_PATH`, trasy API i przykład z curl opisuje [README w katalogu głównym](../../README.md).

## Hasło i CORS

Serwer może działać w internecie za jednym wspólnym hasłem. Hasło jest domyślnie wymagane: bez `AUTOSCORE_PASSWORD` serwer wstaje tylko z jawnym `AUTOSCORE_AUTH=off`, przeznaczonym do pracy lokalnej. Nagłówki CORS są domyślnie wyłączone (front w trybie dev woła API przez proxy Vite).

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `AUTOSCORE_AUTH` | `on` | `on` wymaga hasła. `off` wyłącza logowanie, a serwer zapisuje przy starcie ostrzeżenie `Authentication is off (AUTOSCORE_AUTH=off)` w logu. `off` razem z niepustym `AUTOSCORE_PASSWORD` zatrzymuje start błędem `AUTOSCORE_AUTH=off conflicts with AUTOSCORE_PASSWORD`. Pusta wartość znaczy `on`, a każda inna niż `on` i `off` daje `Invalid AUTOSCORE_AUTH`. |
| `AUTOSCORE_PASSWORD` | brak | Wspólne hasło. Przy `AUTOSCORE_AUTH=on` brak hasła albo pusta wartość zatrzymuje start błędem `Missing AUTOSCORE_PASSWORD`, a hasło przykładowe z `deploy/autoscore.env.example` (także ze spacjami wokół) błędem `Invalid AUTOSCORE_PASSWORD`. Przy `AUTOSCORE_AUTH=off` musi być puste, a `AUTOSCORE_TOKEN_SECRET` jest wtedy pomijany. |
| `AUTOSCORE_TOKEN_SECRET` | brak | Klucz do podpisu tokenów, co najmniej 32 znaki. Wymagany, gdy hasło jest ustawione. Bez niego serwer nie wstaje (`Missing AUTOSCORE_TOKEN_SECRET`), a za krótki daje `Invalid AUTOSCORE_TOKEN_SECRET`. |
| `AUTOSCORE_CORS_ORIGIN` | brak (wyłączone) | Lista originów frontu po przecinku, np. `https://front.example,http://localhost:5173`. Spacje i puste wpisy są pomijane. |
| `AUTOSCORE_TRUST_PROXY` | `off` | `on` bierze adres klienta z nagłówka `X-Forwarded-For`. Ustaw `on` tylko za reverse proxy, inaczej zostaw `off`. Pusta wartość znaczy `off`, a każda inna niż `on` i `off` zatrzymuje start błędem `Invalid AUTOSCORE_TRUST_PROXY`. |

Sekret wygenerujesz przez `openssl rand -hex 32`. Token jest podpisany HMAC-SHA256 i ważny 30 dni. Klucz podpisu powstaje z sekretu i hasła. Serwer nie przechowuje tokenów, więc nowe hasło albo nowy sekret wylogowuje wszystkie urządzenia. Tokeny wydane przed tą wersją serwer odrzuca, więc każde urządzenie loguje się raz od nowa.

Każdy wpis w `AUTOSCORE_CORS_ORIGIN` musi być samym originem: schemat, host i opcjonalny port, bez ścieżki i bez końcowego ukośnika. `https://front.example/`, `https://front.example/app`, `*` albo `front.example` zatrzymują start błędem `Invalid AUTOSCORE_CORS_ORIGIN`, bo nigdy nie pasowałyby do nagłówka `Origin` z przeglądarki.

### HTTP

- `GET /health` zwraca `{ "status": "ok" }` i nigdy nie wymaga tokenu.
- `POST /auth/login` z `{ "password": "…" }` zwraca `{ "token": "…", "expiresAt": "…" }`. Trasa istnieje tylko z ustawionym hasłem, inaczej odpowiada 404. Złe hasło daje 401 `invalid_password`, a niepoprawne body 400.
- Po 10 nieudanych logowaniach z jednego adresu klienta w ciągu minuty serwer odpowiada temu adresowi 429 `too_many_attempts` z nagłówkiem `Retry-After` w sekundach, nawet na poprawne hasło. Po 100 nieudanych logowaniach w ciągu minuty ze wszystkich adresów razem 429 dostaje każdy klient. Oba limity są trzymane w pamięci, restart je zeruje.
- Z `AUTOSCORE_TRUST_PROXY=on` adres klienta pochodzi z `X-Forwarded-For`, który klient może podrobić, więc prawdziwą granicą jest limit dla wszystkich adresów.
- Z ustawionym hasłem każde inne żądanie HTTP, także do nieznanej trasy, wymaga nagłówka `Authorization: Bearer <token>`. Bez niego albo z nieważnym tokenem odpowiedź to 401 `unauthorized`. `OPTIONS` oraz `GET` i `HEAD` do plików frontu (niżej) nie wymagają tokenu, a WebSocket uwierzytelnia się pierwszą wiadomością (niżej).
- Z ustawionym `AUTOSCORE_CORS_ORIGIN` tylko wymienione originy dostają `Access-Control-Allow-Origin`, także na odpowiedzi 401. Preflight dopuszcza metody `GET`, `HEAD`, `POST` i `PATCH` oraz nagłówki `Authorization` i `Content-Type`.

```sh
curl -s -X POST https://api.example/auth/login -H 'content-type: application/json' -d '{"password":"…"}'
curl -s https://api.example/players -H "authorization: Bearer $TOKEN"
```

### WebSocket

- Przeglądarka nie ustawi nagłówka na WebSocket, a token w adresie trafiłby do logów proxy. Dlatego z ustawionym hasłem pierwsza wiadomość klienta to `{ "type": "auth", "token": "…" }`. Token w adresie jest pomijany.
- Bez tej wiadomości w ciągu 5 s, z niepoprawnym JSON, inną wiadomością albo złym tokenem serwer zamyka połączenie z kodem 4401. Do tego czasu serwer nie wysyła żadnej wiadomości. Po poprawnym `auth` pierwszą wiadomością jest `state_updated`, a nieznana gra zamyka połączenie z kodem 4404. Kolejne wiadomości klienta są pomijane.
- Z ustawionym `AUTOSCORE_CORS_ORIGIN` połączenie z nagłówkiem `Origin` spoza listy dostaje 403 przed zmianą protokołu. Brak nagłówka `Origin` (curl, skrypty) jest dopuszczony.
- Wiadomość klienta może mieć najwyżej 4 KiB. Większa zamyka połączenie z kodem 1009, zanim serwer ją odczyta.
- Z ustawionym hasłem na wiadomość `auth` może czekać naraz najwyżej 20 połączeń. Kolejne serwer zamyka od razu z kodem 4429. Miejsce zwalnia się po pierwszej wiadomości, po upływie 5 s albo po zamknięciu połączenia. Bez hasła ten limit nie obowiązuje.
- Serwer wysyła ramkę ping co 30 s na każdym połączeniu, z hasłem i bez, żeby reverse proxy nie zamknął bezczynnego połączenia. Połączenie, które nie odpowie ramką pong przed kolejnym pingiem, serwer zrywa.
- Klienta z ponad 1 MiB niewysłanych danych serwer rozłącza bez ramki zamknięcia, żeby wolny klient nie trzymał pamięci serwera. Klient w przeglądarce łączy się ponownie i dostaje świeży `state_updated`.

## Front z serwera

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `AUTOSCORE_WEB_DIR` | brak (wyłączone) | Katalog zbudowanego frontu, zwykle `packages/web/dist`. Ścieżka względna liczy się od katalogu roboczego serwera. Pusta wartość wyłącza serwowanie plików. |

Z ustawioną zmienną serwer podaje pliki z tego katalogu obok API, więc cała aplikacja działa pod jednym adresem. `GET /` zwraca `index.html`, a każdy inny plik ma własną trasę `GET` (i `HEAD`) pod swoją ścieżką. Listę plików serwer czyta raz przy starcie. Pomija pliki i katalogi z kropką na początku oraz ścieżki ze znakami spoza `A-Z`, `a-z`, `0-9` i `._~/-`. Nie ma listowania katalogów ani przekierowania nieznanych ścieżek na `index.html`, bo front używa routingu po `#`.

Nagłówek `Cache-Control`:

- `/` i `/index.html`: `no-cache`,
- `/assets/*`: `public, max-age=31536000, immutable` (nazwy plików zawierają hash),
- `/audio/*`: `public, max-age=604800`,
- pozostałe pliki: `no-cache`.

Trasy API mają pierwszeństwo. Plik, którego pierwszy segment ścieżki pokrywa się z trasą API (`health`, `auth`, `players`, `matches`, `stats`), jest pomijany z ostrzeżeniem w logu. Pliki frontu ładują się bez tokenu, żeby przeglądarka dostała ekran logowania. API dalej wymaga tokenu, a brakujący plik daje bez tokenu 401, z tokenem 404.

Gdy w katalogu nie ma czytelnego `index.html`, także gdy katalog nie istnieje, serwer nie wstaje z błędem `Missing index.html in AUTOSCORE_WEB_DIR: <katalog>`.

## Zamknięcie zakończonej gry

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `AUTOSCORE_MATCH_LOCK_MINUTES` | `5` | Ile minut po rzutce kończącej mecz 1v1, zabawę albo Solo 501 da się jeszcze cofać. `0` zamyka grę od razu. |

Stan gry podaje `finishedAt` (czas przyjęcia rzutki kończącej grę) i `editableUntil` (`finishedAt` plus ta liczba minut). Oba pola są `null`, dopóki gra trwa. Od chwili `editableUntil` cofnięcie dostaje 409 `match_locked`, a log się nie zmienia. Cofnięcie rzutki kończącej grę w oknie otwiera grę, a kolejne zakończenie liczy okno od nowa. Wartość spoza samych cyfr albo większa niż `525600` (rok) zatrzymuje start z błędem `Invalid AUTOSCORE_MATCH_LOCK_MINUTES: <wartość>`.

Stan gry podaje też `round` (kolejka rzucającego w bieżącym legu, liczona od 1, `null` po końcu gry, w Free run i w treningu checkoutów), `startedAt` i `legStartedAt` (czas przyjęcia pierwszej liczonej rzutki gry i bieżącego lega, `null` przed nią i zawsze w treningu checkoutów, który nie ma rzutek) oraz `pausedMs` i `legPausedMs` (suma zamkniętych przerw od porzucenia do wznowienia, liczona od `startedAt` i od `legStartedAt`). Wszystkie czasy pochodzą z logu, więc cofnięcie rzutki przesuwa je razem ze stanem. Otwarte porzucenie nie wchodzi do sumy przerw.

Pole `legTurns` to zamknięte tury bieżącego lega w kolejności rzutów. Każdy wpis ma gracza (`playerId`), numer tury (`turnIndex`), rzutki (`darts`), zdobyte punkty (`points`), wynik po turze (`remainingAfter`) i znacznik `bust`.

- Otwarta tura nie trafia na listę, jej rzutki są w `currentDarts`.
- Bust ma `points: 0` i `remainingAfter` równe wynikowi sprzed tury.
- Nowy leg zaczyna się z pustą listą, a po rzutce kończącej mecz zostają tury ostatniego lega.
- W Free run turą jest każde pełne podejście po 3 rzutki, a `remainingAfter` jest `null`.
- W treningu checkoutów lista jest zawsze pusta.
- Cofnięcie rzutki przelicza listę z logu razem z resztą stanu.

## Powtórzone komendy

Cofnięcie, próba i pominięcie checkoutu, porzucenie, wznowienie, koniec treningu i `rest-miss` przyjmują opcjonalne `expectedSeq`. Serwer porównuje je z `seq` świeżo odtworzonego logu. Różnica daje 409 `stale_state` z bieżącym stanem, bez zapisu i bez wiadomości na kanale na żywo, więc ponowione po błędzie sieci cofnięcie nie zdejmie drugiej rzutki. `POST /matches/:id/rest-miss` zapisuje Missy na resztę tury jedną transakcją (`Store.appendThrows`). Pierwsza rzutka dostaje `eventId` z żądania, więc ponowne wysłanie daje 200 bez zapisu, nawet z nieaktualnym `expectedSeq`.

## Lista gier i statystyki

Lista gier, ranking, `GET /stats/overall`, statystyki gracza i rekordy do osiągnięć odtwarzają logi wielu gier. Żeby nie robić tego przy każdym żądaniu, serwer trzyma w procesie pamięć podręczną odtworzeń. Wpis to wynik odtworzenia logu jednej gry (rzutki, które się liczą, stan silnika, zdarzenia, czasy), zapisany pod kluczem `(matchId, seq)`, gdzie `seq` to ostatni wpis wczytanego logu.

Przed użyciem wpisu serwer jednym zapytaniem czyta najwyższy `seq` każdej gry. Gra z nowym wpisem w logu jest wczytywana i odtwarzana od nowa, także gdy zapis przyszedł z innego procesu. Pamięć mieści najwyżej 500 gier (`REPLAY_CACHE_MAX_MATCHES`) i usuwa najdawniej używaną. Testy mogą ją wyłączyć przez `AppOptions.replayCacheSize: 0`. Po restarcie jest pusta.

To nie jest licznik. Migawki, profile graczy i sumy statystyk są liczone przy każdym żądaniu z odtworzenia, więc zmianę imienia widać od razu. Komendy, `GET /matches/:id` i kanał na żywo zawsze odtwarzają świeżo wczytany log i nie używają pamięci podręcznej.

Gracze i logi gier z listy są wczytywane zbiorczo, a filtry `type` i `playerId` listy gier działają już w zapytaniu. Filtr `status` wymaga odtworzenia, więc działa po nim. Migracja `0007_list_indexes` dodaje indeksy na `throws(match_id)` i `match_players(player_id)`. `match_events` nie potrzebuje osobnego indeksu, bo wyszukiwanie po `match_id` obsługuje klucz główny `(match_id, seq)`.

Uszkodzona gra (log, którego nie da się odtworzyć, albo brak wymaganego pola w wierszu gry) trafia do logu serwera jako ostrzeżenie i jest pomijana w liście gier, rankingu, `GET /stats/overall`, statystykach gracza, bilansie, formie, najczęstszych trafieniach i rekordach do osiągnięć. `GET /matches/:id` i podsumowanie `GET /matches/:id/summary` dla takiej gry nadal kończą się błędem 500.

## Struktura

- `src/main.ts`: start procesu (konfiguracja, baza, migracje, nasłuch).
- `src/app.ts`: `buildApp`, czyli aplikacja Fastify z trasami i obsługą błędów.
- `src/config.ts`: `loadConfig`, czyli odczyt zmiennych środowiskowych.
- `src/errors.ts`: mapowanie błędów na `ApiError` (dla `stale_state` na `StaleStateError` z bieżącym stanem) i kody HTTP.
- `src/auth/`: `credentials.ts` (tokeny HMAC i porównanie hasła), `login-limiter.ts` (limit nieudanych logowań), `access.ts` (CORS i sprawdzanie tokenu przed trasami).
- `src/routes/`:
  - `health.ts`: `GET /health`.
  - `web-app.ts`: pliki frontu z `AUTOSCORE_WEB_DIR`.
  - `auth.ts`: `POST /auth/login`.
  - `players.ts`: utworzenie, lista z `?archived=include` i `PATCH /players/:id` do zmiany profilu.
  - `matches.ts`: gry, lista gier z filtrami `status`, `playerId` i `type`, rzutki, reszta tury jako Miss (`rest-miss`), próby i pominięcia checkoutu, cofnięcie, porzucenie, wznowienie i zakończenie treningu. Cofnięcie, wznowienie, zakończenie i pominięcie checkoutu czytają z body tylko `expectedSeq`, a pusty albo niepoprawny JSON i wartość, która nie jest obiektem, traktują jak brak body.
  - `live.ts`: WebSocket z wiadomością `auth` i pingiem.
  - `stats.ts`: statystyki gracza, `GET /players/:id/head-to-head/:opponentId`, `GET /players/:id/form`, `GET /players/:id/frequent-hits`, podsumowanie meczu, ranking graczy i `GET /stats/overall`. Statystyki gracza, bilans, forma, ranking i `GET /stats/overall` przyjmują `?period=30d`, `90d` albo `all` (domyślnie `all`).
- `src/match-service.ts`: komendy gry (utworzenie, rzutka, reszta tury jako Miss, próba i pominięcie checkoutu, cofnięcie, porzucenie, wznowienie, zakończenie treningu, lista, subskrypcja) i sprawdzenie `expectedSeq` opisane w „Powtórzone komendy”.
- `src/replay.ts`: wybór rzutek oraz prób i pominięć checkoutu, które się liczą, stan porzucenia, czas zakończenia treningu i odtworzenie stanu w silniku. `replayLog` daje z wczytanego logu cały wynik odtworzenia (`ReplayedMatch`).
- `src/replay-cache.ts`: pamięć podręczna odtworzeń dla list i statystyk (`createReplayCache`, `REPLAY_CACHE_MAX_MATCHES`), opisana wyżej w „Lista gier i statystyki”.
- `src/snapshot.ts`: budowa `MatchSnapshot` ze stanu silnika.
- `src/leg-turns.ts`: `buildLegTurns`, czyli zamknięte tury bieżącego lega (`legTurns`) ze zdarzeń odtworzenia, a w Free run z pełnych podejść po 3 rzutki.
- `src/stats-service.ts` i `src/stats/`: statystyki liczone z odtworzenia logu. Gry spoza okresu odrzuca już zapytanie w `store.ts`, więc nie są odtwarzane. Średnia na 3 rzutki na karcie gracza, w rankingu, w bilansie i na wykresie formy liczy tylko ukończone legi. W `src/stats/` są:
  - `tally.ts`: sumy gracza w grze, także trafienia T20.
  - `completed-legs.ts`: punkty i rzutki w ukończonych legach.
  - `rankings.ts`: ranking graczy, rekordy oraz listy procentu wygranych i trafień T20.
  - `overall.ts`: łączna liczba lotek, średnia ze średnich graczy, gracze powyżej i poniżej niej.
  - `head-to-head.ts`: bilans dwóch graczy z ukończonych meczów 1v1.
  - `form.ts`: średnia z każdej z ostatnich gier.
  - `frequent-hits.ts`: do 6 najczęstszych trafień gracza bez Miss, według liczby, potem punktów, potem segmentu.
  - `leg-progress.ts`: pozostały wynik po każdej rzutce ostatniego lega z zamkniętych tur, do podsumowania gry.
  - `leg-durations.ts`: czas każdego wygranego lega z rzutek, które się liczą, bez przerw przyciętych do lega.
  - `achievements.ts`: rekordy gracza i wykrywanie osiągnięć.
  - `period.ts`: `periodStart`, czyli najstarsze `createdAt` gry w okresie statystyk liczone od zegara serwera z `AppOptions.now`.
- `src/achievement-reference.ts`: rekordy gracza z ukończonych meczów 1v1 do wykrywania osiągnięć. Osiągnięcia (`achievement` na WebSocket) dotyczą tylko meczów 1v1 i zapisanych profili, od drugiego ukończonego meczu 1v1 gracza. Liczymy je z logu, z pamięcią podręczną w procesie, i niczego nie zapisujemy.
- `src/live-hub.ts`: rozsyłanie wiadomości do subskrybentów jednej gry.
- `src/serial-queue.ts`: kolejka komend per gra.
- `src/store/store.ts`: warstwa dostępu do danych.
- `src/db/`: połączenie z bazą, adapter `node:sqlite`, migracje.

## Testy

```sh
pnpm --filter @autoscore/server test
```

Testy budują aplikację na bazie SQLite w pamięci (`:memory:`, zobacz `src/test-helpers.ts`). `AppOptions.auth` jest wymagane, więc każde wywołanie `buildApp` wybiera tryb logowania jawnie. `setup()` buduje aplikację z wpisanym `auth: null`, a test z hasłem podaje własne `auth`. `src/restart.test.ts` używa pliku w katalogu tymczasowym, żeby sprawdzić stan po ponownym uruchomieniu.

```sh
pnpm --filter @autoscore/server bench
```

`scripts/bench-lists.ts` wypełnia przez HTTP bazę w katalogu tymczasowym (ponad 300 gier wszystkich typów i ponad 45 tys. rzutek) i mierzy `GET /matches`, `GET /matches?status=unfinished`, `GET /stats/rankings`, `GET /stats/overall` i `GET /players/:id/stats`. Dla każdego adresu podaje pierwsze wywołanie na świeżej aplikacji i medianę z 5 kolejnych. Katalog jest na końcu usuwany.
