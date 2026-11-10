# SegmentedControl

Przełącznik jednej z kilku opcji. Wybrana opcja to krem (`color-text`) z tekstem `color-text-inverse` i cieniem `shadow-selected`, pozostałe są przezroczyste z tekstem `color-text`.

- **Poziomy** (`.sc-seg`): filtr typu gry w historii i statystykach, opcje w kreatorze. Kontener `color-surface-softer` z `shadow-inset-line`, opcje 46 px w stylu `nav`, promień `radius-button`.
- **Mnożnik** (`.sc-seg--multiplier`): kolumna 130 px po lewej stronie klawiatury, opcje Single, Double i Treble w stylu `segment`, promień `radius-segment`, kontener `color-surface-soft` z promieniem `radius-card`.

Dostarczasz: `role="group"` z `aria-label` i `aria-pressed` na każdej opcji. Wybór widać po kształcie i kolorze tła, nie po samym kolorze tekstu.
