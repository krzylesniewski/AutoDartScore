# Etap 4: wzmocnienie po audycie (Q1-Q17)

Źródło: audyt całego `main` z 2026-11-12 (wersja `9e72b29`), decyzja autora z 2026-11-15: wszystkie znaleziska P0-P3 wchodzą jednym rolloutem `autoscore-etap4` na gałęzi `feat/hardening`. Do `main` gałąź wchodzi PR-em na koniec. Kamery (dwie kamery USB) przesuwają się na etap 5, mini PC na 6, wersja online na 7.

Dwa znaleziska P0 to ustawienia repozytorium na GitHubie, a nie kod (ochrona gałęzi `main` i ograniczenie środowiska `production` do `main`). Ustawia je autor albo Claude poza rolloutem; agenci ich nie ruszają.

## Zasady wspólne dla Q1-Q17

- **Zachowanie bez zmian**, poza tym, co sekcja PR-a wprost wymienia. To etap napraw i porządków, nie nowych funkcji. Żadnych zmian wyglądu poza Q12 (okna) i tym, co wynika z poprawek.
- **Zasady z `CLAUDE.md` wiążą dalej:** backend jest źródłem prawdy, log zdarzeń tylko do dopisywania, typy i DTO tylko z `packages/schema`, statystyki z tabeli rzutek, warstwa danych bez funkcji specyficznych dla SQLite, kolory tylko z tokenów, teksty po polsku z `i18n/pl.ts`, kolor nie niesie znaczenia sam.
- **Każda poprawka błędu ma test, który bez niej nie przechodzi.** Opis PR-a mówi, jak test odtwarza błąd.
- **Migracje bazy** tylko tam, gdzie sekcja je wymienia; każda w transakcji i z testem na bazie ze stanem sprzed migracji.
- **Dokumentacja:** PR aktualizuje README pakietu, który zmienia (i tabelę API w głównym `README.md`, gdy zmienia API). Większe porządki w README robi Q16.
- **Pliki tylko do czytania:** `CLAUDE.md`, `auto-score-dart-pomysly.md`, `rollout/**`, `design/plan-etap4.md`, `design/scena/**`, `design/mockups/**`.
- **Niejasność albo decyzja spoza planu:** pytanie zamiast zgadywania.

## Kolejność i zależności

Równolegle mogą iść: Q1, Q2, Q4, Q5, Q6. Reszta czeka na pliki, które dzielą:
- `ci.yml`: Q2 → Q9 → Q11 → Q13 → Q17;
- serwer: Q2 → Q3; Q6 → Q7;
- front: Q4 + Q7 → Q8 → Q12 → Q15;
- porządki na końcu: Q14 (po Q7), Q16 (po Q13, Q14, Q15), Q17 (ostatni, bo formatuje całe repo).

---

## P0: bezpieczeństwo produkcji

### Q1: limity na kanale WebSocket (server)

**Dziś:** `app.register(websocket)` w `packages/server/src/app.ts` bez opcji, więc biblioteka `ws` przyjmuje wiadomości do 100 MiB. Wiadomości są przyjmowane przed uwierzytelnieniem (`routes/live.ts`), a liczba nieuwierzytelnionych połączeń nie ma limitu. Kilka połączeń może wyczerpać pamięć serwera 1 GB. Serwer pinguje, ale nie sprawdza odpowiedzi ani `bufferedAmount` (`live-hub.ts`).

**Zmiana:**
1. `maxPayload` na poziomie kilku kilobajtów (wiadomości klienta to tylko uwierzytelnienie i subskrypcja; dobierz wartość z zapasem i opisz ją stałą).
2. Limit jednoczesnych połączeń przed uwierzytelnieniem (stała, np. 20) i krótki czas na uwierzytelnienie, jak dziś; nadmiarowe połączenie zamykane kodem z opisem.
3. Połączenie bez odpowiedzi na ping jest zamykane; połączenie z zaległym buforem ponad próg jest odłączane, żeby wolny klient nie trzymał pamięci.

**Testy:** wiadomość ponad limit zamyka połączenie i nie trafia do `JSON.parse`; ponad limit połączeń nieuwierzytelnionych odmowa; brak ponga zamyka połączenie; zwykły przebieg (uwierzytelnienie, subskrypcja, `state_updated`) bez zmian.

### Q2: serwer nie startuje bez hasła, chyba że jawnie tak ustawiono (server, CI)

**Dziś:** `parseAuth` w `packages/server/src/config.ts` przy pustym `AUTOSCORE_PASSWORD` zwraca `null` i serwer wystawia całe API bez logowania, bez ostrzeżenia. Literówka w pliku env na serwerze otwiera zapis publicznie.

**Zmiana:**
1. Nowa zmienna `AUTOSCORE_AUTH`. Bez hasła serwer startuje tylko przy `AUTOSCORE_AUTH=off`; inaczej kończy się błędem z jasnym komunikatem (bez sekretów w treści).
2. Hasło równe wartości przykładowej z `deploy/autoscore.env.example` jest odrzucane przy starcie.
3. `pnpm dev` (lokalna praca) i job `smoke` w CI ustawiają `AUTOSCORE_AUTH=off`. Testy serwera, które tworzą aplikację bez hasła, robią to jawnie.
4. Start bez logowania zapisuje jedno wyraźne ostrzeżenie w logu.
5. `deploy/autoscore.env.example`, `deploy/README.md`, `README.md` i `packages/server/README.md` opisują zmienną.

**Testy:** konfiguracja (brak hasła bez `off` rzuca błąd; z `off` daje brak logowania; hasło + sekret jak dziś; hasło przykładowe odrzucone; `off` razem z hasłem to błąd konfiguracji).

**Uwaga do wdrożenia:** produkcja ma hasło w pliku env, więc ta zmiana nie wymaga ruchu na serwerze.

### Q3: tokeny do odwołania i limit logowania per klient (server)

**Dziś:** token to podpisane `v1.<wygaśnięcie>`, ważny 180 dni (`auth/credentials.ts`). Zmiana hasła nie unieważnia wydanych tokenów. `auth/login-limiter.ts` ma jeden licznik błędów dla całego serwera, więc 10 złych haseł na minutę blokuje logowanie wszystkim. `trustProxy` nie jest ustawione.

**Zmiana:**
1. Klucz podpisu tokenu wynika z sekretu i z hasła (np. HMAC sekretu po skrócie hasła), więc zmiana hasła unieważnia wszystkie tokeny. Wersja tokenu rośnie do `v2`; tokeny `v1` są odrzucane jak nieważne (401, klient pokazuje logowanie).
2. Ważność tokenu 30 dni (stała).
3. Limit prób logowania liczony per adres klienta, z dużo wyższym limitem globalnym jako bezpiecznikiem. Adres klienta z `request.ip`; nowa zmienna `AUTOSCORE_TRUST_PROXY` (domyślnie wyłączona) włącza `trustProxy` w Fastify dla serwera za proxy. Bez niej limit per klient działa na adresie połączenia.
4. Dokumentacja zmiennych w `deploy/autoscore.env.example` i README.

**Testy:** token wydany przed zmianą hasła nie przechodzi po zmianie; token `v1` odrzucony; wygasły token odrzucony; 10 błędnych prób z jednego adresu blokuje tylko ten adres; poprawne hasło z innego adresu działa; limit globalny działa.

**Uwaga do wdrożenia:** po wdrożeniu wszystkie urządzenia logują się ponownie (raz). Produkcja stoi za proxy dostawcy, więc autor ustawia `AUTOSCORE_TRUST_PROXY` w pliku env na serwerze; bez tego wszystkie logowania mają ten sam adres i działa tylko limit globalny.

---

## P1: błędy widoczne dla graczy

### Q4: kolejka komend na ekranie gry nie gubi błędów i nie wisi (web)

**Dziś:** `packages/web/src/api/use-match.ts` wysyła komendy szeregowo, a każdy sukces robi `setError(null)`. Trzy szybkie rzutki, z których pierwsza się nie zapisze, kończą się turą z dwiema rzutkami i bez komunikatu. `request()` w `api/client.ts` nie ma limitu czasu, więc jedno zawieszone zapytanie zostawia `busy` na zawsze, wyłącza Cofnij i kolejkuje kliknięcia po cichu. `GameScreen.tsx` rozpoznaje blokadę meczu przez porównanie tekstu (`error === pl.matchLocked`).

**Zmiana:**
1. Limit czasu każdego zapytania (`AbortSignal.timeout`, stała około 8 s), zgłaszany jak błąd sieci.
2. Nieudana rzutka zatrzymuje kolejkę: komendy czekające za nią są porzucane, a błąd zostaje na ekranie, dopóki gracz nie wykona kolejnej akcji, która się powiedzie. Kolejny sukces po porzuceniu kolejki czyści błąd jak dziś.
3. Ponowienie rzutki po błędzie sieci używa tego samego `eventId` (serwer już deduplikuje), jedno automatyczne ponowienie przed pokazaniem błędu.
4. `useMatch` zwraca kod błędu (typ z unią kodów), a `GameScreen` sprawdza kod blokady zamiast tekstu.
5. Osobny plik testów dla `useMatch`.

**Testy:** błąd pierwszej z trzech rzutek: dwie następne nie są wysyłane, błąd widoczny; zawieszone zapytanie po limicie czasu daje błąd i odblokowuje Cofnij; ponowienie z tym samym `eventId`; blokada meczu rozpoznana po kodzie także po zmianie tekstu.

### Q5: skróty klawiszowe nie przejmują Spacji i Entera na innych kontrolkach (web)

**Dziś:** `components/use-keypad-shortcuts.ts` robi `preventDefault()` dla skrótu przy każdym celu poza polem tekstowym i otwartym oknem. Z fokusem na przełączniku głosu, menu albo „Porzuć mecz” Spacja wpisuje Miss, a Enter rzutkę z podpowiedzi. `use-checkout-shortcuts.ts` ma to samo dla Entera.

**Zmiana:** gdy cel zdarzenia jest elementem interaktywnym (przycisk, link, pole, element z rolą przycisku, przełącznika, pozycji menu) poza sekcją klawiatury rzutek, Spacja i Enter zostają dla przeglądarki. Pozostałe skróty (S/D/T, cyfry, B, Shift+B, Backspace) działają jak dziś. Fokus na klawiszu klawiatury rzutek zachowuje dzisiejsze zachowanie.

**Testy:** Spacja i Enter na przełączniku głosu, przycisku menu i „Tury” klikają tę kontrolkę i nie wysyłają rzutki; na klawiszu klawiatury i na `body` działają jak dziś; to samo dla skrótów treningu „Końcówki”.

### Q6: szybkie listy i statystyki (server)

**Dziś:** `GET /matches`, rankingi, overall i statystyki gracza odtwarzają każdy mecz od zera przy każdym zapytaniu, po 4 zapytania na mecz. `throws` nie ma indeksu po `match_id`, a `match_players` po `player_id`. Przy 300 meczach i 45 tys. rzutek to 2-3 s na zapytanie, a `node:sqlite` jest synchroniczne, więc rzutki na żywo czekają. Filtr `status` w `GET /matches` działa po odtworzeniu. Jeden uszkodzony mecz daje 500 na wszystkich listach.

**Zmiana:**
1. Migracja z indeksami `throws(match_id)`, `match_events(match_id)` (jeśli brak) i `match_players(player_id)`.
2. Pamięć podręczna wyniku odtworzenia per mecz, kluczowana `(matchId, seq ostatniego wpisu)`, z limitem rozmiaru; mecz bez nowych zdarzeń nie jest odtwarzany ponownie. Bez osobno utrzymywanych liczników: to wciąż wynik odtworzenia zdarzeń.
3. Wczytanie graczy i logów dla listy meczów w paczkach zamiast per mecz.
4. Filtry `type`, `playerId` i limit listy w zapytaniu do bazy tam, gdzie nie wymagają odtworzenia; `status` z odtworzenia, ale z pamięci podręcznej.
5. Uszkodzony mecz jest logowany i pomijany w listach i agregatach (z licznikiem w logu), zamiast błędu 500 dla wszystkich. `GET /matches/:id` dla takiego meczu dalej zwraca błąd.
6. `listPlayers`: tylko ostatnia zmiana profilu per gracz zamiast całej historii.

**Testy:** wyniki list i statystyk identyczne jak przed zmianą (test porównawczy na danych testowych); drugie zapytanie nie odtwarza meczu bez nowych zdarzeń; nowa rzutka unieważnia wpis; uszkodzony mecz nie psuje listy; migracja na bazie sprzed zmiany. W opisie PR pomiar przed i po na bazie z co najmniej 300 meczami.

### Q7: Cofnij odporne na powtórzenie i „Reszta Miss” jako jedna komenda (schema, server)

**Dziś:** tylko rzutki są idempotentne (`eventId`). Dwa `POST /matches/:id/undo` pod rząd usuwają dwie rzutki; ponowienie po błędzie sieci albo podwójne dotknięcie na dwóch urządzeniach usuwa o jedną za dużo. To samo dotyczy prób i pominięć w treningu „Końcówki” oraz porzucenia. „Reszta Miss” to pętla do trzech zapytań we froncie. Ponowne wysłanie tego samego `eventId` z inną treścią zwraca 200 ze starą rzutką.

**Zmiana:**
1. Komendy zmieniające stan poza rzutką (`undo`, próba i pominięcie końcówki oraz ich cofnięcia, porzucenie, wznowienie, koniec treningu) przyjmują opcjonalne `expectedSeq` (ostatnie `eventSeq`, które widział klient). Niezgodność daje 409 z kodem `stale_state` i aktualnym stanem w odpowiedzi. Bez `expectedSeq` zachowanie jak dziś (zgodność wstecz).
2. Nowa komenda `POST /matches/:id/rest-miss`: w jednej transakcji dopisuje Miss za każdą rzutkę, która została w turze rzucającego, z `eventId` do idempotencji i `expectedSeq`. Zdarzenia w logu to zwykłe rzutki Miss.
3. Ten sam `eventId` z inną treścią rzutki daje 409 zamiast 200.
4. Typy żądań i kod błędu w `packages/schema`.

**Testy:** dwa `undo` z tym samym `expectedSeq`: drugi dostaje 409 i nic nie usuwa; `rest-miss` przy 0, 1 i 2 rzutkach w turze, powtórzony z tym samym `eventId` nie dopisuje nic więcej, po końcu meczu odmowa; `eventId` z inną treścią 409; komendy bez `expectedSeq` jak dziś.

### Q8: front wysyła `expectedSeq` i używa „Reszty Miss” z serwera (web)

**Zależy od:** Q4, Q7.

**Zmiana:**
1. `useMatch` wysyła `expectedSeq` z każdą komendą z Q7. Odpowiedź 409 `stale_state` przyjmuje stan z odpowiedzi i nie pokazuje błędu (cofnięcie już się wykonało albo stan się zmienił), poza przypadkiem, gdy gracz ma zobaczyć, że nic nie cofnięto.
2. „Reszta Miss” to jedno zapytanie `rest-miss`; pętla i logika tury znikają z frontu.

**Testy:** podwójne Cofnij wysyła drugie zapytanie z tym samym `expectedSeq` i po 409 stan jest spójny; „Reszta Miss” wysyła jedno zapytanie; błąd „Reszty Miss” nie zostawia częściowej tury.

### Q9: wdrożenie nie przebudowuje frontu pod działającym serwerem; skrypty wdrożenia w CI (deploy, CI)

**Dziś:** `deploy/deploy.sh` robi `pnpm install` i `vite build` do działającego `packages/web/dist`, zanim zatrzyma usługę. Przez kilka sekund klienci mogą dostać niepełny front, a przy braku pamięci na serwerze 1 GB wycofanie też wymaga budowania. Kopia bazy przy wdrożeniu nie robi `PRAGMA integrity_check`, a kopia dzienna robi. Skrypty w `deploy/` nie są sprawdzane w CI (`test-migrate-db.sh` istnieje, ale nic go nie uruchamia).

**Zmiana:**
1. Front budowany do katalogu obok (`dist.new`), podmiana katalogów po zatrzymaniu usługi, poprzedni `dist` zostaje jako `dist.prev`; wycofanie przywraca `dist.prev` bez budowania.
2. Nieudane budowanie kończy wdrożenie przed zatrzymaniem usługi: stara wersja działa dalej.
3. Kopia bazy przy wdrożeniu sprawdza integralność jak kopia dzienna.
4. Nowy job CI: `shellcheck` na `deploy/*.sh`, uruchomienie `deploy/test-migrate-db.sh` i test na sucho wdrożenia oraz wycofania z użyciem istniejących nadpisań `AUTOSCORE_*` (bez dostępu do serwera).
5. `deploy/README.md`: opis nowego przebiegu i instrukcja ręcznego wycofania do starszej wersji (przywrócenie kopii bazy z wdrożenia + wdrożenie starego SHA).

**Poza zakresem:** przeniesienie budowania do CI i wysyłanie paczki; logowanie do serwera.

**Uwaga do wdrożenia:** pierwsze wdrożenie po tej zmianie wykona jeszcze stary skrypt albo nowy, zależnie od tego, skąd serwer go bierze; PR opisuje to wprost na podstawie `deploy/README.md`.

### Q10: kopie zapasowe poza serwerem (deploy)

**Dziś:** kopie zostają w `/home/autoscore/backups` na tym samym serwerze. `deploy/pull-backup.sh` pobiera je na Maca tylko ręcznie.

**Zmiana:** szablon zadania `launchd` dla macOS (`deploy/pl.autoscore.pull-backup.plist` albo podobna nazwa) uruchamiający `pull-backup.sh` raz dziennie, z logiem i z zachowaniem ostatnich N kopii lokalnie; `pull-backup.sh` sprawdza integralność pobranej kopii i kończy się kodem błędu, gdy najnowsza kopia na serwerze jest starsza niż 48 h. `deploy/README.md` opisuje instalację i sprawdzenie, że zadanie działa.

**Testy:** test skryptu na sucho (w jobie z Q9) dla: nowa kopia, brak nowej kopii, uszkodzona kopia.

**Uwaga do wdrożenia:** zadanie instaluje autor na swoim Macu według README.

---

## P2: jakość i tempo zmian

### Q11: test end-to-end na konfiguracji produkcyjnej (CI, web, server)

**Dziś:** job `smoke` robi tylko `GET /players` bez frontu, hasła i WebSocketa. Job `build` buduje z `VITE_BASE=/AutoDartScore/` (pozostałość po GitHub Pages), a produkcja z `/`.

**Zmiana:**
1. Playwright jako zależność deweloperska (tylko Chromium) i katalog testów e2e.
2. Test uruchamia prawdziwy serwer z hasłem, `AUTOSCORE_WEB_DIR` wskazującym zbudowany front i pustą bazą tymczasową. Scenariusz: logowanie, dwóch nowych graczy, mecz 1v1 301, kilka rzutek z klawiatury ekranowej i ze skrótów, Cofnij, zamknięcie lega, ekran podsumowania, statystyki pokazują grę. Drugie okno przeglądarki widzi stan na żywo przez WebSocket.
3. Sprawdzenia układu w prawdziwej przeglądarce przy 375×812, 768×1024, 1280×800 i 1920×1080: brak poziomego przewijania strony na ekranie gry, nowej gry i statystyk; cała klawiatura rzutek w oknie; klawiatura nie zmienia położenia po wpisaniu rzutki. To zastąpi asercje na klasach w Q15.
4. Job CI `e2e` (wymagany jak pozostałe); `smoke` zostaje jako szybki test API. `build` buduje z `/`.
5. `pnpm e2e` lokalnie; opis w README.

**Testy:** to są testy. Stabilność: bez `sleep`, czekanie na stan; job powtórzony 3 razy w opisie PR bez błędu.

### Q12: wspólne okno dialogowe, komunikaty dla czytników i polskie błędy (web)

**Dziś:** pięć okien (`AbandonDialog`, `EndPracticeDialog`, `NewPlayerDialog`, `EditPlayerDialog`, `ArchivePlayerDialog`) ma skopiowaną powłokę z `aria-modal="true"`, ale bez pułapki fokusu, bez wyłączenia tła i bez powrotu fokusu po zamknięciu. `Notice` istnieje w trzech wersjach i nie ma roli ogłaszanej czytnikom, więc „utrata połączenia” i błędy komend nie są czytane. `HomeScreen`, `NewPlayerDialog` i `EditPlayerDialog` pokazują surowy tekst serwera po angielsku. Escape w trakcie zapisu zamyka okno nowego gracza, a gracz i tak zostaje dodany i zaznaczony.

**Zmiana:**
1. Jeden komponent `Dialog` oparty na natywnym `<dialog>` z `showModal()` (pułapka fokusu i nieaktywne tło z przeglądarki), z powrotem fokusu na element, który okno otworzył, i z jedną obsługą Escape. Pięć okien przechodzi na niego bez zmiany wyglądu.
2. Jeden komponent `Notice` z `role="alert"` (błędy, utrata połączenia) albo `role="status"` (informacje); lokalne kopie znikają.
3. Błędy z API mapowane po kodzie na teksty z `pl.ts`, z `pl.requestFailed` jako domyślnym. Surowy tekst serwera nie trafia na ekran.
4. Escape i Anuluj są nieaktywne w trakcie zapisu.
5. Menu w nagłówku gry zamyka się też po kliknięciu poza nim.

**Testy:** Tab nie wychodzi poza okno; po zamknięciu fokus wraca na przycisk, który je otworzył; `Notice` ma właściwą rolę; błąd 500 i błąd walidacji pokazują polski tekst; Escape w trakcie zapisu nie zamyka okna.

### Q13: zależności pod nadzorem (CI, zależności)

**Dziś:** `pnpm audit` zgłasza 10 podatności (6 średnich, 4 niskie): `fast-uri` przez `fastify`, `glob` przez `@fastify/static`, `minimatch` przez `eslint`. Nie ma Dependabota ani kroku audytu w CI.

**Zmiana:**
1. Aktualizacja zależności tak, żeby `pnpm audit` nie zgłaszał podatności możliwych do usunięcia aktualizacją (bez zmian wersji głównych poza koniecznymi; TypeScript zostaje na 6.x zgodnie z `CLAUDE.md`).
2. `.github/dependabot.yml`: cotygodniowe aktualizacje npm (zgrupowane: produkcyjne i deweloperskie osobno) i GitHub Actions.
3. Krok CI `pnpm audit --prod --audit-level high`.
4. `permissions: contents: read` w `ci.yml`.

**Testy:** pełny zestaw testów i e2e po aktualizacji; wynik `pnpm audit` w opisie PR.

**Uwaga:** alerty Dependabota włącza się w ustawieniach repozytorium (poza rolloutem).

### Q14: jedna maszyna tury i typy kontraktu w schemacie (engine, schema, server)

**Dziś:** obsługa rzutki (parsowanie, bust, zamknięcie, trzecia rzutka, pętla odtwarzania) jest skopiowana w `x01-match.ts`, `casual-match.ts` i `solo-501.ts`. `createX01Match` nie sprawdza `firstPlayerIndex` (wartość 2 daje `NaN` w wynikach bez błędu), a `createCasualMatch` sprawdza. `StartingScore` jest zdefiniowany w silniku, w schemacie i trzeci raz we froncie; `CheckoutRule` tylko w silniku, choć jest zapisywany; `ApplyResult` mieszka w module 1v1 z domyślnym typem 1v1. `legsToWin` przyjmuje dowolną liczbę dodatnią.

**Zmiana:**
1. Wspólny rdzeń tury X01 (jedna funkcja przyjmująca stan tury, trafienie i zasady, zwracająca wynik: tura otwarta, koniec tury, bust, zamknięcie); trzy tryby zostawiają sobie rotację, legi i miejsca. Publiczne API silnika i zdarzenia bez zmian.
2. `createX01Match` odrzuca `firstPlayerIndex` inne niż 0 i 1 oraz `legsToWin` spoza wartości wynikających z best of 1, 3, 5.
3. `StartingScore`, lista wartości, `CheckoutRule` i `DARTS_PER_TURN` eksportowane z `packages/schema`; silnik i serwer importują stamtąd. `ApplyResult` w osobnym module bez domyślnego typu.
4. Powtórzone definicje w schemacie (`PlayerId`, zakres celu końcówki, blok danych gracza w odpowiedziach statystyk) w jednym miejscu.

**Testy:** wszystkie obecne testy silnika przechodzą bez zmian w oczekiwaniach; nowe: błędny `firstPlayerIndex`, błędne `legsToWin`; test, że odtworzenie logu daje ten sam stan co przed zmianą dla zapisanych przykładów z trzech trybów.

**Poza zakresem:** zmiana zasad X01, semantyka korekty wcześniejszej rzutki (etap kamery), unia trybów w `MatchSnapshot`.

### Q15: testy frontu sprawdzają zachowanie, nie klasy (web)

**Zależy od:** Q11 (sprawdzenia układu w przeglądarce), Q12.

**Dziś:** 156 asercji sprawdza nazwy klas Tailwinda (np. `lg:col-start-1`, `lg:text-[clamp(72px,28cqi,128px)]`), a 238 linii chodzi po strukturze DOM. Każda zmiana wyglądu psuje testy, choć zachowanie się nie zmienia.

**Zmiana:**
1. Asercje na klasach i na kształcie DOM zastąpione asercjami po roli, nazwie i tekście tam, gdzie test sprawdza zachowanie.
2. Asercje, które pilnowały układu (klawiatura nie skacze, karta nie wychodzi poza ekran, brak poziomego przewijania), przeniesione do sprawdzeń w przeglądarce z Q11 albo usunięte, gdy Q11 już to pokrywa. Lista przeniesionych i usuniętych asercji w opisie PR.
3. Zostają asercje na klasach, które niosą znaczenie testowane inaczej się nie da (np. klasa koloru awatara z tokenu); każda z komentarzem dlaczego.
4. Liczba testów zachowania nie spada: każdy usunięty przypadek ma wskazany zamiennik.

**Testy:** pełny zestaw i e2e zielone; w opisie PR liczba asercji na klasach przed i po (cel: poniżej 20).

---

## P3: porządki

### Q16: dokumentacja zgodna z kodem, martwy kod, mniejsza paczka (web, docs)

**Zmiana:**
1. `README.md`: sekcja wyglądu opisuje „Scenę” zamiast motywu A; liczba i nazwy jobów CI zgodne z `ci.yml`; etapy zgodne z `CLAUDE.md`; bez wzmianek o GitHub Pages.
2. `packages/web/README.md`: opis ekranów rozbity na sekcje z listami (jeden ekran, jedna sekcja), bez akapitów ponad około 600 znaków; to samo dla najdłuższych akapitów w `packages/server/README.md`.
3. Usunięty nieużywany kod: rozmiar `compact` i prop `rotate` w `Scoreboard` (widok TV jest odłożony; wróci z tym widokiem), nieaktywne przyciski „Dodaj gracza” jako elementy nieinteraktywne.
4. `DARTS_PER_TURN` we froncie importowany ze schematu (cztery lokalne definicje znikają); teksty jednostek czasu z `game/leg-clock.ts` w `pl.ts`.
5. Podział paczki: ekrany statystyk, historii i ustawień ładowane przez `React.lazy`; tylko podzbiory fontów `latin` i `latin-ext`. Rozmiary paczek przed i po w opisie PR.
6. `design/scena/tokens.css` generowany z `tokens.json` albo objęty testem zgodności tokenów. Uwaga: `design/scena/**` jest tylko do czytania, więc ta pozycja to test w `packages/web`, a rozbieżność zgłoszona w opisie PR.
7. Fokus w trybie wymuszonych kolorów: `@media (forced-colors: active)` z obrysem.

**Testy:** leniwe ładowanie ekranów (stan ładowania i błąd ładowania paczki); e2e zielone.

### Q17: narzędzia jakości w CI (CI, konfiguracja)

**Ostatni PR etapu**, bo formatuje całe repo.

**Zmiana:**
1. Prettier z konfiguracją zgodną z obecnym stylem (pojedyncze cudzysłowy, szerokość linii jak w kodzie); jednorazowe sformatowanie repo w osobnym commicie; krok CI `format:check`; `.git-blame-ignore-revs` z commitem formatowania.
2. ESLint: `eslint-plugin-react-hooks` i reguły z informacją o typach (`recommendedTypeChecked` bez `unbound-method`); poprawki zgłoszeń w kodzie, bez wyłączania reguł komentarzami.
3. Pokrycie testami: `@vitest/coverage-v8` z progami dla `packages/engine` i `packages/schema` ustawionymi na dzisiejszy poziom zaokrąglony w dół; raport w CI.
4. Testy frontu: środowisko `node` domyślnie, `jsdom` tylko dla testów komponentów; czas testów frontu przed i po w opisie PR.
5. `CLAUDE.md` jest tylko do czytania: PR podaje w opisie zdania do poprawy (liczba checków CI, nowe komendy), a autor je wpisuje.

**Testy:** wszystkie joby zielone; czas CI przed i po w opisie PR.

## Poza zakresem etapu 4

Kontrakt weryfikacji rzutki i odtwarzanie po korekcie (etap kamery, gałąź `feat/camera`), nowe funkcje dla graczy, zmiana wyglądu, przeniesienie budowania frontu do CI, konta użytkowników.
