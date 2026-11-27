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

Turniej też ma log zdarzeń, opisany niżej w „Turnieje”.

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
- Z ustawionym hasłem każde inne żądanie HTTP, także do nieznanej trasy, wymaga nagłówka `Authorization: Bearer <token>`. Bez niego albo z nieważnym tokenem odpowiedź to 401 `unauthorized`. `OPTIONS` oraz `GET` i `HEAD` do plików frontu (niżej) i do trzech publicznych tras turnieju (`/public/tournaments/:id`, `/public/tournaments/:id/stats`, `/public/tournaments/:id/matches/:matchId`, opisane w „Turnieje”) nie wymagają tokenu, a WebSocket uwierzytelnia się pierwszą wiadomością (niżej). Hak sprawdza dopasowaną trasę, nie surowy adres, więc `POST` pod `/public/...` nie trafia w żadną trasę i bez tokenu daje 401, a z tokenem 404.
- Publiczne trasy turnieju mają limit 300 żądań na minutę z jednego adresu klienta (`PUBLIC_REQUESTS_PER_MINUTE`), liczony w stałym oknie od pierwszego żądania. Liczy się każde żądanie, także z odpowiedzią 404, więc zgadywanie id też zwalnia. Ponad limit odpowiedź to 429 `too_many_requests` z `Retry-After` w sekundach. Limitu dla wszystkich adresów razem nie ma, żeby jeden klient nie zablokował linku innym. Stan jest w pamięci, restart go zeruje. Z `AUTOSCORE_TRUST_PROXY=on` klient może podrobić adres, więc ten limit działa tylko na adres, nie na osobę.
- Z ustawionym `AUTOSCORE_CORS_ORIGIN` tylko wymienione originy dostają `Access-Control-Allow-Origin`, także na odpowiedzi 401. Preflight dopuszcza metody `GET`, `HEAD`, `POST` i `PATCH` oraz nagłówki `Authorization` i `Content-Type`.

```sh
curl -s -X POST https://api.example/auth/login -H 'content-type: application/json' -d '{"password":"…"}'
curl -s https://api.example/players -H "authorization: Bearer $TOKEN"
```

### WebSocket

- Przeglądarka nie ustawi nagłówka na WebSocket, a token w adresie trafiłby do logów proxy. Dlatego z ustawionym hasłem pierwsza wiadomość klienta to `{ "type": "auth", "token": "…" }`. Token w adresie jest pomijany.
- Bez tej wiadomości w ciągu 5 s, z niepoprawnym JSON, inną wiadomością albo złym tokenem serwer zamyka połączenie z kodem 4401. Do tego czasu serwer nie wysyła żadnej wiadomości. Po poprawnym `auth` pierwszą wiadomością jest `state_updated`, a nieznana gra zamyka połączenie z kodem 4404. Kolejne wiadomości klienta są pomijane.
- `/tournaments/:id/live` działa tak samo, ale pierwszą wiadomością jest `tournament_updated`, a 4404 oznacza nieznany turniej.
- Z ustawionym `AUTOSCORE_CORS_ORIGIN` połączenie z nagłówkiem `Origin` spoza listy dostaje 403 przed zmianą protokołu. Brak nagłówka `Origin` (curl, skrypty) jest dopuszczony.
- Wiadomość klienta może mieć najwyżej 4 KiB. Większa zamyka połączenie z kodem 1009, zanim serwer ją odczyta.
- Z ustawionym hasłem na wiadomość `auth` może czekać naraz najwyżej 20 połączeń, licząc razem kanały gier i turniejów. Kolejne serwer zamyka od razu z kodem 4429. Miejsce zwalnia się po pierwszej wiadomości, po upływie 5 s albo po zamknięciu połączenia. Bez hasła ten limit nie obowiązuje.
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

Trasy API mają pierwszeństwo. Plik, którego pierwszy segment ścieżki pokrywa się z trasą API (`health`, `auth`, `players`, `matches`, `stats`, `tournaments`, `public`), jest pomijany z ostrzeżeniem w logu. Pliki frontu ładują się bez tokenu, żeby przeglądarka dostała ekran logowania. API dalej wymaga tokenu, a brakujący plik daje bez tokenu 401, z tokenem 404.

Gdy w katalogu nie ma czytelnego `index.html`, także gdy katalog nie istnieje, serwer nie wstaje z błędem `Missing index.html in AUTOSCORE_WEB_DIR: <katalog>`.

## Zamknięcie zakończonej gry

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `AUTOSCORE_MATCH_LOCK_MINUTES` | `5` | Ile minut po rzutce kończącej mecz 1v1, zabawę albo Solo 501 da się jeszcze cofać. `0` zamyka grę od razu. |

Stan gry podaje `finishedAt` (czas przyjęcia rzutki kończącej grę) i `editableUntil` (`finishedAt` plus ta liczba minut). Oba pola są `null`, dopóki gra trwa. Od chwili `editableUntil` cofnięcie dostaje 409 `match_locked`, a log się nie zmienia. Cofnięcie rzutki kończącej grę w oknie otwiera grę, a kolejne zakończenie liczy okno od nowa. Wartość spoza samych cyfr albo większa niż `525600` (rok) zatrzymuje start z błędem `Invalid AUTOSCORE_MATCH_LOCK_MINUTES: <wartość>`.

Stan gry podaje też `round` (kolejka rzucającego w bieżącym legu, liczona od 1, `null` po końcu gry, w Free run i w treningu checkoutów), `startedAt` i `legStartedAt` (czas przyjęcia pierwszej liczonej rzutki gry i bieżącego lega, `null` przed nią i zawsze w treningu checkoutów, który nie ma rzutek) oraz `pausedMs` i `legPausedMs` (suma zamkniętych przerw od porzucenia do wznowienia, liczona od `startedAt` i od `legStartedAt`). Wszystkie czasy pochodzą z logu, więc cofnięcie rzutki przesuwa je razem ze stanem. Otwarte porzucenie nie wchodzi do sumy przerw.

Stan gry i pozycje listy `GET /matches` mają pole `tournament`. Mecz turnieju ma tam `id` i `name` turnieju, `fixtureId` i `label`, czyli polską nazwę meczu z jego id (np. „Liga, mecz 3”, „Półfinał 2”, „Finał”). Pozostałe gry mają `null`.

Pole `legTurns` to zamknięte tury bieżącego lega w kolejności rzutów. Każdy wpis ma gracza (`playerId`), numer tury (`turnIndex`), rzutki (`darts`), zdobyte punkty (`points`), wynik po turze (`remainingAfter`) i znacznik `bust`.

- Otwarta tura nie trafia na listę, jej rzutki są w `currentDarts`.
- Bust ma `points: 0` i `remainingAfter` równe wynikowi sprzed tury.
- Nowy leg zaczyna się z pustą listą, a po rzutce kończącej mecz zostają tury ostatniego lega.
- W Free run turą jest każde pełne podejście po 3 rzutki, a `remainingAfter` jest `null`.
- W treningu checkoutów lista jest zawsze pusta.
- Cofnięcie rzutki przelicza listę z logu razem z resztą stanu.

## Powtórzone komendy

Cofnięcie, próba i pominięcie checkoutu, porzucenie, wznowienie, koniec treningu i `rest-miss` przyjmują opcjonalne `expectedSeq`. Serwer porównuje je z `seq` świeżo odtworzonego logu. Różnica daje 409 `stale_state` z bieżącym stanem, bez zapisu i bez wiadomości na kanale na żywo, więc ponowione po błędzie sieci cofnięcie nie zdejmie drugiej rzutki. `POST /matches/:id/rest-miss` zapisuje Missy na resztę tury jedną transakcją (`Store.appendThrows`). Pierwsza rzutka dostaje `eventId` z żądania, więc ponowne wysłanie daje 200 bez zapisu, nawet z nieaktualnym `expectedSeq`.

## Turnieje

Turniej to wiersz w `tournaments` (nazwa, format i reszta konfiguracji jako JSON w `config`), lista graczy w kolejności zgłoszenia w `tournament_players` i log `tournament_events`, do którego serwer tylko dopisuje. Wpisy logu: `draw` (wylosowana kolejność), `fixture_started` (mecz turnieju i id gry), `player_withdrawn`, `result_corrected`, `sharing_changed` i `archived`. Serwer zapisuje wszystkie, `sharing_changed` przez `POST /tournaments/:id/sharing`. Migracja `0008_tournaments` dodaje te tabele oraz kolumny `matches.tournament_id` i `matches.fixture_id`, które w pozostałych grach są `null`.

Widoku turnieju (`TournamentView`) serwer nie zapisuje. Każdy odczyt, komenda i wiadomość na kanale na żywo liczy go od nowa funkcją `computeTournament` z silnika, z konfiguracji, ostatniego losowania, wpisów logu i wygranych legów powiązanych meczów. Legi pochodzą z odtworzenia logów tych meczów przez pamięć podręczną odtworzeń. Mecz, którego nie da się wczytać albo odtworzyć, kończy odczyt turnieju błędem 500, bo pominięcie go zmieniłoby wynik. Odrzucenie zapisanych danych przez silnik to uszkodzony log, więc też daje 500, a nie 400.

Średnie w widoku też pochodzą z odtworzeń. Serwer podaje silnikowi dla każdego rozpoczętego meczu punkty i rzutki obu graczy z zamkniętych tur (`tallyGame`, bust liczy rzutki za 0 punktów). Silnik wpisuje z nich `Fixture.averages` tylko w statusie `finished`, gdy obaj gracze mają zamkniętą turę, i sumuje je w `StandingRow.average` z meczów grupy bez walkowerów. Mecze play-off nie zmieniają tabeli. Średnie meczu są więc równe średnim z `GET /matches/:id/summary`. Cofnięcie rzutki kończącej mecz bez korekty przywraca status `in_progress` i średnie znikają.

`GET /tournaments/:id/stats` liczy `buildTournamentStats` z widoku, tych samych odtworzeń i kolejności `fixture_started`. Bilans i legi pochodzą z `result` każdego meczu z wynikiem, więc obejmują walkowery (N:0) i korekty. Rzutki i rekordy liczą się tylko z meczów o statusie `finished`, także po korekcie wyniku. Trwający, porzucony i zamieniony w walkower mecz nic do nich nie wnosi. Rekordy sprawdzają mecze w kolejności startu, zdarzenia w kolejności logu i slot 0 przed slotem 1, a zmieniają się tylko na wartość ściśle lepszą.

- Id turnieju to `t_` i 128 losowych bitów (`randomBytes(16)` w base64url), bo posłuży też za publiczny link.
- Start meczu turnieju zapisuje w jednej transakcji wiersz gry z `tournament_id` i `fixture_id`, jej graczy w kolejności slotów i wpis `fixture_started`. Ponowny start zwraca tę samą grę.
- Mecz turnieju to zwykły mecz 1v1. Porzucenie i wznowienie działają jak w każdej grze, a mecz turnieju zostaje `in_progress` z tym samym `matchId`. Wyjątek: po wycofaniu jednego z graczy z turnieju wznowienie daje 409 `player_withdrawn`, bo zamieniłoby walkower z powrotem w rozgrywany mecz.
- Gdy rzutka, reszta tury jako Miss albo cofnięcie zmieni wygrane legi meczu turnieju, serwer po wiadomościach gry wysyła `tournament_updated` na kanale turnieju. Błąd tej wysyłki trafia do logu serwera i nie zmienia odpowiedzi gry.
- Wycofanie gracza (`POST /tournaments/:id/withdrawals`) zapisuje w jednej transakcji (`Store.withdrawPlayer`) porzucenie każdego jego trwającego meczu turnieju, z wycofanym graczem w `player_id` i bez powodu, oraz wpis `player_withdrawn`. Mecz porzucony już wcześniej nie dostaje drugiego porzucenia. Silnik zamienia pozostałe mecze gracza w walkowery, także mecz z faktem bez zwycięzcy, który zachowuje `matchId`. Po zapisie serwer wysyła `tournament_updated`, a potem `state_updated` na kanale każdego porzuconego meczu.
- Korekta wyniku (`POST /tournaments/:id/fixtures/:fixtureId/result`) dopisuje `result_corrected` i nie zmienia rzutek meczu. Silnik nakłada ostatnią korektę meczu na jego legi i odrzuca ją, gdy zaczął się mecz zależny od wyniku.
- Cofnięcie rzutki, która zakończyła mecz turnieju, przechodzi przez `TournamentService.guardUndo`. Pod kluczem turnieju sprawdza ono, czy zaczął się mecz zależny (`hasStartedDependent`), i dopiero wtedy zapisuje cofnięcie albo daje 409 `match_locked`. Dzięki temu mecz zależny nie wystartuje między sprawdzeniem a zapisem. W lidze nic od niczego nie zależy, więc blokada nie działa. `editableUntil` w stanie gry zostaje czasowe.
- Gry i turnieje mają jedną wspólną kolejkę (`SerialQueue`) bez wielowejściowości. Komendy jednej gry i komendy jednego turnieju wykonują się po kolei. Wszystkie utworzenia turniejów idą jednym kluczem, więc dwa równoległe nie przejdą razem sprawdzenia `tournament_active`. Zadanie trzymające klucze gier może czekać na klucz turnieju, nigdy odwrotnie, a kilka kluczy gier bierze w kolejności posortowanych id. Tak działa rzutka, która zmienia legi, cofnięcie z blokadą i wycofanie gracza. Wycofanie najpierw bez kluczy czyta, które mecze gracza trwają, a jeśli pod kluczami ten zbiór jest inny, zwalnia je i zaczyna od nowa.
- Ponowne losowanie, start meczu, archiwizacja, wycofanie gracza, korekta wyniku i przełączenie udostępniania przyjmują opcjonalne `expectedSeq`, porównywane z najwyższym `seq` logu turnieju (`eventSeq` widoku). Zmiana legów w meczu nie zmienia `eventSeq` turnieju.
- Przełączenie udostępniania (`POST /tournaments/:id/sharing`, `SharingRequest`) dopisuje `sharing_changed` i wysyła `tournament_updated`. Ta sama wartość co `sharing` widoku niczego nie zapisuje i niczego nie wysyła. Działa też w zakończonym turnieju, a zarchiwizowany daje 409 `tournament_archived`.

Publiczny link do turnieju to jego id. `PublicTournamentService` czyta przez `TournamentService`, `MatchService` i `StatsService`, nie przez bazę:

- `GET /public/tournaments/:id` daje `PublicTournamentView`, `GET /public/tournaments/:id/stats` daje `PublicTournamentStats`, a `GET /public/tournaments/:id/matches/:matchId` daje `PublicTournamentMatch` (stan meczu, `MatchSummary` i `MatchLegs`).
- Nieznane id, wyłączone udostępnianie i zarchiwizowany turniej dają tę samą odpowiedź 404 `not_found` z komunikatem `Not found`, bez id i powodu. Taką samą dostaje mecz spoza turnieju i nieznany mecz.
- `src/public/redact.ts` przepisuje pola gracza po kolei, bez rozpakowania prywatnego obiektu. Avatar przechodzi tylko jako jedno emoji (`isSingleEmoji`), inna zapisana wartość, np. adres zdjęcia, daje `null`. Widok nie ma `sharing`, `canRedraw`, `eventSeq` ani `archivedAt`, a gracz nie ma `guest`.
- Udane odpowiedzi trafiają na 5 s (`PUBLIC_CACHE_TTL_MS`) do pamięci podręcznej w procesie, po id turnieju i trasie. Każda zmiana, którą `TournamentService` rozsyła (komendy, udostępnianie, archiwizacja, zmiana legów w meczu turnieju), od razu czyści wpisy tego turnieju przez `onPublished`. Odczyt, który zaczął się przed wyczyszczeniem, nie zapisuje już swojej odpowiedzi. Rzutka bez zmiany legów i zmiana profilu gracza pojawiają się najpóźniej po 5 s.

## Lista gier i statystyki

Lista gier, ranking, `GET /stats/overall`, statystyki gracza i rekordy do osiągnięć odtwarzają logi wielu gier. Żeby nie robić tego przy każdym żądaniu, serwer trzyma w procesie pamięć podręczną odtworzeń. Wpis to wynik odtworzenia logu jednej gry (rzutki, które się liczą, stan silnika, zdarzenia, czasy), zapisany pod kluczem `(matchId, seq)`, gdzie `seq` to ostatni wpis wczytanego logu.

Przed użyciem wpisu serwer jednym zapytaniem czyta najwyższy `seq` każdej gry. Gra z nowym wpisem w logu jest wczytywana i odtwarzana od nowa, także gdy zapis przyszedł z innego procesu. Pamięć mieści najwyżej 500 gier (`REPLAY_CACHE_MAX_MATCHES`) i usuwa najdawniej używaną. Testy mogą ją wyłączyć przez `AppOptions.replayCacheSize: 0`. Po restarcie jest pusta.

To nie jest licznik. Migawki, profile graczy i sumy statystyk są liczone przy każdym żądaniu z odtworzenia, więc zmianę imienia widać od razu. Komendy, `GET /matches/:id` i kanał na żywo zawsze odtwarzają świeżo wczytany log i nie używają pamięci podręcznej.

Gracze i logi gier z listy są wczytywane zbiorczo, a filtry `type`, `playerId` i `tournamentId` listy gier działają już w zapytaniu. Filtr `status` wymaga odtworzenia, więc działa po nim. Migracja `0007_list_indexes` dodaje indeksy na `throws(match_id)` i `match_players(player_id)`. `match_events` nie potrzebuje osobnego indeksu, bo wyszukiwanie po `match_id` obsługuje klucz główny `(match_id, seq)`.

Uszkodzona gra (log, którego nie da się odtworzyć, albo brak wymaganego pola w wierszu gry) trafia do logu serwera jako ostrzeżenie i jest pomijana w liście gier, rankingu, `GET /stats/overall`, statystykach gracza, bilansie, formie, najczęstszych trafieniach i rekordach do osiągnięć. `GET /matches/:id` i podsumowanie `GET /matches/:id/summary` dla takiej gry nadal kończą się błędem 500.

## Struktura

- `src/main.ts`: start procesu (konfiguracja, baza, migracje, nasłuch).
- `src/app.ts`: `buildApp`, czyli aplikacja Fastify z trasami i obsługą błędów.
- `src/config.ts`: `loadConfig`, czyli odczyt zmiennych środowiskowych.
- `src/errors.ts`: mapowanie błędów na `ApiError` (dla `stale_state` na `StaleStateError` z bieżącym stanem albo `TournamentStaleStateError` z bieżącym widokiem turnieju) i kody HTTP.
- `src/auth/`: `credentials.ts` (tokeny HMAC i porównanie hasła), `login-limiter.ts` (limit nieudanych logowań), `access.ts` (CORS i sprawdzanie tokenu przed trasami).
- `src/routes/`:
  - `health.ts`: `GET /health`.
  - `web-app.ts`: pliki frontu z `AUTOSCORE_WEB_DIR`.
  - `auth.ts`: `POST /auth/login`.
  - `players.ts`: utworzenie, lista z `?archived=include` i `PATCH /players/:id` do zmiany profilu.
  - `matches.ts`: gry, lista gier z filtrami `status`, `playerId`, `type` i `tournamentId`, rzutki, reszta tury jako Miss (`rest-miss`), próby i pominięcia checkoutu, cofnięcie, porzucenie, wznowienie i zakończenie treningu. Cofnięcie, wznowienie, zakończenie i pominięcie checkoutu czytają z body tylko `expectedSeq`, a pusty albo niepoprawny JSON i wartość, która nie jest obiektem, traktują jak brak body.
  - `tournaments.ts`: `POST /tournaments`, lista z filtrami `status` i `archived=include`, `GET /tournaments/:id`, `GET /tournaments/:id/stats`, ponowne losowanie, start meczu turnieju, archiwizacja, wycofanie gracza, korekta wyniku i przełączenie udostępniania. Losowanie, start i archiwizacja czytają z body tylko `expectedSeq`, jak cofnięcie. Wycofanie, korekta i udostępnianie mają ścisłe body JSON, jak utworzenie turnieju.
  - `public.ts`: trzy publiczne trasy `GET` turnieju bez tokenu (`PUBLIC_TOURNAMENT_ROUTES`, z nich korzysta `access.ts`) z limitem żądań w osobnym zakresie Fastify.
  - `command-body.ts`: parser body komend, które czytają tylko `expectedSeq`, wspólny dla gier i turniejów.
  - `live.ts`: WebSocket gry (`/matches/:id/live`) i turnieju (`/tournaments/:id/live`) z wiadomością `auth` i pingiem.
  - `stats.ts`: statystyki gracza, `GET /players/:id/head-to-head/:opponentId`, `GET /players/:id/form`, `GET /players/:id/frequent-hits`, podsumowanie meczu, historia legów meczu 1v1 (`GET /matches/:id/legs`), ranking graczy i `GET /stats/overall`. Statystyki gracza, bilans, forma, ranking i `GET /stats/overall` przyjmują `?period=7d`, `30d` albo `all` (domyślnie `all`). Statystyki gracza, forma i ranking przyjmują też `?type=tournament`, czyli tylko mecze 1v1 z turniejów.
- `src/match-service.ts`: komendy gry (utworzenie, rzutka, reszta tury jako Miss, próba i pominięcie checkoutu, cofnięcie, porzucenie, wznowienie, zakończenie treningu, lista, subskrypcja), sprawdzenie `expectedSeq` opisane w „Powtórzone komendy” i `publishState`, czyli wysyłka stanu gry bez brania kolejki, dla wycofania gracza z turnieju.
- `src/replay.ts`: wybór rzutek oraz prób i pominięć checkoutu, które się liczą, stan porzucenia, czas zakończenia treningu i odtworzenie stanu w silniku. `replayLog` daje z wczytanego logu cały wynik odtworzenia (`ReplayedMatch`).
- `src/replay-cache.ts`: pamięć podręczna odtworzeń dla list i statystyk (`createReplayCache`, `REPLAY_CACHE_MAX_MATCHES`), opisana wyżej w „Lista gier i statystyki”.
- `src/snapshot.ts`: budowa `MatchSnapshot` ze stanu silnika.
- `src/leg-turns.ts`: `buildLegTurns`, czyli zamknięte tury bieżącego lega (`legTurns`) ze zdarzeń odtworzenia, a w Free run z pełnych podejść po 3 rzutki. `legTurnsOf` daje zamknięte tury dowolnego lega.
- `src/stats-service.ts` i `src/stats/`: statystyki liczone z odtworzenia logu. Gry spoza okresu odrzuca już zapytanie w `store.ts`, więc nie są odtwarzane. Średnia na 3 rzutki na karcie gracza, w rankingu, w bilansie i na wykresie formy liczy tylko ukończone legi. W `src/stats/` są:
  - `tally.ts`: sumy gracza w grze, także trafienia T20.
  - `completed-legs.ts`: punkty i rzutki w ukończonych legach.
  - `rankings.ts`: ranking graczy, rekordy oraz listy procentu wygranych, skuteczności na double i trafień T20, T19, T18, T5 i T1.
  - `overall.ts`: łączna liczba lotek, średnia ze średnich graczy, gracze powyżej i poniżej niej.
  - `head-to-head.ts`: bilans dwóch graczy z ukończonych meczów 1v1, także turniejowych.
  - `form.ts`: średnia z każdej z ostatnich gier.
  - `frequent-hits.ts`: do 6 najczęstszych trafień gracza bez Miss, według liczby, potem punktów, potem segmentu.
  - `leg-progress.ts`: pozostały wynik po każdej rzutce ostatniego lega z zamkniętych tur, do podsumowania gry.
  - `match-legs.ts`: historia legów meczu 1v1 do `GET /matches/:id/legs`, czyli zaczynający, zwycięzca, zamknięcie, rzutki, średnia graczy w legu i zamknięte tury.
  - `leg-durations.ts`: czas każdego wygranego lega z rzutek, które się liczą, bez przerw przyciętych do lega.
  - `achievements.ts`: rekordy gracza i wykrywanie osiągnięć.
  - `period.ts`: `periodStart`, czyli najstarsze `createdAt` gry w okresie statystyk liczone od zegara serwera z `AppOptions.now`.
- `src/achievement-reference.ts`: rekordy gracza z ukończonych meczów 1v1 do wykrywania osiągnięć. Osiągnięcia (`achievement` na WebSocket) dotyczą tylko meczów 1v1 i zapisanych profili, od drugiego ukończonego meczu 1v1 gracza. Liczymy je z logu, z pamięcią podręczną w procesie, i niczego nie zapisujemy.
- `src/tournament-service.ts`: komendy turnieju (utworzenie, lista, odczyt, statystyki, ponowne losowanie, start meczu, archiwizacja, wycofanie gracza, korekta wyniku, przełączenie udostępniania, subskrypcja), blokada cofnięcia końca meczu (`guardUndo`) i wysyłka widoku po zmianie legów w meczu turnieju.
- `src/public-tournament-service.ts`: publiczne odczyty turnieju, jego statystyk i jednego meczu, ze wspólną odpowiedzią 404.
- `src/public/`: `redact.ts` (publiczny widok i mecz bez prywatnych pól), `rate-limiter.ts` (limit żądań na adres klienta) i `response-cache.ts` (pamięć podręczna publicznych odpowiedzi z generacją na turniej).
- `src/tournament/`: `view.ts` (wejście silnika `tournamentInput` i budowa `TournamentView` z konfiguracji, logu turnieju i odtworzeń powiązanych meczów, z sumami rzutów do średnich), `stats.ts` (`buildTournamentStats`, czyli wiersze graczy i rekordy turnieju), `fixture-label.ts` (polska nazwa meczu turnieju z jego id) i `shuffle.ts` (losowanie kolejności graczy).
- `src/live-hub.ts`: rozsyłanie wiadomości do subskrybentów jednej gry albo, w drugim hubie, jednego turnieju.
- `src/serial-queue.ts`: kolejka komend z kluczem gry albo turnieju, jedna wspólna dla obu serwisów (kolejność kluczy opisana w „Turnieje”).
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
