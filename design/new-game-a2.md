# Ekran startowy A2: wdrożenie UI

Przeniesienie istniejącego ekranu „Nowa gra” (`packages/web/src/screens/HomeScreen.tsx`) na układ A2. **Tylko wygląd i układ.** Bez nowych funkcji, bez zmian w API, w `packages/schema`, w serwerze i w logice formularza (`game/game-setup.ts`). Ekran robi dokładnie to samo co dziś, tylko inaczej wygląda.

- Makieta: `design/mockups/theme-a2-new-game.html` (+ `.png`), źródło: https://claude.ai/artifact/X3fQ7qb26tmktL3amc2pML (plansza „A2: Nowa gra (nowocześniej)”).
- Kolory, fonty, promienie: tylko tokeny z `design/theme.css`, bez kolorów wpisanych na sztywno.
- Liczby i gracze na makiecie są przykładowe. Część elementów makiety to nowe funkcje: patrz „Poza zakresem” na końcu. Tych elementów **nie** wdrażamy.

## Zakres: element po elemencie

### 1. Układ ekranu
- Dwie kolumny jak dziś: formularz po lewej, prawa kolumna 440 px (podsumowanie i gry do dokończenia).
- Nowość w układzie: **przyklejony pasek na dole** na całą szerokość ekranu (wysokość 88 px, tło `--color-surface-header`, górna linia `--color-border-subtle`) z podsumowaniem i przyciskiem Start (punkt 7). Treść nad paskiem przewija się, pasek zostaje widoczny.
- Przycisk „Start gry” przenosimy z formularza do paska.

### 2. Górny pasek (`AppNav`)
- Zawartość bez zmian: Nowa gra, Statystyki, Historia, Ustawienia (wkrótce), stan kamery i głosu. Makieta pokazuje tylko dwa linki, ale zostają wszystkie obecne.
- Zmiana wyglądu: wysokość 64 px.

### 3. Typ gry (`NewGameForm`)
- Trzy duże kafle (wysokość 92 px, równej szerokości) zamiast małych przycisków: ikona 34 px, nazwa (Barlow Condensed 26 px) i jedno zdanie opisu (15 px, przygaszone).
- Opisy (nowe teksty w `i18n/pl.ts`, nic poza tym):
  - Mecz 1v1: „Dwóch graczy, best of N legów”
  - Zabawa: „3-4 graczy, walka o miejsca”
  - Trening: „Solo: Free run lub 501”
- Wybrany kafel: tło `--color-text` (krem), tekst `--color-text-inverse`. Niewybrany: tło `--color-surface`, ramka `--color-border-strong`.
- Zachowanie bez zmian: `aria-pressed`, ten sam `onTypeChange`.

### 4. Gracze (`NewGameForm`)
- Siatka 4 kolumn kafli (wysokość 72 px, odstęp 14 px): awatar 46 px i imię (Barlow Condensed 22 px).
- Wybrany gracz: tło `--color-surface-active` i ramka `--color-text`. **Bez numerów kolejności** w rogu kafla.
- „+ Nowy gracz” jako ostatni kafel z przerywaną ramką, otwiera to samo okno co dziś.
- Zachowanie bez zmian: `pickPlayer`, limity liczby graczy zależne od typu gry, podpowiedź pod listą, przewijanie listy przy wielu graczach, kolejność graczy taka jak zwraca API.

### 5. Punkty startowe, liczba legów, tryb treningu
- **Przełączniki segmentowe** zamiast osobnych przycisków: jedna ramka 2 px `--color-border-strong`, zaokrąglenie `--radius-card`, przyciski w środku rozdzielone linią 2 px `--color-border`, wysokość 48 px. Wybrana opcja ma kremowe tło.
- Dotyczy trzech istniejących grup: punkty startowe (301/501/701), liczba legów (Best of 1/3/5) i tryb treningu (Free run / Solo 501). Która grupa jest widoczna, zależy od typu gry tak jak dziś.
- Dostępność: kontener `role="group"` z `aria-label` (nazwa grupy), przyciski z `aria-pressed`.

### 6. Prawa kolumna
**Podsumowanie (`GameSetupSummary`)**
- Przy dwóch graczach górna część jak „Zapowiedź meczu” z makiety: awatary 72 px naprzeciw siebie, imiona pod nimi, między nimi „VS” (Barlow Condensed 40 px, `--color-accent`).
- Pod spodem zostają dotychczasowe wiersze podsumowania (Typ, Punkty, Format, Zasady, Zaczyna) w tej samej treści. Wierszy ze statystykami z makiety (bilans, średnie, najwyższe zamknięcie) **nie** dodajemy.
- Przy 0, 1 albo 3-4 graczach: obecna treść w nowym stylu karty.

**Gry do dokończenia (`UnfinishedGames`)**
- Dane i akcje bez zmian: tytuł, opis, stan (`row.state`, np. `1 : 0`), data, oznaczenie przerwanej gry, przyciski „Dokończ”, „Porzuć” i „Zakończ trening”, przewijanie listy, komunikaty o błędach.
- Wygląd wg makiety: ciaśniejsze wiersze (odstęp 10 px), „Porzuć” jako kwadratowy przycisk 44 px z ikoną × i dotychczasowym `aria-label`.
- Stan pokazuje to, co dziś (`row.state`), a nie pozostałe punkty z makiety.

### 7. Dolny pasek ze Startem
- Po lewej: awatary wybranych graczy (40 px) i „Imię vs Imię” (przy jednym graczu samo imię, przy 3-4 graczach awatary i liczba graczy), dalej jedna linia z danymi, które już są w podsumowaniu (punkty, format, zasady, kto zaczyna).
- Po prawej: „Start gry” (wysokość 60 px, tło `--color-accent`, tekst `--color-on-accent`, Barlow Condensed 28 px, wielkie litery).
- Stan nieaktywny jak dziś (`canStart`); błąd startu (`startError`) wyświetlony w pasku, przy przycisku.
- Bez skrótu klawiszowego i bez etykiety „Enter” z makiety.

### 8. Ogólne
- Cele dotykowe co najmniej 44 px, kolor nigdy nie jest jedynym wyróżnieniem (wybrany kafel ma też inną ramkę i tło).
- Teksty dla użytkownika po polsku, w `i18n/pl.ts`.
- Istniejące testy `packages/web` przechodzą; jeśli zmieniają się role albo etykiety, testy dostosowujemy, ale nie zmieniamy ich znaczenia.

## Kryteria akceptacji
- Ekran przy 1440×810 wygląda jak makieta A2, z wyjątkiem elementów z „Poza zakresem”.
- Wszystkie dotychczasowe akcje działają tak samo: wybór typu, graczy, punktów, legów i trybu treningu, nowy gracz, start, dokończenie, porzucenie i zakończenie treningu.
- Brak zmian w `packages/schema`, `packages/server` i `packages/engine`.
- `pnpm test`, `pnpm typecheck` i `pnpm lint` przechodzą.

## Poza zakresem (nowe funkcje, osobne zadania)
Te elementy są na makiecie, ale wymagają nowych danych albo zachowań, więc nie wchodzą do tego wdrożenia:
1. **Szybki rewanż**: karta z ostatnią konfiguracją i przyciskiem „Zagraj ponownie”.
2. **Statystyki w zapowiedzi meczu**: bilans meczów, średnie, najwyższe zamknięcie.
3. **Pozostałe punkty** w wierszach gier do dokończenia zamiast obecnego stanu.
4. **Skrót Enter** do startu gry.
5. **Klikalny stan kamery** („Kamera: brak · Skonfiguruj”).
6. **Kolejność „ostatnio grający pierwsi”**, jeśli API dziś jej nie zapewnia.
