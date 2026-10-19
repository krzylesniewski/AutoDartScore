# P21-P23: nagrane wyniki, efekt kliknięcia klawiatury, statystyki na telefonie

Trzy niezależne zadania (decyzja 2026-10-20). Mogą iść równolegle: P21 dotyczy audio, P22 klawiatury na ekranie gry, P23 ekranów statystyk i górnego paska. Wspólne zasady z `design/rwd.md` obowiązują dalej.

## P21: nagrane wyniki zamiast syntezatora mowy

**Cel:** wynik tury i komunikaty o zdarzeniach odtwarzamy z nagrań, a nie z Web Speech API. Tylko wyniki i zdarzenia, **bez dodatkowych komentarzy** (katalog `comments` z generatora nie wchodzi do aplikacji).

**Nagrania (już w repo):**
- `packages/web/public/audio/pl/scores/<n>.mp3`: wynik tury od 0 do 180. Jest 172 pliki; brakuje 163, 166, 169, 172, 173, 175, 176, 178 i 179, bo tych sum nie da się rzucić trzema lotkami.
- `packages/web/public/audio/pl/events/`: `bust_1.mp3`, `bust_2.mp3`, `bust_3.mp3`, `game_shot.mp3`, `winner_1.mp3`, `winner_2.mp3`.
- Format: MP3, 44,1 kHz, mono, 128 kb/s. Wygenerowane skryptem `spikes/voice/generate.mjs` (ElevenLabs), teksty w `spikes/voice/lines.mjs`.

**Które nagranie kiedy** (ta sama kolejność ważności co dziś w `announcementFor`):
1. Zwycięzca meczu (`match_won`) albo 1. miejsce w zabawie (`player_finished` z `place` 1): losowo `winner_1` albo `winner_2`.
2. Bust: losowo `bust_1`, `bust_2` albo `bust_3`.
3. Wygrany leg, który nie kończy meczu (`leg_won` bez `match_won`), albo kolejne miejsce w zabawie (`player_finished` z `place` > 1): `game_shot` zamiast odczytu sumy tury.
4. Zwykła tura (`turn_completed`): `scores/<total>.mp3`.

**Zasady:**
- Jedna rzutka daje najwyżej jedno nagranie, jak dziś jeden komunikat. Nowe nagranie przerywa poprzednie.
- Efekty dźwiękowe (bust, fanfary) zostają bez zmian, a nagranie czeka na koniec efektu tak jak dziś głos.
- **Zapas:** gdy nagrania nie ma albo nie da się go odtworzyć (błąd sieci, blokada autoodtwarzania), czytamy ten sam komunikat przez Web Speech API, jak dziś. Aplikacja nigdy nie milknie przez brak pliku.
- Przełącznik „Głos” działa jak dziś: wyłączony głos wyłącza też nagrania. Bez nowych ustawień (np. wyboru między nagraniem a syntezatorem).
- Wynik czyta tylko urządzenie, które dziś czyta (audio host). Bez zmian w serwerze i w schemacie.
- Nagrania zdarzeń ładujemy z góry przy starcie ekranu gry; wyniki mogą się ładować przy pierwszym użyciu (przeglądarka je potem trzyma w pamięci podręcznej).

**Podział kodu:**
- `packages/audio`: czysta funkcja wybierająca nagranie dla paczki zdarzeń (ścieżka pliku i tekst zapasowy), z losowaniem przekazywanym z zewnątrz, żeby testy były powtarzalne. Bez I/O.
- `packages/web/src/audio`: odtwarzacz nagrań (np. `HTMLAudioElement` albo Web Audio) z zapasem na `web-speech-speaker`, podpięty w `use-announcer.ts` w miejsce samego syntezatora.

**Testy:** mapowanie zdarzeń na nagrania (każdy z czterech przypadków, losowanie, brakujący plik daje zapas), przerwanie poprzedniego nagrania, zapas na Web Speech przy błędzie odtwarzania.

**Poza zakresem:** komentarze po wyniku, imię gracza w komunikacie, nowe ustawienia, zmiany w serwerze.

## P22: efekt kliknięcia w klawiaturę wyników

**Problem:** na telefonie i tablecie dotknięcie przycisku klawiatury (1-20, 25, Miss, S/D/T) nie daje żadnej reakcji. Przyciski w `packages/web/src/components/Keypad.tsx` nie mają stanu wciśnięcia, a dotyk jest za krótki, żeby zobaczyć zmianę stanu na ekranie. Gracz nie wie, czy trafienie się zapisało.

**Zmiana (tylko wygląd i odczucie dotyku, bez zmian w logice wpisu):**
1. **Stan wciśnięcia** na wszystkich przyciskach klawiatury: jaśniejsze tło (`--color-surface-active`), ramka `--color-text` i lekkie zmniejszenie (ok. 96%), przejście ok. 80 ms. Działa myszą i dotykiem.
2. **Działanie na iOS:** Safari pokazuje `:active` tylko przy obsłudze dotyku, więc stan wciśnięcia trzeba wyzwalać zdarzeniami wskaźnika (`pointerdown`/`pointerup`/`pointercancel`) albo dodać obsługę `touchstart`. Dodatkowo `touch-action: manipulation` (bez opóźnienia i przybliżania przy szybkich dotknięciach) i wyłączone systemowe podświetlenie dotyku (`-webkit-tap-highlight-color: transparent`), żeby nie mieszało się z naszym stanem.
3. **Potwierdzenie po trafieniu:** przycisk, który zapisał trafienie, mignie ramką w kolorze akcentu przez ok. 200 ms, także gdy dotyk był bardzo krótki.
4. **Ograniczony ruch:** przy `prefers-reduced-motion` bez zmniejszania, zostaje tylko zmiana koloru.
5. Przyciski nieaktywne (`disabled`) nie reagują.

**Testy:** wciśnięcie (`pointerdown`) nadaje stan wciśnięcia, a puszczenie go zdejmuje; po trafieniu przycisk dostaje mignięcie, które znika po czasie (sztuczne zegary); nieaktywny przycisk nie reaguje.

**Poza zakresem:** wibracje, dźwięk kliknięcia, zmiana układu klawiatury.

## P23: statystyki czytelne na telefonie

Obserwacje z 375×812 (iPhone) na prawdziwych danych, ranking `#/stats` i karta gracza `#/stats/:playerId`:

1. **Górny pasek (`AppNav`) zajmuje 3 wiersze, ok. 140 px:** logo, cztery pozycje nawigacji zawinięte w dwa rzędy (z „Ustawienia wkrótce”) i stan kamery i głosu.
2. **Na karcie gracza przewijana treść nachodzi na pasek:** np. tytuł „STATYSTYKI” i przyciski filtrów pod „Ustawienia”. Prawdopodobna przyczyna: `<main>` karty gracza w `StatsScreen.tsx` nie ma `min-h-0 flex-1` (ranking je ma), więc nie przewija się w swoim kontenerze. Do potwierdzenia przy wdrożeniu.
3. **Link „RANKING” nachodzi na tytuł** na karcie gracza.
4. **Filtry zajmują dużo miejsca:** typ gry zawija się do dwóch rzędów, lista graczy też.
5. **Kafle statystyk gracza w dwóch kolumnach:** długie etykiety („ŚREDNIA (3 RZUTKI)”, „NAJWYŻSZE ZAMKNIĘCIE”) łamią się w różnej liczbie linii, a wartość „0.9% (1/110)” zawija się.
6. **Liczby z kropką** (`18.38`, `0.9%`) zamiast polskiego przecinka.
7. **Wiersze historii gier** są wysokie: data w osobnej kolumnie zabiera szerokość.

**Zmiany (tylko wygląd, te same dane):**
1. **Kompaktowy górny pasek poniżej `sm` (640 px):** jeden wiersz z logo i nawigacją przewijaną w poziomie (bez zawijania). Stan kamery i głosu jako same kropki z etykietą dostępną dla czytnika (`aria-label`), „Ustawienia wkrótce” ukryte na telefonie. Wysokość paska do 64 px plus bezpieczny margines systemu. Dotyczy wszystkich ekranów, bo pasek jest wspólny; na tablecie i monitorze bez zmian.
2. **Brak nachodzenia treści na pasek** na karcie gracza: treść przewija się pod paskiem w swoim kontenerze, tak jak w rankingu.
3. **Link do rankingu** na karcie gracza jako osobny wiersz nad nagłówkiem („← Ranking”), bez nachodzenia na tytuł.
4. **Filtry w jednym rzędzie:** typ gry jako przełącznik segmentowy (jak w ekranie startowym A2), a wybór gracza jako rząd przewijany w poziomie. Cele dotykowe ≥ 44 px.
5. **Statystyki gracza na telefonie jako lista:** etykieta po lewej, wartość po prawej, jeden wiersz na statystykę. Wartość się nie zawija; dopisek typu „(1/110)” mniejszy, pod wartością. Na tablecie i monitorze zostaje siatka.
6. **Polski format liczb** we wszystkich statystykach: przecinek dziesiętny (`18,38`, `0,9%`), np. przez `Intl.NumberFormat('pl-PL')` w `game/format-stat.ts`.
7. **Wiersz historii gier na telefonie:** data w linii z opisem (np. „Mecz 1v1 · 301 · wczoraj”), odznaka wyniku i przycisk „Szczegóły” w jednym rzędzie pod spodem.

**Kryteria akceptacji:** przy 375×812 i 390×844 brak poziomego przewijania strony i brak nachodzenia treści na pasek; górny pasek do 64 px; wszystkie wartości w jednej linii; tablet i monitor wyglądają jak dziś (poza przecinkiem w liczbach). Istniejące testy przechodzą, nowe testy dla formatu liczb.

**Poza zakresem:** nowe statystyki, kafle i filtry, zmiany w API, wyróżnienie graczy poniżej progu legów.
