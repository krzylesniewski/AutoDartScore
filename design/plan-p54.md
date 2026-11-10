# P54: dokumentacja komponentów z testów (describe-me)

Prośba autora z 2026-10-28: dodać bibliotekę [describe-me](https://www.npmjs.com/package/describe-me) w osobnym PR-ze. To nie jest feedback graczy, więc bez wpisu w `feedback-graczy.md`. Dokumentacja biblioteki: https://grzehub.github.io/describe-me/ (Getting started, Installation, Viewer, Limitations).

## P54: describe-me w `packages/web` (web, tylko narzędzia deweloperskie)

**Co to jest:** describe-me zapisuje DOM po każdym kroku testu Vitesta i pokazuje wynik jako katalog komponentów (bloki `describe` w pasku bocznym, każde `it` jako historia, kroki jako klatki). Zakładka Foundations pokazuje tokeny motywu (zmienne CSS, Tailwind 4). Pakiety: `describe-me` (przeglądarka i CLI), `@describe-me/vitest` (plugin, setup, reporter), `@describe-me/react` (`render`, który zapisuje klatki).

**Dziś:** testy frontu biegną w Vitest 5 w jsdom (`packages/web/vite.config.ts`, `setupFiles: ['./src/test-setup.ts']`), komponenty renderowane przez `@testing-library/react`. Zgodność sprawdzona 2026-10-28 dla wersji 0.12.1: React 18/19, Vitest 4/5, Vite 6-8, TypeScript 5/6.

**Zmiana:**
1. **Zależności:** w `packages/web` jako `devDependencies` `describe-me`, `@describe-me/vitest` i `@describe-me/react`, wszystkie w tej samej, przypiętej dokładnie wersji (bez `^`, biblioteka wymaga wersji „lockstep”). Brakujące wymagane peer dependencies dla trybu jsdom (np. `@testing-library/user-event`) dodać też jako `devDependencies`. Bez trybu przeglądarkowego Vitesta (`vitest-browser-react` niepotrzebny, jeśli pnpm na to pozwala bez błędu instalacji).
2. **Konfiguracja:** plugin `describeMe()` w `packages/web/vite.config.ts` obok obecnych pluginów, środowisko testów zostaje `jsdom`. Plugin nie może zmieniać `vite build` ani `vite dev` aplikacji (sprawdzić, że `pnpm --filter @autoscore/web build` daje ten sam wynik i nie dociąga nic do bundla). Dane generowane przy testach (np. `.describe-me/`) i wynik `build` w `.gitignore`.
3. **Skrypty:** w `packages/web/package.json` `docs:dev` (`describe-me dev`) i `docs:build` (`describe-me build --out <katalog w .gitignore>`); w głównym `package.json` skrót `pnpm docs` uruchamiający `docs:dev` frontu. `pnpm test` dalej przechodzi w CI bez dodatkowych kroków i bez wyraźnego spowolnienia (podać czas `pnpm --filter @autoscore/web test` przed i po w opisie PR-a).
4. **Pierwsze historie:** przenieść na `render` z `@describe-me/react` testy trzech komponentów, bez zmiany ich asercji: `Scoreboard` (pasek wyników), `Keypad` (klawiatura ręcznego wpisu) i `MatchEndView` (podsumowanie). Pozostałe testy bez zmian. Nazwy `describe`/`it` mają czytelnie opisywać stany, bo stają się nazwami w katalogu.
5. **Motyw:** Foundations ma pokazywać tokeny z `design/theme.css` (przez `src/theme.css`, który już ładuje front). Jeśli wymaga to załadowania CSS w setupie testów, zrobić to tak, żeby nie zmieniało wyników istniejących testów. Jeśli Foundations nie działa z naszym motywem, opisać to w PR-ze zamiast obchodzić.
6. **README:** krótka sekcja w `packages/web/README.md`: do czego służy, `pnpm docs`, `docs:build`, że wynik jest lokalny i nie jest publikowany.

**Testy i weryfikacja:**
- `pnpm test`, `pnpm typecheck`, `pnpm lint` i build frontu przechodzą;
- po `pnpm --filter @autoscore/web test` i `pnpm docs` przeglądarka pokazuje trzy komponenty z punktu 4 z klatkami; zrzut ekranu katalogu i zakładki Foundations w opisie PR-a (jeśli wgranie obrazków nie działa, PR to opisuje);
- lockfile zmienia się tylko o nowe pakiety i ich zależności.

**Uwaga o ryzyku:** biblioteka jest nowa (pierwsza wersja 2026-09-21, jeden autor, status „early”), dlatego tylko jako `devDependencies`, przypięta wersja, bez wpływu na bundle aplikacji i bez publikowania wygenerowanej strony.

**Poza zakresem:** przeniesienie pozostałych testów, tryb przeglądarkowy Vitesta, publikacja katalogu (GitHub Pages, `build --live`), nowy job w CI, zmiany w komponentach.
