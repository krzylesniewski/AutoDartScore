# @autoscore/e2e

Testy end-to-end w Playwright, tylko Chromium. Uruchamiają aplikację tak jak produkcja: front zbudowany jak w `deploy/deploy.sh` (`VITE_BASE=/`, bezwzględne `VITE_API_URL`), serwer przez `pnpm --filter @autoscore/server start` z hasłem, frontem serwowanym przez `AUTOSCORE_WEB_DIR` i pustą bazą w katalogu tymczasowym.

Zestaw obejmuje:

- `game.spec.ts`: 401 bez tokenu, logowanie, dwóch nowych graczy, mecz 1v1 301 wpisany klawiszami na ekranie i skrótami, Cofnij, zamknięcie lega na D14, ekran końca meczu i statystyki zwycięzcy. Drugie okno śledzi grę na żywo przez WebSocket.
- `layout.spec.ts`: przy 375×812, 768×1024, 1280×800 i 1920×1080 brak poziomego przewijania na ekranach nowej gry, statystyk i gry. Klawiatura mieści się w oknie i nie przesuwa się po rzutce ani po zmianie rzucającego.

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
