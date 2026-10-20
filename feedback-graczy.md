# Feedback od graczy

Uwagi z prawdziwych gier: co przeszkadza, czego brakuje, co się podoba. Plik zbiera surowe zgłoszenia; decyzje i plan zostają w `auto-score-dart-pomysly.md`, a zadania w rolloucie.

## Jak dopisywać

- Nowy wpis na górę sekcji „Wpisy”, jeden wpis na jedną sprawę.
- Słowa gracza zapisuj możliwie dosłownie, bez oceniania. Interpretację dopisz osobno w „Uwagach”.
- Kto zgłosił: imię albo „autor”. Bez danych kontaktowych.
- Gdy wpis trafi do planu, uzupełnij „Status” i link (PR, sekcja planu).

**Rodzaj:** `błąd` · `utrudnienie` · `pomysł` · `pochwała`
**Obszar:** `ekran gry` · `klawiatura` · `głos` · `statystyki` · `kreator` · `historia` · `telefon` · `online` · `inne`
**Status:** `nowy` · `do decyzji` · `zaplanowany` · `zrobiony` · `odrzucony` (z powodem)

### Szablon

```markdown
### RRRR-MM-DD: krótki tytuł
- **Zgłosił:** …
- **Rodzaj / obszar:** … / …
- **Co powiedział:** „…”
- **Kontekst:** urządzenie, typ gry, sytuacja
- **Status:** nowy
- **Uwagi:** …
```

## Wpisy

### 2026-10-20: klawiatura na ekranie gry skacze
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** utrudnienie / klawiatura, ekran gry
- **Co powiedział:** „klawiatura na widoku gry skacze. nie da się wygodnie z niej korzystać”
- **Kontekst:** urządzenie i moment skoku nieznane, poprawka obejmuje wszystkie szerokości
- **Status:** zaplanowany (P31, `design/plan-p31-p32.md`)
- **Uwagi:** prawdopodobne przyczyny w kodzie (do potwierdzenia na urządzeniu):
  - `EventBanner` (bust, wygrana) renderuje się pod klawiaturą w tym samym przyklejonym do dołu bloku (`GameScreen.tsx:103-124`), więc na telefonie jego pojawienie się podnosi klawiaturę,
  - panel zamknięcia (`TurnPanel`, np. „D12”) pojawia się i znika zależnie od wyniku (`return null`), co zmienia wysokość nad klawiaturą na tablecie i monitorze,
  - zmiany w pasku wyników (rotacja kolejki) i w blokach porzucenia lub końca treningu nad klawiaturą.
  - Kierunek poprawki: stałe miejsce na baner i panel zamknięcia (zarezerwowana wysokość albo nakładka), żeby klawiatura nie zmieniała położenia.

### 2026-10-20: domyślnie 301 i best of 1 przy nowej grze
- **Zgłosił:** gracze (przekazał autor)
- **Rodzaj / obszar:** utrudnienie / kreator
- **Co powiedział:** „default na start nowej gry daj 301 i best of 1”
- **Kontekst:** start nowej gry w kreatorze
- **Status:** zaplanowany (P32, `design/plan-p31-p32.md`)
- **Uwagi:** dziś domyślnie 501 i best of 3: kreator (`INITIAL_SETUP` w `packages/web/src/game/game-setup.ts`) i domyślne wartości API (`CreateMatchRequest` w `packages/schema`). Decyzja dopisana do `CLAUDE.md` (2026-10-20): domyślnie 301 i best of 1.

### 2026-10-20: wyłączenie komentarzy w nagraniach
- **Zgłosił:** autor
- **Rodzaj / obszar:** pomysł / głos
- **Co powiedział:** „pierwsza opcja [w ustawieniach] to wyłączenie tych dodatkowych nagrań komentujących rzuty typu »za dużo dobrego«”
- **Kontekst:** po wdrożeniu nagranych komunikatów (P21)
- **Status:** odrzucony (decyzja autora 2026-10-20: zamykamy temat bez wdrażania, nagrania zostają jak są)
- **Uwagi:** „Za dużo dobrego” to część nagrania busta (`bust_1`); wszystkie trzy nagrania busta mają żart, neutralnego „Bust.” nie ma. Do ustalenia: co grać przy wyłączonych komentarzach, czy wyłączać też emocje w odczycie wyniku, nowa zakładka „Ustawienia”.

### 2026-10-20: z odczytem wyniku gra się lepiej
- **Zgłosił:** autor
- **Rodzaj / obszar:** pochwała / głos
- **Co powiedział:** „po kilku testach bez i z wynikami lepiej gra się, jak wynik jest odtwarzany”
- **Kontekst:** gry na kilku urządzeniach
- **Status:** zrobiony
- **Uwagi:** zniesiono zasadę „audio hosta”: głos i efekty domyślnie włączone na każdym urządzeniu (commit `d1f3317`).

### 2026-10-20: brak reakcji klawiatury na dotyk
- **Zgłosił:** autor
- **Rodzaj / obszar:** utrudnienie / klawiatura
- **Co powiedział:** dotknięcie przycisku na telefonie i tablecie nie daje żadnej reakcji, nie wiadomo, czy trafienie się zapisało
- **Kontekst:** telefon, tablet
- **Status:** zrobiony
- **Uwagi:** stan wciśnięcia i mignięcie po trafieniu (P22, PR #20).

### 2026-10-20: statystyki nieczytelne na telefonie
- **Zgłosił:** autor
- **Rodzaj / obszar:** utrudnienie / statystyki, telefon
- **Co powiedział:** górny pasek zajmuje 3 wiersze, treść nachodzi na pasek, filtry i kafle się zawijają, liczby z kropką
- **Kontekst:** iPhone 375×812, ranking i karta gracza
- **Status:** zrobiony
- **Uwagi:** P23 (PR #21). Do sprawdzenia: procent doubli przy szerokości 640-720 px może wyjść poza kolumnę.
