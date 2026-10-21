# @autoscore/server

Serwer API: REST i WebSocket na Fastify. Jest jedynym źródłem prawdy o stanie gry. Zapisuje każdą rzutkę, każde cofnięcie, każde porzucenie i wznowienie gry oraz zakończenie treningu jako wpis w logu zdarzeń w SQLite. Stan gry nie jest zapisywany. Serwer odtwarza go z rzutek, które nadal się liczą, przez silnik z `@autoscore/engine`. Status porzucenia wynika z wpisów porzucenia i wznowienia, a status `ended` z wpisu zakończenia treningu. Komendy jednej gry wykonują się po kolei, a różne gry nie blokują się nawzajem.

Profil gracza też nie jest nadpisywany. Wiersz w `players` zostaje taki, jak przy utworzeniu gracza, a każda zmiana imienia, avatara, archiwizacji albo zapisu gościa dopisuje do `player_changes` pełny profil z kolejnym `seq`. Każdy odczyt gracza bierze wiersz z najwyższym `seq`, więc gry, historia i ranking pokazują aktualne imię.

Baza to SQLite przez wbudowany moduł `node:sqlite` i Kysely, bez natywnych bindingów. Migracje używają tylko typów text, integer i real i nie używają funkcji JSON, żeby dało się przejść na PostgreSQL.

## Uruchomienie

```sh
pnpm --filter @autoscore/server dev     # node --watch, restart po zmianie kodu
pnpm --filter @autoscore/server start
```

Oba skrypty uruchamiają `src/main.ts` przez `jiti`, bez kroku budowania. Przy starcie serwer wykonuje migracje. Zmienne `PORT`, `HOST` i `DATABASE_PATH`, trasy API i przykład z curl opisuje [README w katalogu głównym](../../README.md).

## Hasło i CORS

Serwer może działać w internecie za jednym wspólnym hasłem. Bez poniższych zmiennych działa jak wcześniej, bez hasła i bez nagłówków CORS, więc lokalne `pnpm dev` niczego nie wymaga (front w trybie dev woła API przez proxy Vite).

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `AUTOSCORE_PASSWORD` | brak (wyłączone) | Wspólne hasło. Pusta wartość wyłącza hasło, a wtedy `AUTOSCORE_TOKEN_SECRET` jest pomijany. |
| `AUTOSCORE_TOKEN_SECRET` | brak | Klucz do podpisu tokenów, co najmniej 32 znaki. Wymagany, gdy hasło jest ustawione. Bez niego serwer nie wstaje (`Missing AUTOSCORE_TOKEN_SECRET`), a za krótki daje `Invalid AUTOSCORE_TOKEN_SECRET`. |
| `AUTOSCORE_CORS_ORIGIN` | brak (wyłączone) | Lista originów frontu po przecinku, np. `https://front.example,http://localhost:5173`. Spacje i puste wpisy są pomijane. |

Sekret wygenerujesz przez `openssl rand -hex 32`. Token jest podpisany HMAC-SHA256 i ważny 180 dni. Serwer nie przechowuje tokenów, więc nowy sekret wylogowuje wszystkie urządzenia.

Każdy wpis w `AUTOSCORE_CORS_ORIGIN` musi być samym originem: schemat, host i opcjonalny port, bez ścieżki i bez końcowego ukośnika. `https://front.example/`, `https://front.example/app`, `*` albo `front.example` zatrzymują start błędem `Invalid AUTOSCORE_CORS_ORIGIN`, bo nigdy nie pasowałyby do nagłówka `Origin` z przeglądarki.

### HTTP

- `GET /health` zwraca `{ "status": "ok" }` i nigdy nie wymaga tokenu.
- `POST /auth/login` z `{ "password": "…" }` zwraca `{ "token": "…", "expiresAt": "…" }`. Trasa istnieje tylko z ustawionym hasłem, inaczej odpowiada 404. Złe hasło daje 401 `invalid_password`, a niepoprawne body 400.
- Po 10 nieudanych logowaniach w ciągu minuty serwer odpowiada 429 `too_many_attempts` z nagłówkiem `Retry-After` w sekundach, nawet na poprawne hasło. Limit jest wspólny dla całego serwera i trzymany w pamięci.
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
- Serwer wysyła ramkę ping co 30 s na każdym połączeniu, z hasłem i bez, żeby reverse proxy nie zamknął bezczynnego połączenia.

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

## Struktura

- `src/main.ts`: start procesu (konfiguracja, baza, migracje, nasłuch).
- `src/app.ts`: `buildApp`, czyli aplikacja Fastify z trasami i obsługą błędów.
- `src/config.ts`: `loadConfig`, czyli odczyt zmiennych środowiskowych.
- `src/errors.ts`: mapowanie błędów na `ApiError` i kody HTTP.
- `src/auth/`: `credentials.ts` (tokeny HMAC i porównanie hasła), `login-limiter.ts` (limit nieudanych logowań), `access.ts` (CORS i sprawdzanie tokenu przed trasami).
- `src/routes/`: `health.ts` (`GET /health`), `web-app.ts` (pliki frontu z `AUTOSCORE_WEB_DIR`), `auth.ts` (`POST /auth/login`), `players.ts` (utworzenie, lista z `?archived=include` i `PATCH /players/:id` do zmiany profilu), `matches.ts` (gry, lista gier z filtrami `status`, `playerId` i `type`, rzutki, cofnięcie, porzucenie, wznowienie i zakończenie treningu), `live.ts` (WebSocket z wiadomością `auth` i pingiem), `stats.ts` (statystyki gracza, `GET /players/:id/head-to-head/:opponentId`, `GET /players/:id/form`, podsumowanie meczu i ranking graczy).
- `src/match-service.ts`: komendy gry (utworzenie, rzutka, cofnięcie, porzucenie, wznowienie, zakończenie treningu, lista, subskrypcja).
- `src/replay.ts`: wybór rzutek, które się liczą, stan porzucenia, czas zakończenia treningu i odtworzenie stanu w silniku.
- `src/snapshot.ts`: budowa `MatchSnapshot` ze stanu silnika.
- `src/stats-service.ts` i `src/stats/`: statystyki liczone z odtworzenia logu. W `src/stats/` są `tally.ts` (sumy gracza w grze), `completed-legs.ts` (punkty i rzutki w ukończonych legach), `rankings.ts` (ranking graczy i rekordy), `head-to-head.ts` (bilans dwóch graczy z ukończonych meczów 1v1) i `form.ts` (średnia z każdej z ostatnich gier). Średnia na 3 rzutki na karcie gracza, w rankingu, w bilansie i na wykresie formy liczy tylko ukończone legi.
- `src/live-hub.ts`: rozsyłanie wiadomości do subskrybentów jednej gry.
- `src/serial-queue.ts`: kolejka komend per gra.
- `src/store/store.ts`: warstwa dostępu do danych.
- `src/db/`: połączenie z bazą, adapter `node:sqlite`, migracje.

## Testy

```sh
pnpm --filter @autoscore/server test
```

Testy budują aplikację na bazie SQLite w pamięci (`:memory:`, zobacz `src/test-helpers.ts`). `src/restart.test.ts` używa pliku w katalogu tymczasowym, żeby sprawdzić stan po ponownym uruchomieniu.
