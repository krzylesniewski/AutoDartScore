# Zestaw testowy detekcji

Klatki z prawdziwej tarczy z oznaczonym wynikiem. Każda zmiana w `packages/vision` jest sprawdzana na tym zestawie (zasady w `CLAUDE.md`, sekcja „Detekcja: zasady pracy”).

## Układ

```
fixtures/
  <sesja>/
    labels.json        # opis sesji i lista zdarzeń z oczekiwanym wynikiem
    calibration.json   # 4 punkty kalibracji dla kamery tej sesji (gdy już są)
    NN-before.jpg      # ostatnia stabilna klatka przed zdarzeniem
    NN-after.jpg       # pierwsza stabilna klatka po zdarzeniu
```

Klatki są w JPEG (1920×1080, jakość ffmpeg `-q:v 3`), żeby zestaw mieścił się w repo i działał w CI. Nagrania wideo (`*.mp4`) zostają poza gitem.

## `labels.json`

Każde zdarzenie ma `expected.kind`:

- `dart`: wbita lotka, z `segment` i `multiplier` w kodowaniu kontraktu trafienia (`packages/schema/src/hit.ts`); lotka poza polem punktowym to `segment: 0, multiplier: 0`;
- `removal`: wyjmowanie lotek (ręka w kadrze);
- `none`: zmiana, która nie jest rzutem (autofocus, ekspozycja, dryf światła).

## Nowa sesja

1. Nagranie (komenda w `auto-score-dart-pomysly.md`, sekcja „Sprzęt i pomiary”) i lista prawdziwych trafień w kolejności rzutów.
2. Wycięcie par klatek i dopisanie oczekiwanych wyników do `labels.json`.
3. Kalibracja tej sesji w `calibration.json`.
