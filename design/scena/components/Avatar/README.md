# Avatar

Awatar gracza: inicjały albo emoji na jednym z 16 stałych kolorów (`color-avatar-1` … `color-avatar-16`), tekst `color-on-avatar` w Barlow Condensed.

- Rozmiary: 58 px (`--lg`, rzucający), 46 px (czekający), 42 px (historia, nakładają się o 10 px z obwódką `color-bg-mid`), 34 px (`--sm`, rankingi).
- Rzucający (`--current`): obwódka 3 px w kolorze karty, potem 2 px w kolorze awatara i poświata w tym samym kolorze. Ustaw zmienną `--sc-avatar-color` na kolor awatara.
- Zdjęcie zamiast inicjałów wypełnia koło (`object-fit: cover`).

Dostarczasz: kolor z profilu, inicjały albo emoji i imię obok. Awatar nigdy nie stoi bez imienia.
