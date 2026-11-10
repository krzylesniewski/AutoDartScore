# DartSlot

Trzy sloty rzutek bieżącej tury i suma tury po prawej, w jednym rzędzie 120 px.

| Stan | Klasa | Wygląd |
|---|---|---|
| pusty | `.sc-slot` | `color-surface-softer` |
| czeka na rzutkę | `--active` | obwódka i poświata `shadow-slot-active`, mała tarcza w akcencie i „rzutka 3” w `body-lg` |
| wpisany | `--filled` | `color-surface-soft`, rzutka w Barlow Condensed 56 px 800, punkty pod spodem w `color-text-muted` |
| do weryfikacji | `--pending` | przerywana obwódka 2 px `color-text-sub`, ikona `warning.svg` i tekst „do potwierdzenia”; tura się nie zamyka |

- Suma tury („w tej turze” i wartość w `turn-total`) ma 150 px szerokości.
- Bust: w slotach zostają rzutki, a suma zamienia się na ikonę `bust.svg` z tekstem „Bust”.
- Stan `pending` z kamery (etap 2) wymaga jeszcze akceptacji w makietach.

Dostarczasz: rzutki tury ze snapshotu (`currentDarts`), numer następnej rzutki, sumę i status rzutki.
