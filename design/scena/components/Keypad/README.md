# Keypad

Klawiatura ręcznego wpisu na ekranie gry. Liczby leżą po kole w kolejności z tarczy (20 na górze, zgodnie z ruchem wskazówek: 1, 18, 4…). To klawiatura, a nie podgląd tarczy.

- Klawisze `.sc-key`: koła 76 px na okręgu o promieniu 252 px w polu 600×600, gradient `color-surface-raised` → `color-surface`, `shadow-key`, numer w `key-number`. Klawisz ma głębię, nie jest płaski: światło od góry i cień w dół, przy wciśnięciu schodzi o 1 px.
- W środku 25 i Bull (`.sc-key--wide`, 100 px wysokości, `key-large`); Bull ma obwódkę `color-accent`.
- Z lewej kolumna mnożnika (`SegmentedControl --multiplier`), z prawej „Najczęściej trafia …” (6 chipów `.sc-chip`, `color-surface-soft`), duży Miss, „Reszta tury: Miss” i Cofnij.
- Siatka w kolejności tarczy jako alternatywa z Ustawień ma te same klawisze w układzie 10×2.
- Klawiatura nie skacze ani nie wychodzi poza ekran przy żadnym stanie (P31). Pozycje liczy kod, nie są wpisane na sztywno.
- **Skróty klawiaturowe zostają i są widoczne** (uwaga autora 2026-11-10): mały znaczek `.sc-kbd` w prawym górnym rogu klawisza, jak `SHORTCUT_BADGE` w aplikacji: S, D i T na mnożniku, B na 25, Shift+B na Bull, Spacja na Miss, Backspace na Cofnij. Liczby wpisuje się cyframi, więc numery nie mają znaczka. Znaczek ma `aria-hidden`, a klawisz `aria-keyshortcuts`. Od `lg` w górę; na telefonie bez znaczków.

Dostarczasz: wybrany mnożnik, najczęstsze trafienia gracza i obsługę wpisu.
