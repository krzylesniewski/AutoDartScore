AUTO Score liczy wynik w darcie przy tarczy: tablet albo monitor w poziomie, gra się z odległości 2-3 metrów, w świetlicy albo w domu, często przy słabym świetle. Kierunek „Scena” to światło nad tarczą w ciemnej sali: ciepła czerń, kremowy tekst, czerwień tarczy jako jedyny akcent i karty, które wiszą nad sceną dzięki gradientowi i cieniowi.

## Treść

- Wszystkie teksty po polsku, z `i18n/pl.ts`. Identyfikatory w kodzie po angielsku.
- Krótko i rzeczowo, bez wykrzykników i emoji w interfejsie. Przykłady z aplikacji: „rzuca teraz · rzutka 1 z 3”, „Reszta tury: Miss”, „Zamknięcie w 3 rzutkach”, „Czas gry”.
- Nazwy segmentów jak na tarczy i w kodzie: S20, D16, T20, 25, Bull, Miss. Liczby z przecinkiem dziesiętnym („65,50”), czas „9:07”.
- Separator w liniach meta to środkowa kropka ze spacjami: „301 · double-out · best of 3”.
- Wielkie litery tylko w etykietach (`label`, `label-on-accent`), zawsze z rozstrzeleniem.
- Kolor nigdy nie niesie znaczenia sam: bust, wygrana, rzutka do weryfikacji i stan kamery mają też ikonę i tekst.

## Kolor

- Tło każdego ekranu to `Stage`: gradient `color-bg-glow` → `color-bg-mid` → `color-bg` i pierścienie tarczy przy `opacity-rings`. Nie stawiaj treści na płaskim kolorze.
- Tekst główny i wyniki: `color-text`. Tekst drugi (meta, wynik czekającego): `color-text-sub`. Etykiety i jednostki: `color-text-muted`. Każdy z nich ma ≥ 4,5:1 na każdej powierzchni systemu, także na półprzezroczystych `color-surface-soft` i `color-surface-softer` nad kartą.
- `color-accent` to wypełnienia i obrysy, nie tekst (3,3:1 na karcie): pasek progresu rzucającego, aktywny slot rzutki, podkreślenie zakładki, obwódka Bull. Najmocniejsze użycie to karta zamknięcia z gradientem `color-accent-hi` → `color-accent` → `color-accent-lo`.
- Na akcencie tekst `color-on-accent`, tylko ≥ 24 px albo pogrubiony ≥ 19 px (3,6:1 na jasnym końcu gradientu). Mniejszy tekst na akcencie stawiaj na `color-route-chip` (6,2:1).
- `color-gold` znaczy wygraną i 1. miejsce, zawsze z pucharem albo numerem; `color-silver` i `color-bronze` tylko na podium. `color-status-ok` tylko dla stanu „na żywo” i „włączone”, z tekstem obok.
- Awatary: 16 stałych kolorów `color-avatar-1` … `color-avatar-16` bez zmian względem motywu A, inicjały w `color-on-avatar`.

## Typografia

- Dwie rodziny z Google Fonts: Barlow Condensed (`--font-display`, wagi 500-900) na liczby, imiona, przyciski i tytuły oraz Barlow (`--font-body`, 400-600) na zdania i opisy. W aplikacji obie z `@fontsource`.
- Cyfry zawsze tabelaryczne (`font-variant-numeric: tabular-nums`).
- Hierarchia ekranu gry od największego: `score-current` (128 px) → `score-waiting` (76) → `turn-total` (72) → `route` (58) → `name-current` (34). Rozmiary są z makiety 1600×900; w aplikacji skalują się przez `clamp()` i jednostki `cqi` (zasady z `design/rwd.md`).
- Tytuł ekranu (`title`, 64 px 900) tylko na ekranach list: Nowa gra, Historia, Statystyki. Na ekranie gry tytułu nie ma.

## Kształt, głębia, odstępy

- Karty są zaokrąglone: `radius-card` (18 px) dla kart graczy, slotów i karty zamknięcia, `radius-panel` (22 px) dla dużych paneli, `radius-button` (12 px) dla przycisków, `radius-pill` dla przycisków ikonowych, odznak i klawiszy tarczy. To zastępuje „kanciaste karty” motywu A.
- Głębia: światło od góry (wewnętrzna linia 1 px w `color-border`) i miękki cień w dół (`shadow-card`, `shadow-panel`, `shadow-key`). Klawisze nie są płaskie.
- Płaskie elementy drugiego planu (wiersze historii, kafelki, przełącznik) leżą na `color-surface-softer` z `shadow-inset-line`.
- Bez grubych obwódek kart i bez kolorowego paska na krawędzi karty.
- Odstępy: `space-page` (28 px) od krawędzi i między kolumnami, `space-5` (14 px) między kartami w kolumnie, `space-6` (18 px) między sekcjami.
- Dekoracja: motyw tarczy (pierścienie i druty) w tle sceny i mała tarcza w rogu kart, zawsze `aria-hidden`, przy przezroczystości z tokenów `opacity-*`. Żadnych innych ilustracji.

## Stany i dostępność

- Fokus klawiatury: `focus-ring` (2 px przerwy w `color-bg`, potem 2 px `color-focus`) na każdym elemencie interaktywnym.
- Wybrane: krem `color-text` z tekstem `color-text-inverse` (przełączniki), `aria-pressed` albo `aria-current`.
- Wyłączone: przezroczystość 0,4 i `disabled`.
- Rzutka do weryfikacji: przerywana obwódka, ikona `warning.svg` i tekst „do potwierdzenia”.
- Ruch: tylko zamiana wierszy paska wyników przy zmianie rzucającego; `prefers-reduced-motion` wyłącza animacje.
- Cele dotykowe ≥ 44 px. Klawiatura na ekranie gry nie przesuwa się i nie wychodzi poza ekran przy żadnym stanie.

## Ikony

Ikony aplikacji z `packages/web/src/components/icons.tsx` (siatka 24×24, jedno wypełnienie `currentColor`), w tym systemie jako pliki w `assets/Icons` z wypełnieniem `color-text`. Ikona stoi obok tekstu albo na przycisku z `aria-label`. Strzałki i trójkąt „▼” przy zbitych punktach to znaki tekstowe. Emoji tylko jako awatar gracza.

## Komponenty

Style w `components/bundle.css` (klasy `sc-*`), wartości tylko z tokenów. To wzorzec dla `packages/web`: aplikacja implementuje je w React i Tailwind ze zmiennymi CSS z `design/theme.css`, z tymi samymi nazwami tokenów.

| Komponent | Gdzie |
|---|---|
| `Stage`, `Panel` | tło i karty każdego ekranu |
| `AppBar` | górny pasek gry i nawigacja pozostałych ekranów |
| `Button`, `SegmentedControl` | akcje, filtr typu gry, mnożnik |
| `Avatar`, `ScoreboardRow`, `ProgressBar` | pasek wyników |
| `DartSlot`, `CheckoutCard`, `Keypad` | ekran gry |
| `StatTile`, `TurnHistory` | informacje o legu na ekranie gry (K2) |
| `HistoryRow`, `Podium` | historia i statystyki |

## Z motywu A do Sceny

Tokeny z `design/theme.css`, których Scena nie używa: `color-surface-header`, `color-surface-button` (→ `color-surface-soft`), `color-surface-active` (→ gradient `color-surface-raised` → `color-surface`), `color-border-subtle` i `color-border-strong` (→ `color-border`), `radius-card` 6 px (→ 18 px), `radius-chip` 4 px (→ 10 px), `border-width`. Nowe: `color-bg-mid`, `color-bg-glow`, `color-surface-raised`, `color-surface-soft`, `color-surface-softer`, `color-text-sub`, `color-accent-hi`, `color-accent-lo`, `color-accent-glow`, `color-route-chip`, `color-progress-track`, `color-gold`, `color-silver`, `color-bronze`, `color-focus`, cienie i `opacity-*`. Bez zmian: `color-text`, `color-text-muted`, `color-accent`, `color-on-accent`, `color-status-ok`, kolory awatarów.
