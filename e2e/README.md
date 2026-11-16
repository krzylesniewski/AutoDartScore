# @autoscore/e2e

Testy end-to-end w Playwright, tylko Chromium. Uruchamiają aplikację tak jak produkcja: front zbudowany jak w `deploy/deploy.sh` (`VITE_BASE=/`, bezwzględne `VITE_API_URL`), serwer przez `pnpm --filter @autoscore/server start` z hasłem, frontem serwowanym przez `AUTOSCORE_WEB_DIR` i pustą bazą w katalogu tymczasowym.

Zestaw obejmuje:

- `game.spec.ts`: 401 bez tokenu, logowanie, dwóch nowych graczy, mecz 1v1 301 wpisany klawiszami na ekranie i skrótami, Cofnij, zamknięcie lega na D14, ekran końca meczu i statystyki zwycięzcy. Drugie okno śledzi grę na żywo przez WebSocket.
- `layout.spec.ts`: układ, którego testy jednostkowe w jsdom nie widzą. Przy 375×812, 768×1024, 1280×800 i 1920×1080:
  - Brak poziomego przewijania na ekranach nowej gry, statystyk, karty gracza, historii, ustawień, końca meczu, treningu końcówek oraz przebiegu Solo 501 i Free run.
  - Ustawienia otwierają się z nawigacji, a statusy kamery i głosu w pasku są tam czytelne, nie tylko dla czytnika ekranu. Tak samo tytuł „Nowa gra”. Karty układu klawiatury w ustawieniach mają co najmniej 44 px wysokości.
  - „Rewanż” i „Nowy mecz” na końcu meczu oraz „Udało się” i „Nie udało się” w treningu końcówek mieszczą się w oknie i da się je kliknąć. Nakładki ze statusem na końcu meczu i w grze przepuszczają kliknięcia.
  - Klawiatura mieści się w oknie i nie przesuwa się. W kole sprawdzają to rzutka, zmiana rzucającego, trasa zamknięcia, bust i komunikat o zerwanym połączeniu, a w siatce rzutka. W obu układach także przejście tury między graczem z najczęstszymi trafieniami a graczem bez nich.
  - Przy trasie zamknięcia i po buście (koło) pasek wyników nie zmienia wysokości, a baner „Bust” stoi nad klawiaturą i jej nie zasłania. Krótką etykietę karty zamknięcia widać poniżej xl, a etykietę z liczbą rzutek od xl.
  - W kole poniżej lg dok trzyma klawiaturę przy dolnej krawędzi okna, także po przewinięciu treści do końca. Pełne słowo mnożnika („Single”) widać od lg, a poniżej nie. Cofnij ma co najmniej 44 px wysokości.
  - Klawisze najczęstszych trafień i pola koloru w oknie nowego gracza mają co najmniej 44 px. Pola koloru mieszczą się w poziomie w panelu okna.
  - „Porzuć mecz” jest ukryte, dopóki nie otworzy się „Menu gry”, a potem da się je kliknąć nad klawiaturą. W oknie przeglądarki wysokim na 400 px panel okna porzucenia mieści się w nim i przewija się sam, a pierścienie w jego rogu nie łapią kliknięć.

  Poniżej lg „Tury” zamienia pasek wyników, panel tury, kartę zamknięcia i statystyki meczu na historię tur bez ruszania klawiatury, a bieżąca tura jest widoczna. Od lg historia tur stoi stale w lewej kolumnie, która przewija się sama i kończy się w oknie, tabela historii zaczyna się od bieżącej tury, a „Menu gry” znika, gdy nie ma w nim akcji. Przebieg Solo 501 i Free run zaczyna się od bieżącej tury przy każdej szerokości.
- `forced-colors.spec.ts`: w trybie wymuszonych kolorów (wysoki kontrast) przycisk „Zaloguj” z fokusem przeniesionym klawiszem Tab z pola hasła ma ciągły obrys 2 px, bo ten tryb usuwa pierścień fokusu rysowany cieniem.

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
