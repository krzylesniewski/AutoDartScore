# P45: wykres zejścia z wyniku na podsumowaniu gry

Pomysł autora z 2026-10-26 (`feedback-graczy.md`, `auto-score-dart-pomysly.md`, sekcja „Wykres zejścia z wyniku na podsumowaniu gry”), decyzje z tego samego dnia. Wspólne zasady z `design/rwd.md` obowiązują dalej. Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts`, typy i DTO tylko z `packages/schema`, kolor nigdy sam nie niesie znaczenia.

## P45: wykres pozostałego wyniku od liczby lotek w ostatnim legu (schema, server, web)

**Pomysł:** „Nowy wykres na widoku zakończonej gry/podsumowanie. Pod Leg 1 wykres, na którym są stan punktów, a na poziomej ilość lotek. Chcę zobaczyć, jak szybko schodzimy z wyniku”.

**Decyzje 2026-10-26:**
- wszyscy gracze lega na jednym wykresie, każdy swoją linią;
- oś pionowa to pozostały wynik (od punktów startowych do 0), oś pozioma to dokładna liczba rzuconych lotek gracza, punkt po każdej lotce;
- bust: linia wraca do wyniku sprzed tury, a w tym miejscu jest znacznik z napisem „Bust”;
- wykres tylko dla ostatniego lega gry;
- mecz 1v1 i zabawa mają wykres, trening (Solo 501 i Free run) nie ma.

**Dziś:** zakończony mecz 1v1 pokazuje `MatchEndView` (`packages/web/src/components/MatchEndView.tsx`) z kartami legów (`LegCards`, „Leg 1”…). Zakończona zabawa i trening pokazują `MatchSummaryPanel` na ekranie gry. Oba widoki biorą dane z `GET /matches/:id/summary` (`MatchSummary` w `packages/schema/src/stats.ts`, liczone w `packages/server/src/stats-service.ts` i `stats/tally.ts` ze zdarzeń domenowych silnika). Podsumowanie nie ma dziś przebiegu wyniku. Zakończona gra otwarta z ekranu Historia trafia do tych samych widoków, więc Historia nie wymaga osobnej zmiany.

**Zmiana:**
1. **Schema:** `MatchSummary` dostaje pole `lastLegProgress`: `null` dla treningu i dla gry bez rzutki w ostatnim legu, a w pozostałych przypadkach `{ legIndex, startingScore, players: [{ playerId, points: [{ dart, remaining, bust }] }] }`. `dart` to numer lotki gracza w legu od 1 (każda rzutka, także miss i lotki tury z bustem), `remaining` to wynik gracza po tej lotce, `bust` jest `true` tylko na lotce, która spowodowała bust. Gracze w kolejności `playerIds`. Testy schematu.
2. **Serwer:** przebieg liczony ze zdarzeń ostatniego lega przez odtworzenie zdarzeń, tak jak reszta podsumowania (bez nowych tabel i liczników). Lotki tury z bustem przed lotką powodującą bust mają swoje pośrednie wyniki, a po lotce z bustem `remaining` to wynik sprzed tury. Rzutki cofnięte (Cofnij) i poprawione po weryfikacji liczą się według stanu po odtworzeniu. Rzutka `pending` (niepotwierdzona) nie wchodzi do przebiegu. W zabawie linia gracza kończy się na jego lotce zamykającej, a linia ostatniego gracza na jego ostatniej lotce.
3. **Front:** komponent `ScoreProgressChart` (SVG, bez nowej biblioteki; wzór i pomocnicze funkcje jak w `FormChart` i `game/form-chart.ts`):
   - linia każdego gracza w kolorze jego awatara (tokeny z `theme.css`), punkt startowy (0 lotek, `startingScore`) i punkt po każdej lotce;
   - legenda z awatarem i imieniem każdego gracza, a linie różnią się też znacznikiem punktów lub stylem kreski, więc da się je rozróżnić bez koloru;
   - znacznik bustu (ikona `BustIcon` i napis „Bust”) w punkcie powrotu;
   - opisy osi: w pionie „Pozostało” z wartością startową i 0, w poziomie „Lotki” z liczbą lotek najdłuższej linii;
   - `role="img"` z krótkim opisem dla czytników ekranu (np. „Zejście z wyniku w legu 2: Anna 15 lotek do 0, Bartek 18 lotek do 32”), jak w `FormChart`.
4. **Gdzie:** w meczu 1v1 w `MatchEndView` pod kartami legów, z nagłówkiem z numerem ostatniego lega („Leg N”). W zabawie w `MatchSummaryPanel` pod tabelą podsumowania. Brak wykresu, gdy `lastLegProgress` jest `null`.
5. **RWD:** wykres zajmuje całą szerokość karty i skaluje się (`viewBox`), bez poziomego przewijania strony przy 375×812. Wysokość wykresu nie większa niż 240 px.

**Testy:**
- serwer: przebieg dla meczu 1v1 (dwóch graczy, liczba punktów równa liczbie lotek, ostatni `remaining` zwycięzcy to 0); bust w środku tury (pośrednie wyniki, potem powrót do wyniku sprzed tury z `bust: true`); Cofnij zwycięskiej rzutki zmienia przebieg; mecz best of 3 zwraca tylko ostatni leg; zabawa 3 graczy (linie kończą się na lotce zamykającej, ostatni gracz bez zera); Solo 501 i Free run dają `null`;
- front: wykres pod kartami legów w meczu 1v1 i pod tabelą w zabawie, brak wykresu dla treningu i przy `null`; legenda z imionami; znacznik bustu; opis `aria-label`;
- zrzuty ekranu podsumowania meczu i zabawy przy 375×812, 768×1024 i 1920×1080 w opisie PR-a.

**Poza zakresem:** wykresy dla wcześniejszych legów i przełącznik legów, wykres na ekranie statystyk gracza, wykres w trakcie gry, interakcje (podpowiedź po najechaniu, powiększanie), wykres dla treningu, nowe biblioteki wykresów.
