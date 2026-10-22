# Statystyki: „Najwyższa tura” zamiast „Liczba 180”

Na ekranie statystyk kafel rankingu **„Liczba 180”** zastępujemy kaflem **„Najwyższa tura”**: najwyższy wynik jednej tury (do 3 lotek) w meczach 1v1. Pozostałe kafle bez zmian.

## Definicja
- Wartość gracza: maksymalna suma punktów jednej tury (`turn_completed.total`), od 0 do 180.
- Liczą się **tylko gry typu `match` (Mecz 1v1)**, z `countsToStats`. Zabawa i trening nie wchodzą do tego kafla.
- Tura z bustem się nie liczy (punkty przepadły). Tura zamykająca leg liczy się normalnie (np. zamknięcie 121 w turze = 121).
- Ranking top 5 malejąco (do 2026-10-22 top 3), remisy i pomijanie graczy bez wartości tak samo jak w pozostałych kaflach (obecna funkcja `top`).

## Filtr typu gry
- „Wszystkie” i „Mecze 1v1”: kafel liczony z meczów 1v1 w tym filtrze.
- „Zabawa” i „Trening”: w filtrze nie ma meczów 1v1, więc kafel pokazuje pusty stan z tekstem „Tylko mecze 1v1”.

## Zmiany w kodzie (zakres)
1. `packages/schema` (`stats.ts`): w rankingach pole `scores180` zastępujemy polem `highestTurn` (tablica `RankingEntry`). Statystyka gracza `scores180` (liczba 180 na karcie gracza i w tabeli) **zostaje bez zmian**.
2. `packages/server` (`src/stats`): liczenie najwyższej tury gracza z tur w meczach 1v1 i ranking `highestTurn` zamiast rankingu `scores180`.
3. `packages/web`: kafel w `RankingBoard.tsx` z tytułem „Najwyższa tura” i dopiskiem „3 lotki, mecze 1v1” (teksty w `i18n/pl.ts`), pusty stan jak wyżej. Nieużywane teksty `tile180` i `tile180Unit` usuwamy.
4. Testy (Vitest), co najmniej:
   - najwyższa tura z meczu 1v1 trafia do rankingu,
   - 180 rzucone w zabawie albo treningu jest pomijane,
   - tura z bustem jest pomijana, tura zamykająca leg się liczy,
   - filtr „Zabawa” daje pusty ranking `highestTurn`.

## Poza zakresem
- Zmiany w innych kaflach, w karcie gracza i w historii meczów.
- Nowe filtry albo okresy.

Makieta: `design/mockups/theme-a-stats.html` (+ `.png`), kafel w drugim rzędzie, w środkowej kolumnie.
