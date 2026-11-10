# ScoreboardRow

Wiersz paska wyników. Rzucający jest zawsze na górze w dużej karcie, czekający są pod nim w niższych wierszach. Pozostały wynik pokazujemy tylko tutaj, raz.

**Rzucający** (`.sc-player--current`): gradient `color-surface-raised` → `color-surface`, `shadow-card`, `radius-card`, mała tarcza `.sc-card-rings` w rogu.
- Góra: awatar `--lg --current`, imię w `name-current`, opis „rzuca teraz · rzutka 1 z 3” w `color-text-sub`, kropki legów (`.sc-legs`, wygrany leg wypełniony, `aria-label` „Legi: 1 z 2”; w zabawie bez kropek).
- Dół: wynik w `score-current` po prawej. Po lewej zbite punkty „▼ 131 w 2 turach” (`.sc-knocked`, zbite w tym legu i liczba tur) i linia statystyk w `body`.
- Na samym dole `ProgressBar --current`.

**Czekający** (`.sc-player--waiting`): `color-surface-softer` z linią światła u góry, awatar 46 px, imię w `name-waiting`, opis „następny · śr. 30,00 · ▼ 60” (zbite w ostatniej turze), wynik w `score-waiting` i `color-text-sub`, `ProgressBar` w `color-text-muted`.

- Zabawa (3-4 graczy): ta sama karta rzucającego, czekający w ciaśniejszych wierszach. Zakończony gracz ma odznakę miejsca z ikoną `place.svg` i schodzi na dół paska.
- Zamiana wierszy przy zmianie rzucającego zostaje animowana jak dziś, z `prefers-reduced-motion` bez animacji.
- Kompaktowy wariant (TV) ma te same elementy w mniejszej skali i jest do zaprojektowania w makietach (D2).

Dostarczasz: gracza (imię, awatar, kolor), pozostały wynik, wynik startowy, zbite w legu z liczbą tur, ostatnią turę, średnie, legi. Zbite punkty i statystyki lega wymagają nowego pola w snapshocie (etap 3, K2).
