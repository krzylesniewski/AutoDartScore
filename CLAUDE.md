# AUTO Score: projekt aplikacji do darta

Aplikacja do automatycznego liczenia wyniku w darcie. Wejście: trafienia z symulatora/UI lub z jednej kamery USB. Wyjście: wynik na żywo, statystyki graczy, głosowy odczyt wyniku.

Szczegółowe pomysły i decyzje: `auto-score-dart-pomysly.md`.

## Zasady nadrzędne

1. **Backend jest jedynym źródłem prawdy o stanie gry.** Kamera, symulator i front tylko wysyłają zdarzenia.
2. **Detekcja jest osobnym, wymiennym modułem.** Robi jedno: wysyła zdarzenia trafień do API. Reszta systemu nie wie, czy trafienie przyszło z kliknięcia czy z kamery.
3. **Silnik gry to czysta logika** (bez I/O, bez UI, bez czasu systemowego), w pełni pokryta testami.
4. **Zapis zdarzeniowy:** zapisujemy każdą rzutkę i każde zdarzenie (korekta, undo, nowa runda). Stan meczu wynika z odtworzenia zdarzeń. Nic nie nadpisujemy po cichu.
5. **Ręczna korekta zawsze wygrywa z kamerą.**
6. **Małe kroki:** jedna funkcjonalność, testy, przegląd, następny krok. Nie rozbudowuj zakresu bez prośby.
7. **Niepewna rzutka nie jest zgadywana:** trafia do weryfikacji (`review`) albo ma jawne oznaczenie tymczasowości. Weryfikacja i oznaczenie to zdarzenia w logu.

## Stack

- TypeScript 6.0 w całym projekcie (monorepo, workspace'y pnpm), Node 24 (`.nvmrc`)
- Testy: Vitest; lint: ESLint (flat config) + typescript-eslint. TypeScript 7 dopiero, gdy wspiera go typescript-eslint.
- Backend: Node, Fastify lub NestJS, REST + WebSocket
- Front: React (Vite lub Next.js), tarcza jako SVG, układ pod tablet w poziomie
- Walidacja i typy zdarzeń: Zod (jedno źródło prawdy w `packages/schema`)
- Baza: SQLite (Drizzle lub Kysely) za cienką warstwą dostępu do danych, bez funkcji specyficznych dla jednego silnika, żeby później dało się przejść na PostgreSQL/Supabase
- Detekcja: Node + opencv-wasm (ewentualnie onnxruntime)
- Audio: Web Speech API na start, później gotowe klipy

## Struktura repo

```
/packages
  /engine      # silnik gry (czysty TS, testy)
  /schema      # kontrakt zdarzeń (Zod), współdzielony
  /server      # API + WebSocket + persystencja
  /web         # front
  /vision      # detekcja, wysyła zdarzenia do API
  /audio       # klipy i mapowanie zdarzeń na dźwięki
/fixtures      # klatki testowe z tarczy z oznaczeniami
```

## Środowisko i etapy

- **Local-first:** backend, baza i detekcja działają na jednym urządzeniu przy tarczy, bez zależności od internetu. Teraz Mac autora, później mini PC (Linux).
- Etapy: (1) Mac bez kamery: silnik, API, front z symulatorem, statystyki, audio; (2) Mac + jedna kamera USB; (3) dwie kamery USB; (4) mini PC; (5) wersja online.
- Projekt jest rozwijany po godzinach, więc każdy krok ma kończyć się działającą, testowalną rzeczą. Nie zaczynaj kolejnego etapu, dopóki poprzedni nie działa end-to-end.
- Kod ma być przenośny: czysty Node, WASM zamiast natywnych bindingów, konfiguracja przez zmienne środowiskowe (porty, ścieżka bazy, indeks kamery), źródło klatek za interfejsem `CameraSource` (macOS: AVFoundation, Linux: v4l2).

## Reguły X01 (ustalone)

- Wyjście: double-out (domyślnie).
- Mecz 1v1: best of 3 legów (wygrywa pierwszy, kto weźmie 2 legi). Zabawa 3-4 graczy: jeden leg z rankingiem miejsc (patrz "Typy gier").
- Bust: wynik tury się anuluje, gracz wraca do wyniku sprzed tury, tura się kończy. Bust gdy wynik spadłby poniżej zera, zostałaby dokładnie 1, albo wynik doszedłby do zera rzutką, która nie jest double (ani Bull).
- Rzutka poza tarczą lub odbita: wykonana rzutka za 0 (miss).
- Wejście: straight-in (punkty liczone od pierwszej rzutki).
- Punkty startowe: 301, 501 lub 701 do wyboru w ustawieniach.
- Kto zaczyna: pierwszy leg meczu wyłoniony losowaniem, kolejne legi na przemian.

## Front

- React + Vite (SPA), TypeScript, Tailwind ze zmiennymi CSS jako tokenami motywu (kolory, typografia, promienie w jednym miejscu, żeby łatwo zmienić motyw).
- Motyw wybrany: A, ciemny klasyczny (czerń, krem, czerwony akcent z tarczy, Barlow Condensed + Barlow, kanciaste karty). Tokeny (kolory, fonty, rozmiary, promienie) są w `design/theme.css` i to jest jedyne źródło kolorów: implementuj przez nie, bez kolorów wpisanych na sztywno. Makiety: https://claude.ai/artifact/X3fQ7qb26tmktL3amc2pML (ekrany „A: 2 graczy” i „A: 4 graczy”; zielony wariant B jest odrzucony). Zrzuty ekranów w `design/mockups/`: gra 2 i 4 graczy (`theme-a-2-players.png`, `theme-a-4-players.png`), ekran startowy „Nowa gra” (`theme-a-new-game.png`) i statystyki (`theme-a-stats.png`). Dla ekranu startowego obowiązuje wariant A2 (`theme-a2-new-game.png`); zakres wdrożenia, tylko UI bez nowych funkcji: `design/new-game-a2.md`. Makiety nie mają jeszcze klawiatury ręcznego wpisu: trzeba ją dodać w tym samym stylu.
- Kolor nie może samodzielnie nieść znaczenia (bust, wygrana, weryfikacja mają też ikonę i tekst).
- Profil gracza: imię + avatar (emoji lub zdjęcie), bez haseł. Dodawanie gracza w kreatorze gry. Gość bez zapisu statystyk. Archiwizacja zamiast usuwania. Opcjonalne `accountId` pod wersję online.
- Główny ekran na start: monitor. Ekran gry (2 kolumny): po lewej pasek wyników (kolejka rzutów: rzucający zawsze na górze, następni pod nim, animowana zamiana; wiersz = avatar, imię, pozostały wynik; wolne miejsca graczy 3 i 4 jako przerywane wiersze "Dodaj gracza"), w środku 3 sloty rzutek, suma tury, panel zamknięcia (np. D12) i przyciski Cofnij, Nowa runda, Do weryfikacji. Bez podglądu tarczy na ekranie gry. Ręczny wpis przez klawiaturę: przyciski 1-20, 25 (Bull) i Miss oraz przełącznik mnożnika S/D/T. Pozostały wynik pokazujemy tylko raz, w pasku wyników.
- Pasek wyników to osobny komponent w dwóch rozmiarach (duży na ekran gry, kompaktowy na widok TV/nakładkę), zasilany tym samym strumieniem zdarzeń. Rotacja kolejki jako ustawienie (domyślnie włączona).
- Koniec lega i meczu: ekran podsumowania (wynik, średnie, najwyższe zakończenie).

## Typy gier

- `match.type`: `match` (1v1, dokładnie 2 graczy, best of N legów, później sety i drabinki), `casual` (zabawa 3-4 graczy, jeden leg, ranking miejsc) albo `practice` (jeden gracz; `practiceMode`: `free_run` lub `solo_501`).
- Trening: **Free run** to swobodne rzucanie bez zasad i bez końca, system tylko notuje rzuty (licznik sesji: suma, średnia). **Solo 501** to zejście z 501 do zera z zasadami X01. Flaga `countsToStats`: `true` dla `match`, `casual` i `solo_501`, `false` dla `free_run`; agregaty statystyk uwzględniają tylko mecze z tą flagą (rzuty z Free run zostają w logu zdarzeń). Solo 501 da się oddzielić w statystykach filtrem "trening".
- Zabawa: gracz, który zamknie leg (double-out), zajmuje kolejne wolne miejsce i wypada z kolejki rzutów. Pozostali grają dalej, aż zostanie jeden gracz, który dostaje ostatnie miejsce. Wynik meczu to lista miejsc (`placements`).
- Statystyki liczone ze wszystkich meczów razem, z filtrem po typie. "Wygrana" w zabawie to 1. miejsce. Head-to-head domyślnie tylko z meczów 1v1.
- Pasek wyników: w `match` z licznikiem legów, w `casual` bez legów, z odznaką miejsca u zakończonych graczy (na dole paska). Rotacja kolejki (rzucający na górze) w obu typach.
- Kreator gry: pierwszy wybór "Mecz 1v1", "Zabawa" lub "Trening", potem kroki dopasowane do wyboru.
- Silnik musi mieć testy dla zabawy: kolejne zamknięcia legów, wypadanie z kolejki, ostatni gracz dostaje ostatnie miejsce, bust u grającego w trakcie, gdy inni już skończyli.

## Zakres MVP

- Tryb: tylko X01 (301/501/701 do wyboru w ustawieniach, double-out, straight-in, best of 3 legów). Drugi tryb (Cricket lub Around the Clock) dopiero po ukończeniu X01, nie implementuj go wcześniej.
- Gracze: 1-4, profile lub goście.
- Statystyki klasyczne: średnia na 3 rzutki, first 9, 180/140+/100+/60+, najwyższy checkout, % doubli, najlepszy leg, wygrane legi i mecze (sety dopiero po ich wprowadzeniu).
- Głos po każdej turze ("sto", "czterdzieści pięć") oraz osobne komunikaty `bust` i `winner`.
- Detekcja: jedna kamera USB, z ręczną korektą w UI.
- Opcja "rzut do weryfikacji": automatyczne i ręczne oznaczanie rzutek, ekran weryfikacji z kandydatami, kolejka, eksport rozstrzygniętych przypadków do `/fixtures`.

## Kolejność prac

1. `engine`: zasady X01 z testami, zdarzenia domenowe (`turn_completed`, `bust`, `leg_won`, `match_won`).
2. `schema`: kontrakt zdarzenia trafienia.
3. `server`: `POST /matches`, `POST /matches/:id/throws`, WebSocket ze stanem, persystencja rzutek.
4. `web`: ekran gry z ręcznym wpisem rzutów (symulator trafień), potem statystyki.
5. `audio`: odczyt wyniku, `bust`, `winner`.
6. `vision`: jedna kamera USB, kalibracja, wykrycie rzutki, wysyłka zdarzeń.
7. Korekta i weryfikacja: status `pending`, ręczne oznaczanie, ekran weryfikacji z kandydatami, kolejka, eksport do `/fixtures`.

## Kontrakt zdarzenia trafienia (szkic)

```json
{
  "eventId": "uuid",
  "matchId": "m_123",
  "source": "camera-1",
  "sequence": 42,
  "segment": 20,
  "multiplier": 3,
  "confidence": 0.87,
  "detectedAt": "2026-10-15T18:30:12.345Z"
}
```

- `eventId` zapewnia idempotencję (ponowne wysłanie nie dubluje rzutki).
- Niska `confidence` oznacza status `pending`: tura nie zamyka się i wynik nie jest odczytywany, dopóki rzutka nie zostanie potwierdzona. Bez automatycznego rozstrzygania po czasie (zasada 7); jedyną alternatywą jest tryb "zweryfikuj później" z jawnym odczytem tymczasowym.
- Tryb domyślny weryfikacji: "potwierdź teraz". "Zweryfikuj później" dostępny w ustawieniach.
- Kodowanie: Outer Bull = `segment: 25, multiplier: 1` (25 pkt), Bull = `segment: 25, multiplier: 2` (50 pkt, liczy się jako double przy double-out), miss = `segment: 0, multiplier: 0`. Mnożnik 3 dla segmentu 25 jest niedozwolony.

### Weryfikacja rzutki

Rzutka może mieć pole `review`:

```json
{
  "reason": "low_confidence | near_wire | detector_disagreement | occlusion | manual",
  "flaggedBy": "system | player",
  "candidates": [{ "segment": 5, "multiplier": 1, "probability": 0.48 }],
  "frames": { "before": "path", "after": "path" },
  "tip": { "x": 412, "y": 238 },
  "resolved": { "segment": 12, "multiplier": 1, "by": "player", "at": "ISO-8601" }
}
```

- Endpointy: `POST .../throws/:id/flag`, `POST .../throws/:id/verify`, `GET /matches/:id/review-queue`.
- Zdarzenia WebSocket: `throw_flagged`, `throw_verified`.
- Zmiana wyniku po weryfikacji przelicza turę, leg i checkout przez odtworzenie zdarzeń w silniku (testy dla tego scenariusza są obowiązkowe).
- Rozstrzygnięte przypadki eksportowane do `/fixtures` (klatki przed i po, odczyt systemu, poprawna odpowiedź).

## Konwencje

- Identyfikatory w kodzie po angielsku, komunikaty dla użytkownika po polsku.
- Typy zdarzeń i DTO tylko z `packages/schema`, bez duplikowania ich w innych pakietach.
- Każda zmiana w `engine` wymaga testów (bust, double-out, checkouty, przypadki brzegowe: tura krótsza niż 3 rzutki, rzutka po końcu meczu, 4. rzutka w turze).
- Statystyki liczone z tabeli rzutek, a nie z osobno utrzymywanych liczników.
- Zdarzenia audio wyzwalane przez zdarzenia domenowe silnika, nie przez kliknięcia w UI.
- Głos i efekty są domyślnie włączone na każdym urządzeniu (decyzja 2026-10-20: z odczytem wyniku gra się lepiej). Bez wyznaczonego „audio hosta”: na drugim ekranie gracz wyłącza głos ręcznie przełącznikiem.

## Komendy

```
nvm use             # Node 24 z .nvmrc
pnpm install
pnpm test           # testy we wszystkich pakietach (Vitest)
pnpm typecheck      # tsc w każdym pakiecie
pnpm lint           # ESLint na całym repo
```

- Nowy pakiet: `packages/<nazwa>` z `package.json` (skrypty `test` i `typecheck`) i `tsconfig.json` rozszerzającym `tsconfig.base.json`.
- CI (`.github/workflows/ci.yml`) uruchamia trzy checki: `test`, `typecheck`, `lint`.
- `pnpm dev` (backend + front) dojdzie z pakietami `server` i `web`.

## Praca w PR-ach (claude-rollout)

- Plan realizujemy przez [claude-rollout](https://boldare.github.io/claude-rollout/index.html): jeden PR na jeden krok, szczegóły i szkic PR-ów w `auto-score-dart-pomysly.md` (sekcja "Realizacja przez claude-rollout").
- Pracuj tylko na gałęzi swojego PR-a. Nie merguj, nie pushuj na `main`, nie publikuj.
- PR jest gotowy, gdy przechodzą `pnpm test`, `pnpm typecheck` i `pnpm lint` (te same checki co w CI).
- Niejasność w briefie lub decyzja spoza planu: zgłoś pytanie zamiast zgadywać.

## Detekcja: zasady pracy

- Agent nie widzi prawdziwej tarczy, więc o jakości decydują dane. Wszystkie zmiany w `vision` weryfikuj na zestawie z `/fixtures` (klatki "przed" i "po" rzucie, z oznaczonym segmentem i mnożnikiem).
- Po każdej zmianie uruchom skrypt ewaluacji i podaj trafność: ile poprawnych, ile "do potwierdzenia", ile błędnych.
- Nie obniżaj wyniku na zestawie testowym bez wyraźnej zgody.
- Ustawienia kamery na sztywno: bez autofocusa, auto-ekspozycji i auto-balansu bieli.
- Brak pewności oznacza `pending`, a nie zgadywanie.

## Otwarte decyzje

- Drugi tryb gry po X01: Cricket czy Around the Clock (decyzja odłożona).
- Głos: tylko wynik tury, czy też imię gracza; osobny komunikat `game_shot`.
- Weryfikacja: margines `near_wire` (mm czy px); zapisywanie klatek (domyślnie włączone czy opcjonalne, jak długo przechowywać).
- Zestaw testowy dla detekcji: kto i kiedy nagrywa klatki z tarczy.
- Zabawa: zasada wyjścia (robocze założenie: do wyboru w kreatorze, domyślnie double-out).
