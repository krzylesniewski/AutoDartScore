# P24-P30: aplikacja online (front i API na Mikr.us)

Decyzja 2026-10-20, tło i odrzucone warianty: `design/online-dyskusja.md`. Bez własnej domeny.

**Zmiana planu 2026-10-20 (po merge'u P24, P25 i P29):** front też na Mikr.usie, pod tym samym adresem co API, zamiast GitHub Pages. Jeden adres, jedno wdrożenie z jednym rollbackiem, bez CORS i bez ustawień Pages. P24 i P25 zostają bez zmian (adres API ze zmiennej i CORS jako opcja się przydają). P27 traci job Pages, dochodzi P30 (serwer podaje front).

**Cel:** cała aplikacja działa w internecie, bez komputera autora. Mecze dalej twarzą w twarz, przy jednej tarczy. Bez kont graczy, bez gry na odległość.

**Adres:** `https://lee110-3000.mikrus.cloud` dla frontu i API (darmowa subdomena Mikr.usa dla portu 3000, bez konfiguracji w panelu; HTTPS i proxy daje Cloudflare, aplikacja słucha po HTTP na IPv6, `HOST=::`). Front pod `/`, API pod swoimi ścieżkami (`/players`, `/matches`, …). W kodzie adres jest tylko w zmiennych.
- Serwer: VPS `lee110` (Mikr.us 2.1, Ubuntu 24.04, systemd, 1 GB RAM). Dane SSH tylko w zmiennych GitHuba i lokalnie, nie w repo. Przygotowane 2026-10-20: Node 24.22, pnpm 12.10.1, sqlite3, użytkownik `autoscore`, repo w `/home/autoscore/app`.

Logowanie daje token wysyłany w nagłówku `Authorization` (P25, P26). Przy jednym adresie CORS nie jest potrzebny: `AUTOSCORE_CORS_ORIGIN` zostaje pusta.

**Lokalnie bez zmian:** bez ustawionego hasła serwer działa jak dziś (brak logowania), a front bez `VITE_API_URL` woła `/api` przez proxy Vite. `pnpm dev` na Macu i gra w sieci lokalnej działają dalej.

**Wspólne zasady dla P24-P30:**
- Konfiguracja tylko przez zmienne środowiskowe, nazwy z prefiksem `AUTOSCORE_` (serwer) i `VITE_` (front). Żadnych adresów ani sekretów w repo.
- Typy żądań i wiadomości tylko z `packages/schema`.
- Komunikaty dla użytkownika po polsku, kolory tylko z `design/theme.css`.

## P24: adres API z konfiguracji (web)

**Zmiana:**
1. `API_BASE` w `packages/web/src/api/client.ts` bierze adres z `import.meta.env.VITE_API_URL`; bez zmiennej zostaje `/api` (proxy Vite, jak dziś).
2. Adres WebSocketa (`liveUrl` w `packages/web/src/api/use-match.ts`) powstaje z `API_BASE`: adres bezwzględny `https://…` zamienia się na `wss://…`, `http://…` na `ws://…`; względny `/api` składa się z `location` jak dziś.
3. Ścieżka bazowa builda z `VITE_BASE` (dla Pages `/AutoDartScore/`; po zmianie planu na Mikr.usie `/`), domyślnie `/`. Nagrania już używają `import.meta.env.BASE_URL` (`recorded-speaker.ts`); sprawdzić, że nic innego nie zakłada ścieżki `/` (ikony, fonty, linki).
4. Opis zmiennych w `packages/web/README.md`.

**Testy:** budowa adresu REST i WebSocketa dla `/api`, `https://…`, `http://…`, z ukośnikiem na końcu i bez.

**Poza zakresem:** logowanie (P26), workflow Pages (P27), zmiany w serwerze.

## P25: hasło do aplikacji i CORS (server, schema)

**Zmiana:**
1. **Hasło:** zmienna `AUTOSCORE_PASSWORD`. Bez niej logowanie jest wyłączone i serwer działa jak dziś. Z nią każde żądanie poza `GET /health`, `POST /auth/login` i `OPTIONS` wymaga nagłówka `Authorization: Bearer <token>`, inaczej `401` z kodem `unauthorized` (format błędu jak dziś, `ApiError`).
2. **Token:** `POST /auth/login` z `{ password }` zwraca `{ token, expiresAt }`. Token bezstanowy, podpisany HMAC-SHA256 kluczem `AUTOSCORE_TOKEN_SECRET` (wymagany, gdy jest hasło; serwer nie startuje bez niego), ważny 180 dni. Zmiana klucza wylogowuje wszystkie urządzenia. Porównania w stałym czasie (`timingSafeEqual`). Złe hasło: `401` z kodem `invalid_password`.
3. **Ochrona przed zgadywaniem:** najwyżej 10 nieudanych logowań na minutę na cały serwer (licznik w pamięci), potem `429`.
4. **WebSocket:** przeglądarka nie ustawia nagłówków przy WebSockecie, więc przy włączonym haśle pierwsza wiadomość klienta to `{ "type": "auth", "token": "…" }`. Bez poprawnej wiadomości w ciągu 5 s serwer zamyka połączenie kodem 4401 i nie wysyła stanu. Token nie trafia do adresu URL (logi proxy). Serwer wysyła ping co 30 s na każdym połączeniu, bo Cloudflare przed Mikr.usem zamyka połączenia bezczynne dłużej niż ok. 100 s.
5. **CORS:** zmienna `AUTOSCORE_CORS_ORIGIN` (lista adresów po przecinku, np. `https://krzylesniewski.github.io`). Z nią `@fastify/cors` przepuszcza tylko te adresy, z nagłówkiem `Authorization`, a WebSocket odrzuca inny nagłówek `Origin`. Bez niej zachowanie jak dziś.
6. **`GET /health`:** `{ "status": "ok" }`, bez logowania, do sprawdzania serwera po wdrożeniu.
7. **Schema:** `LoginRequest`, `LoginResponse` i wiadomość `auth` klienta WebSocketa w `packages/schema`.
8. Opis zmiennych w `packages/server/README.md`.

**Testy:** wyłączone logowanie nie zmienia żadnego istniejącego testu; z hasłem: brak tokena, zły token, wygasły token, token z innym kluczem, poprawny token; login dobry i zły; limit prób; `/health` bez tokena; WebSocket bez wiadomości `auth`, ze złym tokenem i z dobrym; CORS dla dozwolonego i obcego adresu.

**Poza zakresem:** konta graczy, wylogowanie, zmiana hasła z poziomu aplikacji, token dla `vision`.

## P26: ekran logowania (web)

**Zależy od:** P24, P25.

**Zmiana:**
1. Gdy API odpowie `401` (`unauthorized`), aplikacja pokazuje ekran logowania zamiast bieżącego ekranu: logo, pole „Hasło”, przycisk „Zaloguj”. Styl jak reszta aplikacji (motyw A, kanciaste karty), działa na telefonie, tablecie i monitorze.
2. Po udanym logowaniu token trafia do `localStorage` (klucz `autoscore.token`), a aplikacja wraca do ekranu, na którym była. Każde żądanie wysyła nagłówek `Authorization`, a połączenie na żywo wysyła najpierw wiadomość `auth`.
3. Złe hasło: komunikat „Nieprawidłowe hasło” (tekst i ikona, nie sam kolor). `429`: „Za dużo prób, spróbuj za minutę”.
4. `401` przy zapisanym tokenie (wygasł, zmieniony klucz) usuwa token i pokazuje logowanie.
5. Serwer bez hasła nigdy nie zwraca `401`, więc lokalnie ekran logowania się nie pojawia.

**Testy:** pokazanie logowania po `401`, udane logowanie z nagłówkiem w kolejnych żądaniach, złe hasło, `429`, wygasły token, wiadomość `auth` jako pierwsza na WebSockecie.

**Poza zakresem:** wylogowanie i ustawienia (osobna zakładka Ustawienia), konta graczy.

## P27: automatyczne wdrożenie po merge'u (CI)

**Zależy od:** P28, P30.

**Zmiana:** nowy workflow `.github/workflows/deploy.yml`. Każdy merge do `main` z zielonym CI wdraża aplikację (API i front razem) na Mikr.usa.
1. **Wyzwalacz:** `workflow_run` po zakończeniu workflow CI na `main`, tylko z wynikiem sukces, oraz ręcznie (`workflow_dispatch`). Wdrażany jest dokładnie commit, który przeszedł CI (`workflow_run.head_sha`).
2. **`concurrency: deploy`** bez przerywania trwającego wdrożenia.
3. **Jeden job `deploy`** (środowisko `production`): łączy się przez SSH z Mikr.usem i przekazuje tylko SHA. Klucz z sekretu `MIKRUS_SSH_KEY`, odcisk serwera z sekretu `MIKRUS_KNOWN_HOSTS` (bez `StrictHostKeyChecking=no`), host i port ze zmiennych `MIKRUS_HOST` i `MIKRUS_SSH_PORT`. Całą logikę (build frontu, restart, `/health`, rollback) robi `deploy.sh` na serwerze (P28, P30); workflow niczego innego nie wykonuje.
4. Uprawnienia tylko `contents: read`. Brak którejś zmiennej lub sekretu przerywa job z czytelnym błędem.
5. Opis w `deploy/README.md` (sekcja „Automatyczne wdrożenie”): jakie sekrety i zmienne ustawić w repozytorium.

**Bezpieczeństwo:** sekrety nie są dostępne dla workflow z PR-ów, więc PR niczego nie wdroży. Agenci rolloutu nie uruchamiają workflow; wdrożenie wyzwala tylko merge.

**Poza zakresem:** GitHub Pages (wypadło ze zmianą planu), zmiany w `ci.yml`, wdrożenia z gałęzi innych niż `main`.

## P28: serwer na Mikr.usie, wdrożenie, kopie i przeniesienie bazy (deploy)

**Zależy od:** P25.

**Zmiana:** nowy katalog `deploy/` (bez zmian w kodzie aplikacji):
1. **`autoscore.env.example`:** `HOST=::`, `PORT`, `DATABASE_PATH`, `AUTOSCORE_PASSWORD`, `AUTOSCORE_TOKEN_SECRET`, `AUTOSCORE_CORS_ORIGIN`, z opisem każdej zmiennej.
2. **`autoscore.service`:** usługa systemd uruchamiająca serwer jako użytkownik `autoscore` (nie `root`), z plikiem env, restart po awarii. Migracje bazy robi serwer przy starcie (jak dziś w `main.ts`).
3. **`deploy.sh` (na serwerze):** wywoływany przez klucz wdrożeniowy z wymuszoną komendą w `authorized_keys` (`command="…/deploy.sh",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding`). Kroki: przyjmuje tylko 40-znakowy SHA z `SSH_ORIGINAL_COMMAND`; `git fetch` i sprawdzenie, że commit jest na `origin/main`; kopia bazy (`sqlite3 .backup`) i zapamiętanie obecnego SHA; `git checkout <sha>`, `pnpm install --frozen-lockfile`, restart usługi; `GET /health` do 30 s. Bez odpowiedzi: powrót do poprzedniego SHA i kopii bazy, restart, kod wyjścia różny od zera. Blokada pliku, żeby dwa wdrożenia nie szły naraz. Log każdego wdrożenia.
4. **`backup.sh` (na serwerze, cron raz na dobę):** `sqlite3 .backup` do katalogu kopii, 14 ostatnich. **`pull-backup.sh` (z Maca):** ściąga najnowszą kopię, żeby kopia była też poza serwerem.
5. **`migrate-db.sh` (z Maca, jednorazowo): przeniesienie obecnych wyników na Mikr.usa.**
   - Robi spójną kopię lokalnej bazy przez `sqlite3 .backup` (nie zwykłe kopiowanie pliku), sprawdza `PRAGMA integrity_check` i liczy wiersze w `players`, `matches`, `throws`, `match_events`.
   - Wysyła kopię przez `scp` do katalogu tymczasowego na serwerze, tam ponownie `integrity_check` i te same liczniki. Różnica przerywa przeniesienie.
   - Zatrzymuje usługę, podmienia bazę, uruchamia usługę (migracje schematu przy starcie) i sprawdza `GET /health`.
   - Odmawia nadpisania niepustej bazy na serwerze bez flagi `--force`, a przed nadpisaniem i tak robi jej kopię.
   - Ścieżki lokalnej bazy i serwera z argumentów lub zmiennych, nie z repo.
6. **`deploy/README.md` po polsku:** instalacja Node 24, pnpm, sqlite3 i gita na Mikr.usie; użytkownik `autoscore`; subdomena w panelu; usługa i cron; klucz wdrożeniowy (generowanie, wpis z wymuszoną komendą, sekrety w GitHubie); przeniesienie bazy; test WebSocketa; przywracanie z kopii; ręczne wdrożenie i rollback.

**Testy:** każdy skrypt przechodzi `bash -n` i `shellcheck` uruchomione lokalnie (wynik w opisie PR-a). `migrate-db.sh` ma tryb lokalny (dwa pliki SQLite, bez SSH) i jest w nim sprawdzony: liczniki, `integrity_check`, odmowa nadpisania niepustej bazy bez `--force`. W plikach nie ma sekretów, adresów serwera ani ścieżek użytkownika.

**Poza zakresem:** workflow GitHuba (P27), zmiany w kodzie serwera.

## P29: build i test startu serwera w CI (CI)

**Zmiana:** dwa nowe joby w `.github/workflows/ci.yml`, uruchamiane przy każdym PR-ze i pushu na `main`, z tym samym przygotowaniem co obecne joby:
1. **`build`:** `pnpm --filter @autoscore/web build` z `VITE_BASE=/AutoDartScore/`. Łapie błędy builda (np. CSS), których typecheck nie widzi.
2. **`smoke`:** start serwera (`pnpm --filter @autoscore/server start`) na pustej bazie w katalogu tymczasowym, na wolnym porcie, i żądanie `GET /players`, które musi zwrócić 200 w ciągu 30 s. Potem zatrzymanie serwera. Łapie błędy migracji na świeżej bazie i startu.

**Po merge'u (ręcznie):** dopisanie `build` i `smoke` do `requiredChecks` w manifeście rolloutu.

**Poza zakresem:** wdrożenia (P27), zmiany w kodzie aplikacji.

## P30: serwer podaje front, build frontu przy wdrożeniu (server, deploy)

**Zależy od:** P28.

**Zmiana:**
1. **Pliki frontu z serwera:** zmienna `AUTOSCORE_WEB_DIR` (katalog ze zbudowanym frontem, `packages/web/dist`). Z nią Fastify (`@fastify/static`) podaje pliki frontu spod `/`: `/` i `/index.html` oraz pliki z katalogu (`/assets/*`, `/audio/*` i inne). Bez zmiennej serwer działa jak dziś. Katalog bez `index.html` przy ustawionej zmiennej: serwer nie startuje, z czytelnym błędem.
2. **Bez kolizji z API:** front używa routingu `#/`, więc potrzebuje tylko plików. Trasy API mają pierwszeństwo; plik o ścieżce trasy API nie może jej zasłonić. Nieznana ścieżka, której nie ma ani w API, ani w plikach, działa jak dziś (401 bez tokena przy włączonym haśle, 404 z tokenem).
3. **Dostęp bez tokena tylko do plików frontu:** blokada z P25 przepuszcza bez tokena żądania `GET` i `HEAD` do plików frontu (inaczej przeglądarka nie dostanie nawet ekranu logowania). Wszystkie trasy API dalej wymagają tokena jak w P25.
4. **Nagłówki pamięci podręcznej:** `index.html` z `Cache-Control: no-cache` (nowa wersja po wdrożeniu od razu), `/assets/*` (nazwy z hashem) z `public, max-age=31536000, immutable`, nagrania `/audio/*` z `public, max-age=604800`.
5. **`deploy/deploy.sh`:** po `pnpm install` build frontu (`pnpm --filter @autoscore/web build`) z `VITE_API_URL` z pliku env (nowa zmienna `AUTOSCORE_PUBLIC_URL`, np. adres z mikrus.cloud) i `VITE_BASE=/`. Nieudany build to nieudane wdrożenie (rollback jak przy braku `/health`). Przy braku pamięci limit `NODE_OPTIONS=--max-old-space-size=512` dla builda.
6. **`deploy/autoscore.env.example` i `deploy/README.md`:** `AUTOSCORE_WEB_DIR`, `AUTOSCORE_PUBLIC_URL`, informacja, że `AUTOSCORE_CORS_ORIGIN` zostaje pusta przy jednym adresie. **`packages/server/README.md`:** opis `AUTOSCORE_WEB_DIR`.

**Testy (server):** bez zmiennej nic się nie zmienia (istniejące testy bez zmian); z katalogiem: `/` i plik z `/assets` bez tokena przy włączonym haśle, nagłówki pamięci podręcznej, trasa API dalej 401 bez tokena, nieznana ścieżka jak w P25, `HEAD` dla pliku, brak `index.html` przy starcie. Skrypty: `bash -n` i `shellcheck` lokalnie (wynik w opisie PR-a).

**Poza zakresem:** zmiany w kodzie frontu (P24 już obsługuje adres i ścieżkę), workflow GitHuba (P27), kompresja plików (robi ją Cloudflare).

## Kroki ręczne (autor, poza PR-ami)

0. ~~Test WebSocketa na Mikr.usie~~ **zrobione 2026-10-20:** obecny serwer za `https://lee110-3000.mikrus.cloud` przepuszcza REST i WebSocket (`state_updated`, `throw_registered` po rzucie), połączenie bez ruchu trwało 75 s bez zerwania.
1. ~~Kupić Mikr.us 2.1~~ zrobione (`lee110`); subdomena dedykowana niepotrzebna, wystarcza `lee110-3000.mikrus.cloud`.
2. Po P28: przygotować serwer wg `deploy/README.md` (użytkownik `autoscore`, usługa, cron, hasło i klucz w pliku env).
3. **Przeniesienie wyników:** zatrzymać lokalny serwer i uruchomić `deploy/migrate-db.sh` dla `packages/server/autoscore.sqlite` (stan na 2026-10-20: 20 gier, 1605 rzutek, 4 graczy). Od tej chwili źródłem prawdy jest baza na Mikr.usie; lokalnej nie używać do gier, żeby dane się nie rozjechały.
4. Wygenerować klucz wdrożeniowy, dodać go na serwerze z wymuszoną komendą; w repozytorium: sekrety `MIKRUS_SSH_KEY` i `MIKRUS_KNOWN_HOSTS`, zmienne `MIKRUS_HOST` i `MIKRUS_SSH_PORT`. GitHub Pages niepotrzebne.
5. ~~Po P29: dopisać `build` i `smoke` do `requiredChecks` w manifeście~~ zrobione 2026-10-20.
6. Zapisać w `CLAUDE.md` i `auto-score-dart-pomysly.md` zmianę zasady local-first (gra wymaga internetu; lokalny tryb zostaje do rozwoju).
