# Panel

Karta na treść ekranu. Karty są zaokrąglone i wiszą nad sceną dzięki gradientowi i cieniowi, a nie dzięki grubej obwódce.

- **Główny** (`.sc-panel`): gradient `color-surface-raised` → `color-surface`, `shadow-panel`, `radius-panel`, opcjonalnie mała tarcza w rogu. Jeden albo dwa na ekranie: karta zwycięzcy, ranking średniej, karta zamknięcia.
- **Płaski** (`.sc-panel--flat`): `color-surface-softer` z `shadow-inset-line`. Treść druga: tablice rekordów, wykres przebiegu, lista legów.
- Nagłówek `.sc-panel__head`: tytuł w `card-title` i jednostka w `caption` (`color-text-muted`) wyrównane do linii bazowej.
- Odstęp wewnątrz 20-22 px, między panelami `space-6` (18 px) albo 20 px.

Nie: kolorowy pasek na lewej krawędzi karty, ta sama karta pod każdym blokiem. Etykieta sekcji (`label`) nad listą wystarcza tam, gdzie karta nic nie dodaje.
