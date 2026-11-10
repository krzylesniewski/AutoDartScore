# Button

Przyciski na ekranach Sceny. Główny (`.sc-btn--primary`) najwyżej raz na ekranie, dla akcji, po którą ekran istnieje („Zacznij grę”, „Zagraj jeszcze raz”).

| Wariant | Klasa | Wygląd | Kiedy |
|---|---|---|---|
| główny | `.sc-btn--primary` | gradient `color-accent-hi` → `color-accent` → `color-accent-lo`, tekst `color-on-accent` 24 px 800, `shadow-checkout` | jedna akcja ekranu |
| drugi | `.sc-btn` | `color-surface-soft`, tekst `color-text` w `meta` | Nowa runda, Do weryfikacji, chipy |
| obrysowany | `.sc-btn--outline` | przezroczysty, `shadow-outline` | Cofnij; `--quiet` w `color-text-sub` dla Reszta tury: Miss |
| duży | `.sc-btn--large` | 36 px 800, `radius-card` | Miss na klawiaturze |
| ikonowy | `.sc-btn--icon` | koło 44 px, `radius-pill` | głos, efekty, więcej |

- Wysokość 54 px (ikonowy 44 px), promień `radius-button`.
- Tekst `color-on-accent` na głównym ma 24 px, bo na `color-accent-hi` kontrast to 3,6:1.
- Ikona stoi przed tekstem i ma `alt=""`. Przycisk ikonowy bez tekstu ma `aria-label`.
- Wyłączony ma przezroczystość 0,4 i `disabled`, nigdy sam szary kolor.
- Fokus: `focus-ring`.
