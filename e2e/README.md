# @autoscore/e2e

Testy end-to-end w Playwright, tylko Chromium. Uruchamiają aplikację tak jak produkcja: front zbudowany jak w `deploy/deploy.sh` (`VITE_BASE=/`, bezwzględne `VITE_API_URL`), serwer przez `pnpm --filter @autoscore/server start` z hasłem, frontem serwowanym przez `AUTOSCORE_WEB_DIR` i pustą bazą w katalogu tymczasowym.

Zestaw obejmuje:

- `game.spec.ts`: 401 bez tokenu, logowanie, dwóch nowych graczy, mecz 1v1 301 wpisany klawiszami na ekranie i skrótami, Cofnij, zamknięcie lega na D14, ekran końca meczu i statystyki zwycięzcy. Drugie okno śledzi grę na żywo przez WebSocket.
- `layout.spec.ts`: układ, którego testy jednostkowe w jsdom nie widzą. Przy 375×812, 768×1024, 1280×800 i 1920×1080:
  - Brak poziomego przewijania na ekranach nowej gry, statystyk, karty gracza, historii, ustawień (otwartych z nawigacji, z widocznymi statusami kamery i głosu), końca meczu, treningu końcówek i przebiegu Solo 501.
  - „Rewanż” i „Nowy mecz” na końcu meczu oraz „Udało się” i „Nie udało się” w treningu końcówek mieszczą się w oknie i da się je kliknąć.
  - Klawiatura (koło i siatka) mieści się w oknie i nie przesuwa się po rzutce, po zmianie rzucającego, przy trasie zamknięcia, po buście, przy komunikacie o zerwanym połączeniu ani przy zmianie rzucającego z najczęstszymi trafieniami na takiego, który ich nie ma. Baner „Bust” jej nie zasłania.
  - „Porzuć mecz” jest ukryte, dopóki nie otworzy się „Menu gry”, a potem da się je kliknąć nad klawiaturą.

  Poniżej lg „Tury” zamienia pasek wyników na historię tur bez ruszania klawiatury, a bieżąca tura jest widoczna. Od lg historia tur stoi stale w lewej kolumnie, która przewija się sama i kończy się w oknie, a „Menu gry” znika, gdy nie ma w nim akcji.

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
