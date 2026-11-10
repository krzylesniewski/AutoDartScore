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
4. **Zakres makiet (rozstrzygnięte 2026-11-10): wszystkie ekrany.** Oprócz ekranów ze „Scena+” makiety obejmują: grę 3-4 graczy (zabawa), trening (Free run, Solo 501, „Końcówki”), ustawienia, logowanie, dialogi (nowy gracz, porzucenie), rzutkę `pending` z kamery, widok kompaktowy (TV) i telefon 390 px.
5. **Dane do nowych informacji:** snapshot (`MatchSnapshot` w `packages/schema/src/match-api.ts`) ma tylko bieżącą turę (`currentDarts`), więc historia tur, zbite punkty i statystyki lega wymagają nowego pola w snapshocie liczonego w serwerze przez odtworzenie zdarzeń (zasada: statystyki z rzutek, nie z liczników). Rozstrzygnięte 2026-11-10: jedno pole `legTurns` w snapshocie (tury bieżącego lega: gracz, rzutki, wynik po turze, bust), liczone w serwerze z odtworzenia zdarzeń; front liczy z niego zbite punkty, najwyższą turę, liczbę rzutek i busty.

## Kroki

| Krok | Co | Wynik |
|---|---|---|
| **D1** | Design system „AUTO Score: Scena” jako Artifact: tokeny (kolory, tło z gradientem, powierzchnie, typografia Barlow Condensed + Barlow, promienie, cienie, odstępy) nazwane tak jak tokeny w `design/theme.css`, plus komponenty: karta, przycisk (główny, drugi, ikonowy), chip trasy zamknięcia, klawisz klawiatury, wiersz paska wyników, pasek progresu, kafelek statystyki, tabela, przełącznik segmentowy, nawigacja. Kontrast tekstu ≥ 4,5:1 sprawdzony dla każdej pary. | pierwsza wersja 2026-11-10: https://claude.ai/artifact/LqA3gyNJgsZU2ceAtEzuGy |
| **D2** | Makiety na kanwie, nowa strona „Etap 3: Scena”, zbudowane z D1: ekrany z „Scena+” poprawione o decyzje wyżej i ekrany z pkt. 4 listy „Do decyzji”, przy 1600×900 (tablet poziomo) i 390×844 (telefon). | makiety do akceptacji |
| **D3** | Akceptacja autora, eksport zrzutów do `design/mockups/scena-*.png`, nowe tokeny w `design/theme.css` (wersja docelowa). | podstawa planu PR-ów |
| **R** | Plan PR-ów (sekcje R1…Rn w tym pliku), manifest `rollout/etap3/manifest.yaml` (`repo.base: feat/redesign`), gałąź `feat/redesign` od aktualnego `main` (po scaleniu P55-P57) z CI na push. | rollout gotowy do startu |

## Kamienie milowe (szkic, do potwierdzenia przy planie PR-ów)

| Kamień | Zakres | Co działa po scaleniu do `main` |
|---|---|---|
| **K1: nowy wygląd** | tokeny i komponenty bazowe, ekran gry z paskiem progresu, nowa gra, podsumowanie, historia, statystyki, pozostałe ekrany i dialogi | cała aplikacja w kierunku „Scena”, funkcje bez zmian |
| **K2: informacje na ekranie gry** | pole z historią tur lega w snapshocie (schema, server), zbite punkty, mini statystyki lega, historia tur | nowe informacje na żywo w trakcie lega |

## Uwagi autora do makiet (2026-11-10)

- Historia: gra w trakcie bez zielonej obwódki; stan niesie odznaka „W trakcie” z kropką.
- Podsumowanie: puchar zostaje, promienie z linii wokół niego nie.
- Wykresy: dokładność z P56 zostaje (punkt co rzutkę, siatka co 3 lotki, co 50/100 punktów, podpisy osi). Redesign zmienia tylko wygląd wykresów (kolory, fonty, tło), nie ich logikę w `score-progress-chart.ts` i `form-chart.ts`.

## Poza zakresem

Nowe tryby gry, zmiany zasad X01, zmiany w `vision`, jasny motyw, animacje poza obecną zamianą wierszy w pasku wyników.
