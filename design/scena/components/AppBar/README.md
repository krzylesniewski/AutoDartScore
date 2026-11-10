# AppBar

Górny pasek, 68 px wysokości: znak i „AUTO SCORE”, a dalej zależnie od ekranu ustawienia gry albo nawigacja.

**Ekran gry** (`.sc-appbar--game`, bez linii pod spodem): ustawienia gry w `meta` i `color-text-sub`, „Leg 1 · kolejka 3”, zegar lega w pigułce `.sc-clock` (`color-surface-soft`, `radius-pill`, cyfry tabelaryczne) oraz przyciski ikonowe Głos, Efekty i Więcej (porzuć mecz).

**Pozostałe ekrany:** nawigacja `.sc-nav` w stylu `nav`. Aktywna zakładka ma `aria-current="page"`, tekst `color-text` 700 i podkreślenie 3 px w `color-accent` z poświatą `color-accent-glow`. Nieaktywne zakładki są w `color-text-muted`. Po prawej stan kamery w `.sc-status` (tekst zawsze, kropka `color-status-ok` tylko obok tekstu) i przycisk głosu.

Dostarczasz: znak (`assets/Logo/autoscore-mark.svg`), teksty z `i18n/pl.ts` i stan głosu i efektów. Każdy przycisk ikonowy ma `aria-label` ze stanem („Głos: włączony”).
