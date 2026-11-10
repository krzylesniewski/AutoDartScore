# Etap 3: redesign wyglądu w kierunku „Scena” (rollout `autoscore-etap3`)

Decyzja autora z 2026-11-10: redesign jest nowym etapem 3 (dwie kamery to teraz etap 4, mini PC 5, online 6). Najpierw powstają design system i makiety, potem plan PR-ów i rollout. Wiążą `CLAUDE.md` (sekcje „Front”, „Typy gier”, „Konwencje”) i wspólne zasady RWD z `design/rwd.md`. Teksty po polsku w `i18n/pl.ts`, typy i DTO tylko z `packages/schema`, kolor nigdy sam nie niesie znaczenia, klawiatura na ekranie gry nie skacze (P31).

## Źródła

- Kanwa kierunków: https://claude.ai/artifact/Uw59Q2VKaZLe1R3CWH4Haq („AUTO Score: kierunki wyglądu”).
  - **Kierunek bazowy:** „1. Scena: światło nad tarczą” (`Scena.dc.html`, strona „Ekran gry: kierunki”).
  - **Punkt wyjścia dla pozostałych ekranów:** strona „Wszystkie ekrany (Scena+)”: gra, nowa gra, podsumowanie, historia, statystyki.
  - **Elementy z innych kierunków:** pasek progresu i informacje z „8. Dashboard” (`Kierunek8.dc.html`).
- Zrzuty obecnej aplikacji („przed”): `design/redesign/*.png` z 2026-10-28. Przed makietami warto je odświeżyć po P55-P57 (większe zakończenie, siatka wykresów, czas legów).
- Obecny motyw A: `design/theme.css`, makiety `design/mockups/theme-a-*`.

## Decyzje (2026-11-10)

- **Zakres:** odświeżenie w kierunku „Scena” plus elementy z innych kierunków. Bez nowych funkcji poza informacjami na ekranie gry (niżej).
- **Pasek progresu (z „8. Dashboard”):** cienki pasek (ok. 6 px, zaokrąglony) przy każdym graczu, między dużym wynikiem a linią statystyk. Pokazuje drogę od wyniku startowego do zera (zbite / startowe). Rzucający ma pasek w akcencie, pozostali stonowany. Pasek ma `aria-label` („Zostało 170 z 301 punktów”), więc nie niesie znaczenia samym kolorem. Bez paska w Free run (brak wyniku startowego).
- **Nowe informacje na ekranie gry:**
  - **zbite punkty:** przy wyniku rzucającego „▼ 131 w 2 turach” (zbite w tym legu i liczba tur), u pozostałych „▼ 60” (ostatnia tura);
  - **mini statystyki lega:** „Najwyższa tura”, „Rzutek w legu”, „Busty”;
  - **historia tur w legu:** tabela „Tura / gracz” z wynikiem po turze i punktami w turze, np. „241 (60)”; bust oznaczony ikoną i tekstem.
- **Narzędzie:** najpierw design system jako Artifact (typ Design System), potem makiety wszystkich ekranów zbudowane z niego na kanwie.
- **Gałąź:** jak w etapie 2. Cały kod etapu 3 powstaje na gałęzi integracyjnej **`feat/redesign`** (własny worktree), a PR-y rolloutu `autoscore-etap3` celują w nią. Do `main` kod wchodzi raz na kamień milowy, przez PR, który otwiera i scala autor. Dzięki temu produkcja nie dostaje pół starego, pół nowego wyglądu.

## Decyzje przed startem rolloutu

1. **Kolejność etapów (rozstrzygnięte 2026-11-10):** etap 3 idzie równolegle z etapem 2, w osobnym rolloucie `autoscore-etap3`; wyjątek zapisany w `CLAUDE.md`. Konflikty dotyczą głównie `packages/web`: panel rzutki `pending` z C5 i ekran kalibracji z C6 też trzeba będzie przenieść na nowy wygląd.
2. **Paleta (rozstrzygnięte 2026-11-10):** bazowa „Scena”: ciepła czerń, krem, czerwień tarczy.
3. **Karty (rozstrzygnięte 2026-11-10):** zaokrąglone jak w „Scenie” (18 px karty, 22 px panele), cienie i półprzezroczyste powierzchnie. Po K1 opis motywu w `CLAUDE.md` zmienia się z „kanciastych kart” motywu A na „Scena”.
4. **Zakres makiet (rozstrzygnięte 2026-11-10): wszystkie ekrany.** Oprócz ekranów ze „Scena+” makiety obejmują: grę 3-4 graczy (zabawa), trening (Free run, Solo 501, „Końcówki”), ustawienia, logowanie, dialogi (nowy gracz, porzucenie), rzutkę `pending` z kamery i telefon 390 px. Makieta widoku TV powstała, ale widok jest odłożony na później (niżej, „Poza zakresem”).
5. **Dane do nowych informacji:** snapshot (`MatchSnapshot` w `packages/schema/src/match-api.ts`) ma tylko bieżącą turę (`currentDarts`), więc historia tur, zbite punkty i statystyki lega wymagają nowego pola w snapshocie liczonego w serwerze przez odtworzenie zdarzeń (zasada: statystyki z rzutek, nie z liczników). Rozstrzygnięte 2026-11-10: jedno pole `legTurns` w snapshocie (tury bieżącego lega: gracz, rzutki, wynik po turze, bust), liczone w serwerze z odtworzenia zdarzeń; front liczy z niego zbite punkty, najwyższą turę, liczbę rzutek i busty.

## Kroki

| Krok | Co | Wynik |
|---|---|---|
| **D1** | Design system „AUTO Score: Scena”: tokeny nazwane jak w `design/theme.css`, 15 komponentów, kontrast sprawdzony dla każdej pary. | https://claude.ai/artifact/LqA3gyNJgsZU2ceAtEzuGy, kopia w repo: `design/scena/` |
| **D2** | Makiety 20 ekranów na kanwie (strona „Etap 3: Scena”) przy 1600×900 i 390×844. | https://claude.ai/artifact/Uw59Q2VKaZLe1R3CWH4Haq, źródła w repo: `design/mockups/scena/` |
| **D3** | Akceptacja autora 2026-11-10 („podoba mi się”), z uwagami niżej. Zrzutów PNG nie eksportujemy: źródła makiet są w repo, a każdy PR dokłada zrzuty swoich ekranów. | zrobione |
| **R** | Plan PR-ów R1-R11 (niżej), manifest `rollout/etap3/manifest.yaml`, gałąź `feat/redesign` z CI na push, scalanie automatyczne do `feat/redesign`. | rollout `autoscore-etap3` |

## Kamienie milowe

| Kamień | PR-y | Co działa po scaleniu do `main` |
|---|---|---|
| **K1: nowy wygląd** | R1-R8 | cała aplikacja w kierunku „Scena” z paskiem progresu, funkcje bez zmian |
| **K2: informacje o legu** | R9-R10 | zbite punkty, mini statystyki lega i historia tur na żywo |

Do `main` każdy kamień wchodzi PR-em `feat/redesign` → `main`, który otwiera i scala autor. Rollout scala PR-y automatycznie (`policy.merge: auto`) tylko do `feat/redesign`.

## Uwagi autora do makiet (2026-11-10)

- Historia: gra w trakcie bez zielonej obwódki; stan niesie odznaka „W trakcie” z kropką.
- Podsumowanie: puchar zostaje, promienie z linii wokół niego nie.
- Wykresy: dokładność z P56 zostaje (punkt co rzutkę, siatka co 3 lotki, co 50/100 punktów, podpisy osi). Redesign zmienia tylko wygląd wykresów (kolory, fonty, tło), nie ich logikę w `score-progress-chart.ts` i `form-chart.ts`.
- Skróty klawiszowe: oznaczenia na klawiszach zostają, jak dziś (`SHORTCUT_BADGE`, od `lg`): S/D/T na mnożniku, B na 25, Shift+B na Bull, Spacja na Miss, Backspace na Cofnij, Enter na karcie zamknięcia; skróty w treningu „Końcówki” też. Same skróty (`use-keypad-shortcuts.ts`, `keypad-shortcut.ts`) bez zmian.

## Ustalenia przyjęte z akceptacji makiet (2026-11-10)

Autor zaakceptował makiety w całości; tam, gdzie makiety różnią się od dzisiejszej aplikacji, obowiązują makiety:
- **Mnożnik:** od `lg` pełne nazwy „Single / Double / Treble”, poniżej `lg` „S / D / T” (jak w makietach tabletu i telefonu). Skróty S/D/T bez zmian.
- **„Nowa runda” i „Do weryfikacji”:** dziś wyłączone przyciski „Wkrótce”; na ekranie gry ich nie ma (makiety). Wracają, gdy dostaną działanie (etap kamery).
- **Koniec zabawy:** osobny widok podsumowania jak przy 1v1 (`E3PodsumowanieZabawa`), zamiast panelu na ekranie gry; te same dane (`MatchSummaryPanel`).
- **Historia i statystyki:** etykiety dni „DZIŚ / WCZORAJ” z godziną przy każdej grze; filtr typu gry z „Overall” oddzielonym przegródką.

## Zasady wspólne dla R1-R10

- **Źródła wyglądu:** `design/scena/README.md` (zasady), `design/scena/tokens.json` (wartości), `design/scena/components/bundle.css` i `components/*/README.md` (wzorce komponentów), makiety `design/mockups/scena/*.dc.html` (układ ekranów, patrz `design/mockups/scena/README.md`). Wartości bierz dokładnie stamtąd.
- **Tokeny:** jedyne źródło kolorów to `design/theme.css` (po R1 w wersji „Scena”). W kodzie żadnych kolorów, cieni ani gradientów wpisanych na sztywno: nowe wartości dochodzą jako tokeny w `design/theme.css` (i mapowanie w `packages/web/src/theme.css`), nie w komponentach.
- **Funkcje bez zmian (K1):** redesign nie zmienia logiki, danych z serwera, tekstów (poza tym, co plan wprost wymienia), skrótów klawiszowych ani testów zachowania. Testy, które sprawdzają klasy wyglądu, aktualizujesz razem ze zmianą; testy zachowania mają przechodzić bez zmian.
- **RWD:** zasady z `design/rwd.md` dalej wiążą (klawiatura nie skacze i nie wychodzi poza ekran, P31; brak poziomego przewijania; cele dotykowe ≥ 44 px).
- **Dostępność:** kolor nie niesie znaczenia sam; kontrast tekstu ≥ 4,5:1 (pary w `design/scena/tokens.json`); `focus-ring` na każdym elemencie interaktywnym; `prefers-reduced-motion` wyłącza animacje.
- **Zrzuty w PR:** każdy PR z frontem dokłada zrzuty swoich ekranów przy 375×812, 768×1024, 1280×800 i 1920×1080 (headless Chrome); jeśli wgranie obrazków nie działa, PR to opisuje i podaje pomiary.
- **Pliki tylko do czytania:** `design/scena/**`, `design/mockups/**`, `design/plan-etap3.md`, `CLAUDE.md`, `auto-score-dart-pomysly.md`, `rollout/**`.

## R1: tokeny „Scena”, tło sceny i elementy bazowe (web)

**Zmiana:**
1. `design/theme.css` w wersji „Scena”: wartości z `design/scena/tokens.json` (kolory, cienie, promienie, odstępy, przezroczystości). Tokeny o tych samych nazwach zmieniają wartość (`--color-bg`, `--color-surface`, `--color-border`, `--color-text-muted`…, `--radius-card` 18 px, `--radius-chip` 10 px), nowe dochodzą (`--color-bg-mid`, `--color-bg-glow`, `--color-surface-raised`, `--color-surface-soft`, `--color-surface-softer`, `--color-text-sub`, `--color-accent-hi`, `--color-accent-lo`, `--color-accent-glow`, `--color-route-chip`, `--color-progress-track`, `--color-gold`, `--color-silver`, `--color-bronze`, `--color-focus`, `--shadow-*`, `--radius-button`, `--radius-segment`, `--radius-panel`, `--radius-pill`, `--opacity-*`). Tokeny, których „Scena” nie używa (`--color-surface-header`, `--color-surface-button`, `--color-surface-active`, `--color-border-subtle`, `--color-border-strong`, `--border-width`), zostają jako aliasy nowych wartości (np. `--color-surface-button: var(--color-surface-soft)`), żeby ekrany nieprzeniesione jeszcze w R2-R8 nie zgubiły kolorów. Nagłówek pliku opisuje motyw „Scena” i odsyła do `design/scena/`.
2. `packages/web/src/theme.css`: mapowanie nowych tokenów na klasy Tailwind (kolory, cienie, promienie), fonty Barlow Condensed 500-900 i Barlow 400-600 z `@fontsource`.
3. **Tło sceny:** wspólny komponent (np. `Stage`) z gradientem `--color-bg-glow` → `--color-bg-mid` → `--color-bg` i pierścieniami tarczy w SVG (`aria-hidden`, `pointer-events: none`, `--opacity-rings`), użyty jako tło każdego ekranu w `App.tsx`; parametr położenia światła (ekran gry ok. 62%, listy ok. 20%). Bez przewijania i bez wpływu na układ.
4. **Elementy bazowe:** wspólne klasy albo małe komponenty dla karty (`Panel` główny i płaski), przycisku (główny, drugi, obrysowany, duży, ikonowy), przełącznika segmentowego i pierścienia fokusu, według `design/scena/components/*`. Istniejące przyciski i karty, które dziś biorą klasy z jednego miejsca, przechodzą na nie od razu; reszta ekranów w swoich PR-ach.

**Testy:** test komponentu tła (renderuje dekorację `aria-hidden`, nie przechwytuje kliknięć); testy klas, jeśli istnieją dla przycisków; `pnpm test`, `typecheck`, `lint`, build. Zrzuty ekranu startowego i ekranu gry (wygląd przejściowy jest w porządku).

**Poza zakresem:** układ ekranów, pasek wyników, klawiatura, wykresy (R2-R8).

## R2: górny pasek gry i nawigacja (web)

**Zależność:** R1.

**Zmiana:** `MatchHeader.tsx` (ekran gry: znak z czterech kół z `design/scena/assets/Logo/autoscore-mark.svg` jako inline SVG, „AUTO SCORE”, linia ustawień w `--color-text-sub`, „Leg N · kolejka N”, zegar lega w pigułce, przyciski ikonowe głosu, efektów i menu „Więcej” w kołach 44 px) i `AppNav.tsx` (pozostałe ekrany: zakładki z podkreśleniem 3 px w `--color-accent` z poświatą, nieaktywne w `--color-text-muted`, stan kamery i głosu w pigułkach z tekstem). Wzór: `design/scena/components/AppBar/`, makiety `E3Gra1v1` i `E3Historia`. Telefon: dwa rzędy jak w `E3NowaGraTelefon` i `E3GraTelefon`.

**Testy:** istniejące testy `AppNav` i `MatchHeader` przechodzą (teksty, `aria-current`, `aria-label` przycisków); zrzuty nagłówka gry i nawigacji.

## R3: pasek wyników z paskiem progresu (web)

**Zależność:** R1.

**Zmiana:**
1. `Scoreboard.tsx`, `Avatar.tsx`: karta rzucającego (gradient `--color-surface-raised` → `--color-surface`, `--shadow-card`, mała tarcza w rogu, awatar 58 px z podwójną obwódką i poświatą w kolorze gracza, imię, opis „rzuca teraz · rzutka N z 3”, kropki legów, duży wynik z cieniem tekstu, linia statystyk) i wiersze czekających (`--color-surface-softer`, wynik w `--color-text-sub`). Zabawa: ciaśniejsze wiersze, zakończeni na dole z odznaką miejsca (ikona i tekst). Kompaktowy rozmiar (`compact`) dostaje ten sam wygląd w mniejszej skali. Animacja zamiany wierszy bez zmian.
2. **Pasek progresu** (nowy komponent `ProgressBar`, wzór `design/scena/components/ProgressBar/`): 6 px przy każdym graczu, szerokość = (wynik startowy − pozostały) / wynik startowy ze snapshotu (`startingScore`, `players[].remaining`); u rzucającego `--color-accent`, u pozostałych `--color-text-muted`; `role="img"` i `aria-label` z `pl.ts` („Zostało 170 z 301 punktów”). Bez paska, gdy `startingScore` jest `null` (Free run). Czysta funkcja liczy szerokość (z testem).
3. Teksty: nowe etykiety w `i18n/pl.ts`.

**Testy:** funkcja szerokości (0%, połowa, 100%, Free run bez paska); test komponentu (`aria-label`, brak paska w Free run, kolor rzucającego przez klasę); istniejące testy `Scoreboard` przechodzą; zrzuty 1v1, zabawy 4 graczy i Solo 501.

**Poza zakresem:** zbite punkty, statystyki lega i historia tur (R10).

## R4: tura, karta zamknięcia i klawiatura (web)

**Zależność:** R3 (ten sam ekran gry, mniej konfliktów).

**Zmiana:**
1. `TurnPanel.tsx`: sloty rzutek w stanach z `design/scena/components/DartSlot/` (pusty, czekający z obwódką akcentu i poświatą, wpisany, do weryfikacji, jeśli istnieje), suma tury „w tej turze”, karta zamknięcia z gradientem akcentu, tarczą w rogu, etykietą `label-on-accent` (19 px pogrubione) i chipami trasy (`ROUTE_CHIP` z P55: rozmiar z P55 zostaje, chip dostaje tło `--color-route-chip` i promień `--radius-chip`; trasa w osobnych chipach na rzutkę jak w makiecie, jeśli mieści się bez łamania, inaczej jeden chip jak dziś). Podpowiedź „Kliknij albo Enter…” zostaje w `aria-label`, a na karcie w miejscu o kontraście ≥ 4,5:1 albo wcale. Znaczek „Enter” na chipie `--color-route-chip`.
2. `Keypad.tsx`, `KeypadKey.tsx`: klawisze tarczy z głębią (gradient, `--shadow-key`, wciśnięcie 1 px), 25 i Bull w środku koła (Bull z obwódką akcentu), kolumna mnożnika jak w makiecie (wybrany krem z `--color-text-inverse`), chipy „Najczęstsze”, duży Miss, „Reszta tury: Miss”, Cofnij. Układ siatki z Ustawień w tym samym stylu. Znaczki skrótów (`SHORTCUT_BADGE`) zostają na wszystkich klawiszach, które mają je dziś.
3. Mnożnik: od `lg` „Single / Double / Treble”, poniżej „S / D / T” (nowe teksty w `pl.ts`, skróty bez zmian).
4. Przyciski „Nowa runda” i „Do weryfikacji” (dziś wyłączone „Wkrótce”) znikają z ekranu gry; ich teksty w `pl.ts` mogą zostać, jeśli używa ich coś innego.
5. Ekran gry `GameScreen.tsx`: układ kolumn jak `E3Gra1v1` (lewa: pasek wyników i karta zamknięcia na dole z wolnym miejscem między nimi na R10; prawa: sloty, mnożnik, koło, kolumna Miss/Cofnij). Telefon jak `E3GraTelefon`.

**Testy:** istniejące testy `Keypad`, `TurnPanel`, `GameScreen` i skrótów przechodzą (zachowanie bez zmian); test, że znaczki skrótów są na S/D/T, 25, Bull, Miss, Cofnij i karcie zamknięcia; test etykiet mnożnika przy `lg` i poniżej (przez klasy `hidden lg:inline` albo podobnie); zrzuty ekranu gry 1v1, zabawy i Solo 501 przy wszystkich rozmiarach z całą klawiaturą widoczną i w tym samym miejscu przy każdym stanie (z trasą zamknięcia i bez).

## R5: nowa gra i dialogi gracza (web)

**Zależność:** R1.

**Zmiana:** `HomeScreen.tsx`, `NewGameForm.tsx`, `StartBar.tsx`, `UnfinishedGames.tsx`, `GameSetupSummary.tsx`, `NewPlayerDialog.tsx`, `EditPlayerDialog.tsx`, `ArchivePlayerDialog.tsx`, `AvatarColorPicker.tsx` według `E3NowaGra`, `E3NowaGraTelefon` i `E3DialogNowyGracz`: tytuł ekranu w stylu `title`, kafle typu gry z ikoną i znaczkiem wyboru, siatka graczy z kaflem „Nowy gracz”, przełączniki punktów i formatu, podsumowanie z „VS”, gry do dokończenia, pasek startu; dialogi na przyciemnionym tle z kartą `Panel`. Zachowanie (limity graczy, walidacja imienia, losowanie) bez zmian.

**Testy:** istniejące testy przechodzą; zrzuty kreatora (1v1, zabawa, trening) i dialogu nowego gracza z błędem.

## R6: koniec meczu i podsumowania (web)

**Zależność:** R1.

**Zmiana:** `MatchEndView.tsx`, `MatchSummaryPanel.tsx`, `MatchStatsPanel.tsx`, `RankingBoard.tsx`, `ScoreProgressChart.tsx`, `GameTime.tsx`, `LegDuration.tsx` według `E3Podsumowanie1v1`, `E3PodsumowanieZabawa`, `E3PodsumowanieTelefon`: karta zwycięzcy z pucharem i złotą poświatą (bez promieni z linii), wynik legów, „Czas gry” (z P57) jako pigułka z ikoną zegara, karty legów z czasem lega, tabela statystyk, przyciski końca gry. **Wykres zejścia:** tylko nowy wygląd (tło panelu, kolory linii graczy, wzory kresek, siatka w `--color-border`, podpisy w Barlow Condensed, znaczniki bustu z ikoną i tekstem); logika `score-progress-chart.ts` z P56 bez zmian (punkt co rzutkę, siatka i podpisy). Koniec zabawy jako osobny widok podsumowania jak przy 1v1 (ranking miejsc z pucharem, czas gry, wykres, statystyki), z tym samym źródłem danych.

**Testy:** istniejące testy `MatchEndView`, `MatchSummaryPanel`, `ScoreProgressChart` przechodzą (w tym siatka i podpisy z P56 oraz czas gry z P57); test widoku końca zabawy (ranking, czas gry, przyciski); zrzuty końca meczu 1v1 (best of 3) i zabawy.

## R7: historia, statystyki i karta gracza (web)

**Zależność:** R1.

**Zmiana:** `HistoryScreen.tsx`, `MatchHistoryList.tsx`, `StatsScreen.tsx`, `OverallBoard.tsx`, `PlayerProfile.tsx`, `FormChart.tsx`, `HeadToHeadPanel.tsx` według `E3Historia`, `E3Statystyki`, `E3Profil`: wiersze historii (`design/scena/components/HistoryRow/`, gra w trakcie bez zielonej obwódki), etykiety dni z godziną, filtr typu gry jako przełącznik segmentowy z „Overall” za przegródką, podium średniej (`design/scena/components/Podium/`) i tablice rekordów z remisami, karta gracza z kafelkami i wykresem formy (logika `form-chart.ts` z P56 bez zmian).

**Testy:** istniejące testy przechodzą; test podium (kolejność 2-1-3, numer miejsca w tekście, nie tylko kolorem); zrzuty historii, statystyk (Wszystkie i Overall) i karty gracza.

## R8: trening, ustawienia, logowanie i komunikaty (web)

**Zależność:** R4 (klawiatura i karta zamknięcia w treningu).

**Zmiana:** Free run, Solo 501 i „Końcówki” (`CheckoutPracticePanel.tsx`, `CheckoutPracticeSummary.tsx`, `EndPracticeDialog.tsx`, części `GameScreen.tsx` dla treningu) według `E3FreeRun`, `E3Solo501`, `E3Koncowki`; `SettingsScreen.tsx` (`E3Ustawienia`), `LoginScreen.tsx` (`E3Logowanie`), `AbandonDialog.tsx` (`E3DialogPorzucenie`), `Notice.tsx`, `EventBanner.tsx`, `AchievementNotices.tsx`, przełączniki głosu, efektów i komentarzy. Skróty „Końcówek” ze znaczkami zostają.

**Testy:** istniejące testy przechodzą; zrzuty trzech treningów, ustawień, logowania z błędem i dialogu porzucenia.

## R9: tury bieżącego lega w snapshocie (schema, server)

**Zależność:** brak (może iść od razu).

**Zmiana:**
1. **Schema:** `MatchSnapshot` dostaje `legTurns`: tury bieżącego lega w kolejności rzutów, każda `{ playerId, turnIndex, darts: Hit[], points, remainingAfter, bust }` (w Free run `remainingAfter` `null`, a tury to tury sesji). Tylko zamknięte tury; bieżąca tura zostaje w `currentDarts`. Typy i testy schematu. Nazwy pól mogą się zmienić, jeśli w schemacie są już pasujące typy (np. dla `LegProgress`); wtedy użyj ich.
2. **Serwer:** pole liczone przy odtworzeniu zdarzeń (zasada: statystyki z rzutek, nie z liczników), z aktywnych rzutek, bez cofniętych i bez `pending`; korekta lub cofnięcie przelicza je. Nowy leg zaczyna pustą listę. Wiadomość WebSocket ze stanem niesie je jak resztę snapshotu.
3. **README:** opis pola w API.

**Testy:** serwer: dwie tury dwóch graczy; bust (wynik po turze sprzed tury, `bust: true`); cofnięcie ostatniej rzutki tury usuwa turę; nowy leg czyści listę; zabawa z zakończonym graczem; Free run; snapshot po korekcie rzutki.

**Poza zakresem:** front (R10), historia tur poprzednich legów.

## R10: zbite punkty, statystyki lega i historia tur na ekranie gry (web)

**Zależność:** R4, R8, R9.

**Zmiana:**
1. Czyste funkcje w `packages/web/src/game/` liczone z `legTurns`: zbite w legu i liczba tur gracza („▼ 131 w 2 turach”), punkty ostatniej tury („▼ 60”), najwyższa tura w legu (z imieniem gracza), liczba rzutek w legu, liczba bustów.
2. `Scoreboard`: zbite punkty u rzucającego („▼ X w N turach”) i ostatnia tura u czekających („▼ X”), według `E3Gra1v1`.
3. Nowe komponenty `TurnHistory` (tabela tura × gracz z wynikiem po turze i punktami w nawiasie, bust z ikoną i słowem, bieżąca tura wyróżniona, przewijanie we własnym kontenerze z widoczną bieżącą turą) i `StatTile` (Najwyższa tura, Rzutek w legu, Busty), według `design/scena/components/TurnHistory/` i `StatTile/`. Tablet: w lewej kolumnie między paskiem wyników a kartą zamknięcia (`E3Gra1v1`, `E3GraZabawa`); telefon: panel pod przyciskiem „Tury” nad klawiaturą, bez przesuwania klawiatury (`E3GraTelefon`); Solo 501 jak `E3Solo501`, Free run jako „Przebieg sesji” jak `E3FreeRun`.
4. Teksty w `pl.ts`, opisy dla czytników ekranu.

**Testy:** jednostkowe funkcji (bust, pierwsza tura, zabawa, Free run, pusta lista); komponentowe (`TurnHistory` z bustem: ikona i tekst; `StatTile`); test, że klawiatura nie zmienia położenia po pojawieniu się historii (jak testy P31); zrzuty 1v1 w połowie lega z bustem, zabawy i telefonu z otwartym panelem.

## Poza zakresem

Nowe tryby gry, zmiany zasad X01, zmiany w `vision`, jasny motyw, animacje poza obecną zamianą wierszy w pasku wyników. Widok TV (drugi ekran) odłożony na później decyzją autora 2026-11-10 (`auto-score-dart-pomysly.md`, „Na później: widok TV”); w etapie 3 kompaktowy rozmiar paska wyników dostaje tylko nowy wygląd. Ekrany kamery z gałęzi `feat/camera` (rzutka `pending`, kalibracja) przechodzą na „Scenę” po połączeniu gałęzi, według `E3GraWeryfikacja`.
