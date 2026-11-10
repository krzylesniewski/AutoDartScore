# ProgressBar

Pasek progresu gracza z kierunku „8. Dashboard”: cienka droga od wyniku startowego do zera, przy każdym graczu między dużym wynikiem a linią statystyk.

- Wysokość 6 px, promień 3 px, tor `color-progress-track`.
- Wypełnienie: szerokość = zbite / wynik startowy (np. (301 − 170) / 301 = 43,5%). U rzucającego (`--current`) `color-accent` z poświatą `color-accent-glow`, u czekających `color-text-muted`.
- Wypełnienie odcina się od karty, nie od toru: `color-accent` ma 3,3:1 na `color-surface-raised`, `color-text-muted` 5,6:1 na `color-surface-softer`.
- Pasek ma `role="img"` i `aria-label` („Zostało 170 z 301 punktów”), więc nie niesie znaczenia samym kolorem.
- Bust nie cofa paska (wynik wraca do stanu sprzed tury, więc pasek też).
- Bez paska w Free run (nie ma wyniku startowego).

Dostarczasz: wynik startowy i pozostały wynik ze snapshotu.
