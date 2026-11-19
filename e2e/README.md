# @autoscore/e2e

Testy end-to-end w Playwright, tylko Chromium. Uruchamiają aplikację tak jak produkcja: front zbudowany jak w `deploy/deploy.sh` (`VITE_BASE=/`, bezwzględne `VITE_API_URL`), serwer przez `pnpm --filter @autoscore/server start` z hasłem, frontem serwowanym przez `AUTOSCORE_WEB_DIR` i pustą bazą w katalogu tymczasowym.

Zestaw obejmuje:

- `game.spec.ts`: 401 bez tokenu, logowanie, dwóch nowych graczy, mecz 1v1 301 wpisany klawiszami na ekranie i skrótami, Cofnij, zamknięcie lega na D14, ekran końca meczu i statystyki zwycięzcy. Drugie okno śledzi grę na żywo przez WebSocket.
- `layout.spec.ts`: układ, którego testy jednostkowe w jsdom nie widzą. Przy 375×812, 768×1024, 1280×800 i 1920×1080:
  - Brak poziomego przewijania na ekranach nowej gry, kreatora turnieju, listy turniejów, statystyk, karty gracza, historii, ustawień, końca meczu, treningu końcówek oraz przebiegu Solo 501 i Free run.
  - W kreatorze turnieju (`#/tournaments/new`) przycisk „Rozpocznij turniej” mieści się w oknie, a „Start gry” go nie zastępuje. Na `#/tournaments` widać link „Nowy turniej”. `layout.spec.ts` tylko otwiera te strony i nie tworzy turnieju, bo trwający turniej we wspólnej bazie przekierowałby tam `#/tournaments`. Specy turniejów (`tournament*.spec.ts`) tworzą własne turnieje, a na końcu je kończą i archiwizują.
  - Pięć linków głównej nawigacji stoi w jednym wierszu (ta sama górna krawędź), każdy ma co najmniej 44 px wysokości i mieści się w oknie.
  - Ustawienia otwierają się z nawigacji, a statusy kamery i głosu w pasku są tam czytelne, nie tylko dla czytnika ekranu. Tak samo tytuł „Nowa gra”. Karty układu klawiatury w ustawieniach mają co najmniej 44 px wysokości.
  - „Rewanż” i „Nowy mecz” na końcu meczu oraz „Udało się” i „Nie udało się” w treningu końcówek mieszczą się w oknie i da się je kliknąć. Nakładki ze statusem na końcu meczu i w grze przepuszczają kliknięcia.
  - Klawiatura mieści się w oknie i nie przesuwa się. W kole sprawdzają to rzutka, zmiana rzucającego, trasa zamknięcia, bust i komunikat o zerwanym połączeniu, a w siatce rzutka. W obu układach także przejście tury między graczem z najczęstszymi trafieniami a graczem bez nich.
  - Przy trasie zamknięcia i po buście (koło) pasek wyników nie zmienia wysokości, a baner „Bust” stoi nad klawiaturą i jej nie zasłania. Krótką etykietę karty zamknięcia widać poniżej xl, a etykietę z liczbą rzutek od xl.
  - W kole poniżej lg dok trzyma klawiaturę przy dolnej krawędzi okna, także po przewinięciu treści do końca. Pełne słowo mnożnika („Single”) widać od lg, a poniżej nie. Cofnij ma co najmniej 44 px wysokości.
  - Klawisze najczęstszych trafień i pola koloru w oknie nowego gracza mają co najmniej 44 px. Pola koloru mieszczą się w poziomie w panelu okna.
  - „Porzuć mecz” jest ukryte, dopóki nie otworzy się „Menu gry”, a potem da się je kliknąć nad klawiaturą. W oknie przeglądarki wysokim na 400 px panel okna porzucenia mieści się w nim i przewija się sam, a pierścienie w jego rogu nie łapią kliknięć.

  Osobny blok sprawdza kartę zamknięcia od lg przy 1024×768, 1280×800, 1440×810, 1920×1080 i 2560×1250:
  - W meczu 1v1 z kołem karta zaczyna się 18 px pod klawiaturą, kończy 12 px nad dołem main i ma szerokość klawiatury. Klawiatura ma to samo pudełko przy niewidocznej karcie, przy trasie „T20 T20 Bull” i przy trasie „Bull”, a niewidoczna karta ma pudełko widocznej. Ani dokument, ani main nie przewija się w pionie ani w poziomie.
  - Przy 1440×810 nie ma wolnego miejsca, więc karta ma 80 px, rzutki 52 px, a etykieta 19 px. Przy 1024×768 i 1280×800 karta ma ponad 100 px.
  - Trzy rzutki „T20 T20 Bull” stoją w jednym rzędzie wewnątrz karty i nie nachodzą na widoczną etykietę ani na znaczek Enter.
  - Tak samo karta wypełnia miejsce w siatce i w Solo 501 przy 1920×1080 oraz w zabawie z 4 graczami przy 2560×1250.

  Poniżej lg „Tury” zamienia pasek wyników, panel tury, kartę zamknięcia i statystyki meczu na historię tur bez ruszania klawiatury, a bieżąca tura jest widoczna. Od lg historia tur stoi stale w lewej kolumnie, która przewija się sama i kończy się w oknie, tabela historii zaczyna się od bieżącej tury, a „Menu gry” znika, gdy nie ma w nim akcji. Przebieg Solo 501 i Free run zaczyna się od bieżącej tury przy każdej szerokości.
- `tournament-league.spec.ts`: liga trzech nowych graczy od kreatora do archiwum, przy 1280×800. W `#/tournaments/new` wybiera „Liga”, trzech graczy, „301” i długość meczu 1, sprawdza „Razem meczów” 3 w planie turnieju i klika „Rozpocznij turniej”. Trzy mecze startują z „Zagraj mecz”, rzutki przez API dają wygraną graczowi wyżej w ustalonej kolejności, a „Wróć do turnieju” pokazuje „Liga · 1 z 3 meczów” i „2 z 3”. Po trzecim meczu nagłówek ma „Turniej zakończony”, tabela kolejność A, B, C z punktami 4, 2 i 0, `placements` z API te same miejsca, a zakładka „Statystyki” podium z A na czele. `#/tournaments` nie przekierowuje i pokazuje „Zwycięzca: A”, a okno „Zarchiwizować turniej?” usuwa turniej z listy.
- `tournament-playoff.spec.ts`: grupa czterech graczy z play-off dla czterech, meczem o 3. miejsce i meczami do jednego lega, utworzona przez API z włączonym udostępnianiem (10 meczów). Grupa idzie przez API, wygrywa gracz wyżej w kolejności A, B, C, D. Przy 1280×800:
  - „Popraw wynik” zmienia mecz B–C na 1:0 dla C. Obie komórki B–C w tabeli krzyżowej mają „popr.”, tabela ma kolejność A, C, B, D, a półfinały to A–D i C–B.
  - Po starcie pierwszego półfinału kolejna korekta grupy pokazuje w oknie komunikat o meczu zależnym, a `eventSeq` turnieju się nie zmienia.
  - „Wycofaj gracza” w trakcie tego półfinału wycofuje D: drabinka pokazuje „Mecz #7 · walkower”, tabela grupy „wycofany”. Po drugim półfinale mecz o 3. miejsce jest walkowerem dla B.
  - Widok TV z trwającym finałem przy 1280×720 i 1920×1080 ma „Trwający mecz” z „Rzuca” w oknie, bez przewijania strony, z „wo” przy pierwszym półfinale na liście play-off i bez karty „Śledź turniej na telefonie”. Przy 390×844 nie przewija się w poziomie.
  - Po finale „Klasyfikacja końcowa” i `placements` mają A, C, B, D. Przy 390×844, 768×1024, 1280×800 i 1920×1080 zakładki „Play-off” i „Grupa” pokazują drabinkę i tabelę grupy bez poziomego przewijania strony.
  - Nowy kontekst przeglądarki bez tokenu otwiera `#/t/:id`: nazwa, „Zakończony”, podium z A, bez nawigacji i bez „Zaloguj”. Link finału w liście „Mecze” otwiera „Statystyki meczu”. Pod `127.0.0.1` okno „Udostępnij turniej” pokazuje uwagę o adresie w sieci zamiast linku i kodu QR. Po wyłączeniu udostępniania publiczna strona pokazuje „Ten turniej nie istnieje albo nie jest udostępniony.”, a `GET /public/tournaments/:id` daje to samo 404 co nieznane id.
- `tournament.spec.ts`: liga trzech nowych graczy do jednego wygranego lega, utworzona przez API. Przy 390×844, 768×1024, 1280×800 i 1920×1080 ekran turnieju nie przewija się w poziomie, a „Zagraj mecz” mieści się w oknie. Przy 1280×800 „Zagraj mecz” otwiera mecz z etykietą „Liga, mecz 1” w nagłówku, rzutki przez API kończą go 1:0, „Wróć do turnieju” wraca na ekran turnieju z wynikiem „1–0” w tabeli i stanem „Liga · 1 z 3 meczów”. Widok TV `#/tournaments/:id/tv` przy 1280×720 bez trwającego meczu pokazuje nazwę turnieju i „Następny mecz” bez przewijania strony w poziomie i w pionie. Potem, przy otwartej stronie, następny mecz startuje przez API, a bez przeładowania pojawia się region „Trwający mecz” z „Rzuca”, cały w oknie i bez przewijania strony. Przy 1920×1080 widok trwającego meczu przechodzi te same sprawdzenia, a przy 390×844 nie przewija się w poziomie. Trzy pudła przez API pokazują bez przeładowania „ostatnia tura 0”. Serwer testów działa pod `127.0.0.1` z wyłączonym udostępnianiem, więc kodu QR tam nie ma. Po testach pozostałe mecze kończą się przez API, a turniej idzie do archiwum.
- `forced-colors.spec.ts`: w trybie wymuszonych kolorów (wysoki kontrast) przycisk „Zaloguj” z fokusem przeniesionym klawiszem Tab z pola hasła ma ciągły obrys 2 px, bo ten tryb usuwa pierścień fokusu rysowany cieniem.

Każdy spec turnieju w `afterAll` kończy i archiwizuje swój turniej, także gdy test padnie w połowie. Dzięki temu trwający turniej nie zostaje we wspólnej bazie ani dla następnego pliku, ani dla powtórzenia z `--repeat-each`.

## Uruchomienie

Raz, przeglądarka dla Playwright:

```sh
pnpm --filter @autoscore/e2e exec playwright install chromium
```

Potem z katalogu głównego repozytorium:

```sh
pnpm e2e                    # cały zestaw
pnpm e2e --repeat-each=3    # każdy test trzy razy, bez ponowień
```

`pnpm test` nie uruchamia tych testów. CI uruchamia je w osobnym jobie `e2e`.

Serwer słucha na `127.0.0.1:3210`, więc ten port musi być wolny. Port i zmienne środowiskowe serwera są tylko w `playwright.config.ts`.

## Wyniki

Zbudowany front (`dist/web`) i wyniki testów (`dist/test-results`) trafiają do `e2e/dist/`, pomijanego przez git i ESLint. Przy błędzie szczegóły i ślad (`trace.zip`, otwiera go `pnpm --filter @autoscore/e2e exec playwright show-trace <plik>`) są w `e2e/dist/test-results`, a w CI w artefakcie `e2e-test-results`.
