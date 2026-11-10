# Stage

Tło sceny: ciepła czerń z elipsą światła nad tarczą i pierścieniami tarczy w tle. To korzeń każdego ekranu.

- Tło: `radial-gradient(ellipse 1000px 700px at 62% -10%, color-bg-glow 0%, color-bg-mid 45%, color-bg 100%)`. Na ekranie gry środek światła jest nad klawiaturą (62%), na ekranach list (historia, statystyki) nad tytułem (18-20%).
- Pierścienie: SVG 1000×1000 z pięcioma okręgami (r 490, 455, 430, 270, 252) i 20 drutami co 18°, kreska 1 px w `color-text`, przezroczystość `opacity-rings`. Na ekranie gry środek pierścieni pokrywa się ze środkiem klawiatury, na listach pierścienie wychodzą poza prawy górny róg.
- Pierścienie mają `aria-hidden="true"` i `pointer-events: none`.
- Ten sam motyw w małej skali (`.sc-card-rings`, 3 okręgi) siedzi w prawym górnym rogu kart, przy `opacity-card-rings`, i wychodzi poza kartę.

Nie: zdjęcia, faktury, inne kolory tła. Jasny motyw jest poza zakresem etapu 3.
