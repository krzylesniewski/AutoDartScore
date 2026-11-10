# P55-P57: większe zakończenie, dokładniejsze wykresy, czas meczu i legów

Prośby autora z 2026-11-10 (`feedback-graczy.md`), decyzje autora z tego samego dnia. Wspólne zasady z `design/rwd.md` obowiązują dalej. Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts`, typy i DTO tylko z `packages/schema`, kolor nigdy sam nie niesie znaczenia. Klawiatura na ekranie gry nie może się przesunąć ani wyjść poza ekran (P31).

PR-y są od siebie niezależne i mogą iść równolegle.

## P55: większy chip z proponowanym zakończeniem (web)

**Prośba:** „Proponowane zakończenia tak ok. 15-20% większe”.

**Dziś:** trasa zamknięcia (np. „T20 D20”) to akcentowy chip `ROUTE_CHIP` w `packages/web/src/components/TurnPanel.tsx` z rozmiarem `text-[clamp(28px,8cqi,44px)]`. Ten sam chip pokazuje trasę w treningu „Końcówki” (`CheckoutPracticePanel.tsx`). Od `lg` karta zamknięcia ma stałą wysokość `lg:h-20`, żeby klawiatura nie skakała.

**Decyzja 2026-11-10:** powiększamy wspólny chip, więc rośnie w obu miejscach (gra i trening „Końcówki”).

**Zmiana:**
1. Rozmiar tekstu chipu o około 18% większy we wszystkich trzech wartościach: `clamp(33px, 9.5cqi, 52px)` (albo najbliższe wartości, które dają ten sam efekt). Proporcjonalnie można zwiększyć poziomy padding chipu, jeśli bez tego wygląda na ściśnięty.
2. Karta zamknięcia od `lg` zostaje przy `lg:h-20` (chip 52 px mieści się z zapasem). Jeśli przy jakiejś szerokości długa trasa z trzech rzutek (np. „T20 T19 D12”) nie mieści się w karcie, chip może się zmniejszyć przez `cqi`, ale nie może łamać się na dwie linie ani wychodzić poza kartę.
3. Niewidoczna karta zastępcza (bez trasy) zachowuje tę samą wysokość co karta z trasą.

**Testy:**
- test komponentu, że chip w grze i w treningu „Końcówki” używa tej samej klasy (`ROUTE_CHIP`);
- zrzuty ekranu gry z trasą z trzech rzutek przy 375×812, 768×1024, 1280×800 i 1920×1080 oraz treningu „Końcówki” przy 375×812 i 1920×1080 w opisie PR-a; na każdym zrzucie cała klawiatura jest widoczna i w tym samym miejscu co przed zmianą (jeśli wgranie obrazków nie działa, PR to opisuje).

**Poza zakresem:** zmiany tekstów w karcie zamknięcia, `--text-checkout` w `theme.css`, inne elementy ekranu gry.

## P56: siatka i podpisy osi na wykresach (web)

**Prośba:** „Wykresy dokładniejsze, zwłaszcza pozioma z ilością lotek w podsumowaniu meczu”.

**Dziś:**
- „Zejście z wyniku” (`ScoreProgressChart.tsx`, układ w `packages/web/src/game/score-progress-chart.ts`) na ekranie końca meczu 1v1 (`MatchEndView`) i w podsumowaniu zabawy (`MatchSummaryPanel`): oś pozioma ma tylko „0 · Lotki · max”, oś pionowa „wynik startowy · Pozostało · 0”, a siatka to tylko dwie przerywane linie na górze i na dole;
- „Forma” na karcie gracza (`FormChart.tsx`, układ w `packages/web/src/game/form-chart.ts`): na osi pionowej tylko min i max średniej, oś pozioma bez podpisów.

**Decyzja 2026-11-10:** siatka co turę na osi lotek i co 50 albo 100 punktów na osi wyniku. Bez podglądu punktu po dotknięciu.

**Zmiana:**
1. **Zejście z wyniku, oś lotek:**
   - koniec osi zaokrąglony w górę do pełnej tury (wielokrotność 3, np. 29 lotek → 30); dziś `maxDarts` jest dokładnie liczbą lotek najdłuższej linii;
   - pionowe linie siatki co 3 lotki (granica tury);
   - podpisy liczbowe co 3 lotki (3, 6, 9…), a przy długim legu rzadziej (co 6, co 12…), tak żeby na osi było najwyżej około 12 podpisów i żeby się nie nakładały przy 375 px; podpis „0” na początku i tytuł osi „Lotki” zostają.
2. **Zejście z wyniku, oś wyniku:** poziome linie siatki i podpisy co 50 punktów dla 301 i co 100 dla 501 i 701 (krok wynika z wyniku startowego, bez listy na sztywno w komponencie). Wynik startowy na górze i 0 na dole zostają podpisane. Podpis kroku tuż pod wynikiem startowym (np. 300 pod 301) pomijamy, gdy nachodziłby na podpis startowy. Tytuł osi „Pozostało” zostaje.
3. **Forma:** 3-5 poziomych linii z „okrągłymi” wartościami średniej (krok np. 1, 2, 5 lub 10, zależnie od rozrzutu) z podpisami w formacie `formatAverage`, a na osi poziomej numery gier (1…n) z rzadszymi podpisami przy wielu grach (najwyżej około 10).
4. **Wygląd:** linie siatki cienkie (`vectorEffect="non-scaling-stroke"`), w kolorze `--color-border` i pod liniami danych, żeby nie zasłaniały punktów ani znaczników bustu. Podpisy w tym samym stylu co dziś (Barlow Condensed, `--color-text-muted`, `tabular-nums`). Podpisy są w HTML poza SVG, pozycjonowane procentowo (jak znaczniki bustu), bo `preserveAspectRatio="none"` rozciągnąłby tekst w SVG.
5. **Logika:** położenie linii i podpisów liczą czyste funkcje w `score-progress-chart.ts` i `form-chart.ts` (bez DOM), z testami jednostkowymi. Podpisy osi zostają `aria-hidden`, a opisy wykresów dla czytników ekranu (`aria-label`, lista w `FormChart`) bez zmian.

**Testy:**
- jednostkowe: koniec osi zaokrąglony do pełnej tury; podpisy co 3 przy krótkim legu i rzadsze przy długim (np. 60 lotek); krok 50 dla 301 i 100 dla 501 i 701; pominięty podpis kolidujący z wynikiem startowym; „okrągłe” wartości siatki formy dla kilku zakresów średniej, także gdy wszystkie średnie są równe;
- komponentowe: wykres ma linie siatki i podpisy osi, znaczniki bustu nadal widoczne;
- zrzuty ekranu końca meczu 1v1 (leg 301 i 501), podsumowania zabawy i karty gracza z formą przy 375×812, 768×1024 i 1920×1080 w opisie PR-a; bez poziomego przewijania strony (jeśli wgranie obrazków nie działa, PR to opisuje).

**Poza zakresem:** podgląd wartości po dotknięciu lub najechaniu, nowe wykresy, zmiana danych z serwera (`LegProgress`, `PlayerFormPoint`), zmiana rozmiaru wykresów.

## P57: wyraźniejszy czas gry i czas każdego lega w podsumowaniu (schema, server, web)

**Prośba:** „Do podsumowania meczu dodaj długość jego trwania”.

**Dziś:** czas gry jest już liczony (P39: `startedAt`, `finishedAt` i `pausedMs` w snapshocie, `gameElapsedMs` w `packages/web/src/game/leg-clock.ts`, czas od pierwszej rzutki gry do ostatniej, bez przerw między porzuceniem a wznowieniem). Na ekranie końca meczu 1v1 (`MatchEndView`) jest tylko małym drukiem w linii ustawień pod wynikiem („301 · Double-out · Best of 1 · Czas gry 9:07”, `setupLine`), a w podsumowaniu zabawy (`MatchSummaryPanel`) jako zwykła linia tekstu. Czasu poszczególnych legów nie ma: `MatchSummaryLeg` w `packages/schema/src/stats.ts` ma `legIndex`, `winnerId`, `checkout`, `dartsThrown` i `averages`, a legi buduje `tallyGame` w `packages/server/src/stats/tally.ts` ze zdarzeń domenowych, które nie mają czasu.

**Decyzja 2026-11-10:** czas gry wyraźniej w karcie wyniku oraz czas każdego lega na liście legów.

**Zmiana:**
1. **Schema:** `MatchSummaryLeg` dostaje `durationMs` (liczba całkowita ≥ 0, milisekundy). Testy schematu.
2. **Serwer:** czas lega liczony tak samo jak czas lega na żywo z P39: od `receivedAt` pierwszej rzutki lega do `receivedAt` rzutki zamykającej leg, minus zamknięte przerwy (porzucenie i wznowienie) przypadające po starcie lega (wzór: `closedPauses` i `pausedSince` w `packages/server/src/replay.ts`). Tylko aktywne rzutki (bez cofniętych i bez `pending`), z tych samych danych co reszta podsumowania. `tallyGame` zostaje czystą logiką bez czasu: czas dokłada warstwa, która ma rzutki z `receivedAt` (albo czysta funkcja przyjmująca rzutki i log), tak żeby statystyki nadal wynikały z odtworzenia zdarzeń. Korekta lub weryfikacja rzutki, która zmienia przebieg lega, przelicza też czas.
3. **Front, koniec meczu 1v1 (`MatchEndView`):**
   - czas gry jako osobny, wyraźny element w karcie zwycięzcy pod wynikiem: etykieta „Czas gry” w stylu etykiet (`label`) i wartość większą czcionką display (np. „9:07”, `formatDuration`); w `setupLine` zostają tylko ustawienia gry, żeby czas był pokazany raz;
   - na liście legów przy każdym legu czas lega (np. „Leg 1 · 4:12”, ikona zegara i tekst, nie sam kolor).
4. **Front, podsumowanie zabawy i pozostałe użycia `MatchSummaryPanel`:** czas gry w tym samym wyraźnym stylu (etykieta i wartość), a na liście legów (jeśli jest) czas lega tak samo jak wyżej.
5. **Teksty:** nowe i zmienione teksty w `i18n/pl.ts` (np. etykieta „Czas gry” osobno od wartości, opis czasu lega dla czytnika ekranu w formacie `spokenDuration`).
6. **README:** opis podsumowania meczu w API uzupełniony o `durationMs` lega.

**Testy:**
- serwer: czas lega z rzutek dwóch legów; przerwa (porzucenie i wznowienie) w trakcie lega odjęta, a przerwa przed pierwszą rzutką lega nie; cofnięta rzutka zamykająca nie wydłuża ani nie skraca lega; korekta, która przenosi zamknięcie lega na inną rzutkę, zmienia czas;
- front: czas gry w karcie zwycięzcy i brak go w linii ustawień; czas przy każdym legu; podsumowanie zabawy z czasem gry; gra bez `finishedAt` (np. starsza) bez pustej etykiety;
- zrzuty ekranu końca meczu 1v1 (best of 3) i podsumowania zabawy przy 375×812, 768×1024 i 1920×1080 w opisie PR-a; bez poziomego przewijania strony (jeśli wgranie obrazków nie działa, PR to opisuje).

**Poza zakresem:** czas w treningu (Free run, Solo 501, „Końcówki”), czas w historii gier i statystykach (np. średni czas lega), zmiana zegara lega na ekranie gry, zmiana sposobu liczenia czasu gry z P39.
