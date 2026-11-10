# HistoryRow

Wiersz na liście historii gier, pogrupowany etykietami dni (`label`: „DZIŚ”, „WCZORAJ”).

- 78 px wysokości, `color-surface-softer` z `shadow-inset-line`, `radius-card`; cały wiersz to link do podsumowania gry.
- Godzina w Barlow Condensed 20 px 700 (`color-text-sub`), awatary 42 px nachodzące na siebie, wynik „Grzesiek 0 : 1 Krzysiek” (przegrany w `color-text-muted` 600), meta „Mecz 1v1 · 301 · 9:07”.
- Odznaka `.sc-badge`: zwycięzca z ikoną `trophy.svg`; gra w trakcie z kropką `color-status-ok` i tekstem „W trakcie”.
- Gra w trakcie (`--live`): gradient karty, bez kolorowej obwódki (decyzja autora 2026-11-10). Stan niesie odznaka z kropką i tekstem „W trakcie”.
