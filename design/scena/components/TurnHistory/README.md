# TurnHistory

Historia tur w bieżącym legu z kierunku „8. Dashboard”: tabela z kolumną na każdego gracza i wierszem na każdą turę.

- Komórka: wynik po turze i w nawiasie punkty w turze, np. „241 (60)”. Wynik w Barlow Condensed 21 px 700, punkty w `body-sm` (`color-text-muted`).
- Kolumna rzucającego w `color-text`, pozostałe w `color-text-sub`. Bieżąca tura ma tło `color-surface-softer`.
- Bust: wynik zostaje sprzed tury, obok ikona `bust.svg` i słowo „Bust”, nigdy sam kolor.
- Nagłówki kolumn to imiona w `th scope="col"`. Przy długim legu tabela przewija się w swoim kontenerze, z widoczną bieżącą turą.
- W zabawie 3-4 graczy kolumny się zwężają, a liczba w nawiasie może zejść pod wynik.

Dostarczasz: tury lega z serwera (nowe pole w snapshocie, K2; do ustalenia, czy front liczy z niego zbite punkty i statystyki lega).
