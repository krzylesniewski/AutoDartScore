# AUTO Score dla Darta: zbieranie pomysłów

> Status: faza pomysłów, podjęte pierwsze decyzje (patrz sekcja "Decyzje").

## Decyzje

- **MVP na jednej kamerze USB.** Dwie kamery dopiero w późniejszym etapie.
- **Detekcja jako osobny, wymienny moduł**, który tylko publikuje zdarzenia trafień do API. Reszta systemu nie wie, czy trafienie przyszło z kliknięcia, jednej kamery czy dwóch.
- **Symulator trafień** (przyciski/skrypt) jako pierwszy krok, żeby front/BE/API dało się testować bez sprzętu.
- **Ręczna korekta w UI** obowiązkowa, bo jedna kamera będzie się mylić przy zasłanianiu rzutek.
- **"Rzut do weryfikacji":** rzutka może być oznaczona do sprawdzenia automatycznie (niska pewność, grot przy drucie, rozbieżność detektorów) albo ręcznie przez gracza. System zapisuje klatki i alternatywne odczyty, a po weryfikacji dane trafiają do zestawu testowego.
- **Na start tylko X01** (301/501/701 do wyboru w ustawieniach). Drugi tryb (Cricket lub Around the Clock) dopiero po ukończeniu X01.
- **1-4 graczy.**
- **Zapis statystyk graczy**, klasyczne dla darta.
- **Głosowy odczyt wyniku po każdej turze** (np. "sto", "czterdzieści pięć") oraz osobne komunikaty "bust" i "winner".
- **Całość w TypeScripcie** (backend, silnik gry, front, detekcja w Node + opencv-wasm). Detekcja za interfejsem zdarzeń, więc w razie potrzeby da się ją przepisać na Pythona bez ruszania reszty.
- **Backend jest jedynym źródłem prawdy o stanie gry.** Kamera, symulator i front są klientami wysyłającymi zdarzenia.
- **Modularny monolit** zamiast mikroserwisów, zapis zdarzeniowy (lekki event sourcing), każda rzutka zapisywana osobno.
- **Local-first:** na start backend, baza i kamera działają na Macu autora (LAN, bez internetu), później na mini PC. Online (konta, zdalny multiplayer) to osobny, późniejszy etap.
- **Baza: SQLite** za cienką warstwą dostępu do danych (Drizzle lub Kysely), z możliwością przejścia na PostgreSQL/Supabase przy wersji online.
- **Reguły X01:** domyślnie double-out, mecz do dwóch wygranych legów (best of 3).
- **Trzy typy gry:** **mecz 1v1** (format turniejowy, best of N legów, później drabinki), **zabawa 3-4 graczy** (jeden leg, gra toczy się o kolejne miejsca) i **trening solo** (Free run oraz Solo 501). Mecze i zabawa liczą się do statystyk razem, z możliwością filtrowania po typie. Free run nie wchodzi do statystyk.
- **Projekt rozwijany po godzinach (miesiące pracy):** pionowe plasterki, symulator przed kamerą, każdy etap kończy się czymś działającym.
- **Kod w ok. 95% tworzony przez Claude Code**, więc kluczowe są: testy, wspólne typy, `CLAUDE.md`, małe kroki i zestaw testowy z klatkami dla detekcji.

## Dwa warianty "auto score"

**A. Rozpoznawanie rzutek kamerą (computer vision).**
Wersja ambitna, jak Autodarts. Kamery patrzą na tarczę, system wykrywa wbite rzutki i sam liczy punkty.

**B. Automatyczne liczenie wyniku.**
Gracz klika lub wpisuje, co trafił (np. T20, D16), a aplikacja zajmuje się resztą: odejmowaniem, bustami, checkoutami, statystykami.

Wariant B jest fundamentem pod A. Moduł detekcji po prostu podaje trafienia do silnika gry.

## Architektura

- **Silnik gry (core):** czysta logika, bez UI. Zasady double-in/out, bust, legi i sety. Osobny pakiet z testami. Wysyła zdarzenia (np. `turn_completed`, `bust`, `leg_won`, `match_won`).
- **Backend:** API plus WebSockety do live score (np. TV/tablet pokazuje wynik na żywo).
- **Frontend:** widok gry (duże przyciski, tablet-friendly), widok publiczny do oglądania meczu, panel statystyk.
- **Konta i historia:** profile graczy, historia meczów, wykresy formy.
- **Warstwa audio:** reaguje na zdarzenia silnika, nie na kliknięcia w UI.

Łańcuch do przetestowania w MVP:

```
źródło trafień (symulator / kamera) → API → silnik gry → WebSocket → front
                                                      └→ zdarzenia → audio
```

## Stack (decyzja)

| Warstwa | Wybór |
|---|---|
| Język | TypeScript w całym projekcie (monorepo) |
| Frontend | React (Vite lub Next.js), tarcza jako SVG |
| Backend | Node: Fastify lub NestJS, REST + WebSocket |
| Silnik gry | Osobny pakiet TS, współdzielony przez backend i front |
| Schemat zdarzeń | Zod / JSON Schema jako źródło prawdy dla typów |
| Baza | SQLite na MVP (Drizzle/Kysely), później ewentualnie PostgreSQL/Supabase; Redis niepotrzebny |
| Detekcja | Node + opencv-wasm, ewentualnie onnxruntime (model ONNX) |
| Audio | Web Speech API na start, potem gotowe klipy |

---

# UI/UX

## Tryby gier

- **Tryb 1: X01 (501)** jako główny. Punkty startowe (301/501/701) i double-out jako ustawienia, bez osobnych trybów.
- **Tryb 2 (do wyboru):**
  - **Cricket**: klasyk, własne statystyki (MPR), ale inny widok (tablica 15-20 + Bull z domknięciami).
  - **Around the Clock**: bardzo prosty, dobry do treningu, świetny przy 1 graczu.

Rekomendacja: 501 pierwszy, drugi tryb dopiero gdy 501 działa end-to-end. Szybkość: Around the Clock. "Prawdziwa" gra: Cricket.

## Gracze 1-4

- **1 gracz:** tryb treningowy (średnia, rekordy, brak przeciwnika).
- **2-4 graczy:** rzucający zawsze na górze paska wyników, pozostali pod nim z widocznym wynikiem (szczegóły w sekcji "Front: decyzje").
- **Wybór graczy:** z zapisanych profili albo jako "gość" (bez zapisu statystyk).
- **Kto zaczyna:** losowanie. "Bull-off" (rzut do środka, bliżej wygrywa) to pomysł na później.

## Flow aplikacji

1. Ekran startowy: Nowa gra / Statystyki / Ustawienia (kamera, dźwięk).
2. Wybór trybu.
3. Gracze (1-4) i kolejność.
4. Ustawienia gry (punkty startowe, double-out, liczba legów).
5. Gra.
6. Podsumowanie meczu (wynik, najlepsze momenty, szybki rewanż).

## Ekran gry (serce UX)

Ostateczny układ ekranu: sekcja "Front: decyzje". Poniżej wymagania ogólne.

- **Pozostały wynik** pokazany tylko raz, w pasku wyników, czytelny z 2-3 m (monitor, później tablet w poziomie).
- **3 sloty rzutek bieżącej tury** (np. T20, 5, D8). Tap na slot to korekta, a trafienia ze statusem "do potwierdzenia" (kamera) mogą się tam podświetlać.
- **Podpowiedź checkoutu**, gdy zostaje ≤170.
- **Średnia na żywo**, liczba legów/setów, kto rzuca.
- **Cofnij (undo)** zawsze na wierzchu.
- **Wpis ręczny:** klawiatura z przyciskami 1-20, 25 (Bull) i Miss oraz przełącznikiem mnożnika S/D/T (na ekranie gry nie ma podglądu tarczy). Spójne z danymi z kamery, bo oba źródła dają ten sam format trafienia.
- **Bust i zwycięski leg** jako wyraźne, krótkie animacje, nie modale blokujące grę.
- **Przycisk "nowa runda"** (awaryjny reset, gdy kamera nie wykryje wyjęcia rzutek) i mały wskaźnik stanu kamery.
- Duże elementy dotykowe i wysoki kontrast, bo gra toczy się w ruchu, z kilku metrów.

## Rzut do weryfikacji

Opcja dla rzutek, których wynik jest niepewny. Powód: kamera (albo kilka detektorów) potrafi odczytać ten sam grot inaczej, zwłaszcza tuż przy drucie albo przy skupieniu rzutek (np. 5 vs 12, T20 vs 20).

### Kiedy rzutka trafia do weryfikacji

- **Automatycznie:**
  - niska pewność (`confidence` poniżej progu),
  - grot blisko drutu (odległość od granicy segmentu mniejsza niż ustalony margines),
  - rozbieżność między detektorami lub kamerami,
  - podejrzenie zasłonięcia grotu przez inne rzutki.
- **Ręcznie:** gracz tapuje slot rzutki i wybiera "Oznacz do weryfikacji", gdy widzi, że odczyt jest podejrzany.

### Co widzi gracz

- Slot rzutki w turze podświetlony (np. żółta ramka i ikona ostrzeżenia).
- Po tapnięciu ekran weryfikacji:
  - **powiększony kadr** z zaznaczonym punktem grotu na tarczy,
  - **kandydaci** jako duże przyciski (np. `5` i `12`, z orientacyjną pewnością), posortowani od najbardziej prawdopodobnego,
  - **tarcza SVG** do wskazania dowolnego innego segmentu,
  - przyciski: "Potwierdź" (wybór kandydata) i "Popraw" (inny segment).
- Weryfikacja ma zajmować jedno-dwa dotknięcia.

### Dwa tryby obsługi

| Tryb | Zachowanie | Kiedy |
|---|---|---|
| **Potwierdź teraz** (domyślny) | Tura nie zamyka się i wynik nie jest odczytywany, dopóki rzutka nie zostanie rozstrzygnięta | Gra w trakcie, wynik musi być pewny |
| **Zweryfikuj później** | Gra toczy się dalej z odczytem tymczasowym (najbardziej prawdopodobny kandydat), a rzutka trafia do kolejki | Gracze nie chcą przerywać, weryfikacja po legu lub meczu |

W trybie "później" głos czyta wynik tylko wtedy, gdy w turze nie ma nierozstrzygniętych rzutek (albo dodaje zastrzeżenie, np. "około sto" do ustalenia). Statystyki liczą rzutki tymczasowe z oznaczeniem i przeliczają się po weryfikacji. Jeśli weryfikacja zmieni wynik, przeliczane są: tura, wynik lega i ewentualny checkout, więc silnik musi to obsłużyć przez odtworzenie zdarzeń.

### Kolejka weryfikacji

- Lista oznaczonych rzutek po meczu (lub w trakcie, w osobnym widoku).
- Dla każdej: kadr przed i po rzucie, kandydaci, powód oznaczenia, aktualny odczyt.
- Po rozstrzygnięciu status przechodzi w `confirmed` albo `corrected`.

### Dane zbierane przy weryfikacji

```json
{
  "throwId": "t_881",
  "status": "pending",
  "review": {
    "reason": "near_wire",
    "flaggedBy": "system",
    "candidates": [
      { "segment": 5,  "multiplier": 1, "probability": 0.48 },
      { "segment": 12, "multiplier": 1, "probability": 0.45 },
      { "segment": 20, "multiplier": 3, "probability": 0.04 }
    ],
    "frames": { "before": "frames/m123/t881_before.jpg", "after": "frames/m123/t881_after.jpg" },
    "tip": { "x": 412, "y": 238 },
    "resolved": { "segment": 12, "multiplier": 1, "by": "player", "at": "2026-10-15T18:31:02Z" }
  }
}
```

Powody: `low_confidence`, `near_wire`, `detector_disagreement`, `occlusion`, `manual`.

### Pętla uczenia: zweryfikowane rzutki jako zestaw testowy

Każda rozstrzygnięta weryfikacja to **oznaczony przykład z prawdziwej tarczy**: klatki przed i po, odczyt systemu i poprawna odpowiedź od człowieka. Takie przypadki najlepiej eksportować do `/fixtures` (zwłaszcza te, w których system się mylił lub wahał), bo to najtrudniejsze i najcenniejsze przypadki. Dzięki temu:

- skrypt ewaluacji detekcji dostaje realne, trudne przykłady,
- można mierzyć, jak często system się mylił i na jakich granicach segmentów,
- próg `near_wire` i `confidence` da się stroić na danych, a nie na wyczucie.

Warunek: zapisywanie klatek wymaga zgody i przechowywania obrazów lokalnie (local-first), z możliwością wyłączenia.

### Reguły

- Ręczna decyzja gracza zawsze wygrywa z detekcją.
- Weryfikacja jest zdarzeniem w logu (`throw_flagged`, `throw_verified`), więc da się ją cofnąć i odtworzyć.
- Rzutka oznaczona do weryfikacji nie jest nigdy po cichu "zgadywana": albo czeka na decyzję, albo ma jawne oznaczenie tymczasowości.

## Statystyki klasyczne dla darta

**X01:**
- Średnia na 3 rzutki (3-dart average) i średnia z pierwszych 9 rzutek (first 9)
- Liczba 180, 140+, 100+, 60+
- Najwyższy checkout i % checkoutów (trafione double'y / próby)
- Najlepszy leg (najmniej rzutek) i średnia liczba rzutek na leg
- Wygrane legi/mecze, % wygranych (sety po ich wprowadzeniu)
- Najwyższy wynik w turze

**Cricket (jeśli wejdzie):** MPR (marks per round).

**Prezentacja:** karta gracza (kluczowe liczby), wykres formy (średnia z ostatnich meczów), porównanie head-to-head, historia meczów ze szczegółami.

**Uwaga projektowa:** zapisywać **każdą rzutkę** (segment, mnożnik, kolejność, czas), nie tylko wynik tury. Z takich danych wyliczysz wszystko, także rzeczy, o których dziś nie pomyślisz. Mecze gości można zapisywać bez przypisania do profilu.

---

# Głos i dźwięki

## Założenie

Po zakończeniu tury z głośników leci prosty odczyt wyniku: "sto", "czterdzieści pięć". Osobne komunikaty dla "bust" i "winner".

## Skąd brać głos

| Opcja | Plusy | Minusy |
|---|---|---|
| **Web Speech API** (`speechSynthesis`) | Zero kosztów i plików, działa od razu | Jakość i dostępność polskiego głosu zależą od urządzenia |
| **Nagrane klipy audio 0-180** | Identyczny, szybki dźwięk wszędzie, offline, zero opóźnienia | Trzeba przygotować ok. 190 plików (wygenerować raz TTS-em lub nagrać własny głos) |
| **TTS w chmurze lub lokalny** (np. Piper) | Lepsza jakość niż systemowy głos | Dodatkowa zależność, przy chmurze opóźnienie i koszt |

Na MVP wystarczy Web Speech API. Klipy można dołożyć później, bo za interfejsem `play(event)` zmiana jest niewidoczna dla reszty aplikacji.

## Zestaw klipów

**Podstawowe:**
- `0.mp3` ... `180.mp3`: wynik tury
- `bust`: przebite
- `winner`: zwycięzca meczu
- `game_shot`: domknięcie lega

**Opcjonalne:**
- `180` jako osobny, bardziej entuzjastyczny klip
- `set_won`, `match_won`
- `checkout_available` (np. "możesz zamknąć")
- `next_player` (gong lub krótki sygnał zmiany gracza)
- Wiele wariantów tego samego klipu (`winner_1`, `winner_2`, ...), losowanych
- Efekty dźwiękowe (np. fanfara przy `winner`)

## Struktura plików i manifest

```
audio/
  pl/
    scores/       0.mp3 ... 180.mp3
    events/       bust.mp3, winner.mp3, game_shot.mp3
    names/        (opcjonalnie, imiona graczy)
  en/
    ...
```

```json
{
  "turn_completed": "scores/{total}",
  "bust": "events/bust",
  "leg_won": "events/game_shot",
  "match_won": "events/winner"
}
```

Silnik gry wysyła tylko zdarzenia, a warstwa audio decyduje, który plik odtworzyć. Nowy język lub głos to wymiana folderu, bez zmian w kodzie.

## Kiedy odczytywać wynik

Głos wyzwalany ze **zdarzenia silnika gry**, nie z kliknięcia w UI. Dzięki temu działa tak samo przy ręcznym wpisywaniu, symulatorze i kamerze.

- **Tura krótsza niż 3 rzutki** (checkout, bust): odczyt przy zamknięciu tury.
- **Bust:** "bust" zamiast sumy tury.
- **0 punktów:** "zero".
- **Domknięcie lega:** `game_shot` albo po prostu wynik (do decyzji).
- **Priorytet:** `winner` i `bust` przerywają zwykły odczyt, nie czekają w kolejce.

## Kamera a głos

- Nie czytać wyniku, jeśli którekolwiek trafienie w turze ma status `do potwierdzenia`. Poczekać na potwierdzenie lub zamknięcie tury.
- Wykrycie wyjęcia rzutek (ręka w kadrze) może być sygnałem końca tury.
- Korekta po odczytaniu powinna być rzadka i oznaczona (np. krótkie "poprawiono" z nowym wynikiem).

## Szczegóły techniczne

- **Autoplay w przeglądarkach:** dźwięk działa po pierwszej interakcji użytkownika, więc kliknięcie "Start gry" odblokowuje audio.
- **Jedno urządzenie odtwarza dźwięk** (audio host), żeby przy tablecie i TV wynik nie był czytany dwa razy.
- **Kolejka i anulowanie:** nowa tura lub "cofnij" przerywa trwający odczyt.
- **Ustawienia:** włącz/wyłącz, głośność, wybór głosu, tempo.
- **Język:** na start polski, mapowanie liczb → tekst/plik w osobnym module, żeby łatwo dodać angielski.

---

# Detekcja: jedna kamera USB (MVP)

## Ustawienie

- Z boku, pod kątem ok. 30-45° względem osi tarczy i lekko z góry (nie na linii rzutu).
- Cała tarcza w kadrze z niewielkim marginesem.
- Stabilny uchwyt: kamera nie może się ruszyć po kalibracji.
- Równe światło z góry, bez ostrych cieni i odbić.
- Wyłączony autofocus, auto-ekspozycja i auto-balans bieli.
- Rozdzielczość 1080p (lub 720p z MJPG, jeśli USB się dławi).

## Sprzęt i pomiary (2026-10-16)

- **Kamera:** Logitech HD Pro Webcam C920 (USB `046d:0892`), jedna, podpięta do Maca przez hub USB (link 480 Mb/s, pełne USB 2.0). Na stojaku, tarcza przyklejona na stałe.
- **Decyzja:** zostajemy przy jednej kamerze na Macu. Druga dopiero w etapie 3.
- **Klatki na Macu:** AVFoundation udostępnia dla C920 tylko formaty nieskompresowane (`uyvy422` itd.), bez MJPEG i H.264. Zmierzone: 1080p ≈ 5 kl./s, 720p ≈ 10 kl./s, w obu przypadkach ≈ 20 MB/s, czyli limit nieskompresowanego obrazu na USB 2.0. 30 kl./s z ulotki dotyczy trybów skompresowanych.
- **Decyzja:** 1080p przy 5 kl./s. Analizujemy nieruchome klatki przed i po wbiciu, więc liczba klatek ma małe znaczenie, a rozdzielczość dużą (≈ 3 px/mm, pierścień double ≈ 24 px). Na mini PC (Linux, v4l2) da się włączyć MJPEG i 30 kl./s.
- **Kamerę wskazujemy po nazwie** (`"HD Pro Webcam C920:none"`), a nie po indeksie, bo indeksy AVFoundation zmieniają się po restarcie.
- **Uprawnienia:** zgodę na kamerę dostaje aplikacja, która uruchamia proces. Procesy uruchamiane przez agenta w Claude Code nie dostają klatek, nawet bez sandboxa; polecenia uruchamiane przez użytkownika (`!` lub Terminal) dostają. Agent pracuje więc na nagraniach, a żywą kamerę uruchamia człowiek.
- **Źródło klatek w developmencie:** nagranie wideo (`spikes/camera/*.mp4`, poza gitem) za tym samym interfejsem `CameraSource` co żywa kamera. Komenda nagrania:
  `ffmpeg -hide_banner -f avfoundation -framerate 30.000030 -video_size 1920x1080 -pixel_format uyvy422 -i "HD Pro Webcam C920:none" -t 180 -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p spikes/camera/session-NN.mp4`
- **Rzut obok tarczy i odbicie:** kamera ich nie zobaczy przy żadnej liczbie klatek. Obsługa przez ręczny wpis (Miss) i przycisk Nowa runda.

## Spike: wykrywanie wbić na nagraniu (2026-10-16)

Skrypt `spikes/camera/detect-events.mjs` (Node + ffmpeg, bez OpenCV) na `session-01.mp4` (76 s, 3 rundy po 3 lotki):

- **Wynik:** 9/9 lotek wykrytych jako `candidate_dart` (także lotka na obudowie), 2/2 wyjmowania jako `hand_or_removal`, fałszywe zmiany oznaczone jako `global_change` (start kamery, autofocus) albo `noise` (drobny dryf światła). Progi dobrane na tym samym nagraniu, więc to wynik orientacyjny; potrzebne drugie nagranie do sprawdzenia.
- **Wniosek 1: rzut to skok, nie ruch.** Przy 5 kl./s lotka pojawia się z klatki na klatkę. Trzeba porównywać z ostatnią stabilną klatką odniesienia, a nie tylko z poprzednią klatką.
- **Wniosek 2: autofocus i ekspozycja przeszkadzają.** Autofocus daje zmiany na konturach całej tarczy, ekspozycja rozmyte pojaśnienia. Rozróżniamy je po rozproszeniu zmiany (ile kratek kadru się zmieniło), ale docelowo trzeba je wyłączyć w kamerze. Na macOS AVFoundation tego nie udostępnia: do sprawdzenia narzędzie UVC (np. `uvc-util`) albo aplikacja Logitecha.
- **Wniosek 3: wyjmowanie lotek rozpoznajemy po długości ruchu** (ręka w kadrze dłużej niż ok. 1,5 s).
- **Prawdziwe trafienia** (od gracza) są w `spikes/camera/session-01.labels.json`: tura 1: 5, 20, 1; tura 2: 5, miss (lotka na obudowie), 1; tura 3: 20, 20, 20. Każde wykryte wbicie odpowiada jednej lotce, w tej samej kolejności.
- **Wniosek 4: odczyt segmentu „na oko” z tego ujęcia jest zawodny.** Kamera patrzy z boku, tarcza jest obrócona (na górze kadru 14 i 9, a 20 po prawej), a trzonek i lotka zasłaniają miejsce wbicia grotu. Potrzebna kalibracja (homografia do płaskiej tarczy z orientacją segmentów) i lokalizacja grotu, a nie środka lotki.
- **Następny krok detekcji:** maska tarczy (analiza tylko obszaru tarczy), drugie nagranie z listą prawdziwych trafień, potem lokalizacja grotu.

## Ścieżka prototypu

1. Podgląd i zapis klatek z kamery (OpenCV), ustawienia na sztywno.
2. Kalibracja: 4 punkty na tarczy, homografia do "płaskiej" tarczy (na start ręczne klikanie punktów). Opcjonalnie kalibracja dystorsji obiektywu.
3. Wykrycie nowej rzutki: różnica klatek przed i po rzucie, lokalizacja grotu (klasyczny OpenCV na start, YOLO gdy zabraknie jakości).
4. Mapowanie punktu grotu na kąt i odległość od środka, a stąd na segment.
5. Wysłanie zdarzenia do API (to samo co symulator).
6. Wykrywanie wyjmowania rzutek (ręka w kadrze) i reset rundy, z przyciskiem "nowa runda" jako awaryjnym.

## Wymagania na MVP

- Pole `confidence` w zdarzeniu i status `do potwierdzenia` przy niskiej pewności.
- Ręczna korekta trafienia jednym kliknięciem.

## Kryterium sukcesu

Nie "100% trafnych detekcji", tylko: rzucasz rzutkę, w aplikacji pojawia się trafienie (poprawne albo do poprawienia jednym kliknięciem), a wynik leci przez API na front na żywo.

## Trudne przypadki

- Rzutki wbite blisko siebie lub w tym samym segmencie (zasłanianie, "Robin Hood").
- Odbicia i cienie od oświetlenia.
- Grot tuż przy cienkim drucie, na granicy segmentów.

## Kamera USB czy telefon

| | Kamerka USB | Telefon |
|---|---|---|
| Podłączenie | Plug and play (UVC) | Aplikacja (DroidCam, Iriun) lub własny stream |
| Opóźnienie | Niskie, stałe | Wyższe, zależne od sieci |
| Praca ciągła | Bez problemu | Bateria, nagrzewanie, wygaszanie ekranu |
| Kontrola ustawień | Pełna | Ograniczona przez aplikację |

Wybór na MVP: **kamera USB**. Telefon rozważyć, jeśli jakość obrazu okaże się niewystarczająca.

## Późniejszy etap: dwie kamery USB

- Po bokach tarczy, pod kątem ok. 60-90° względem siebie.
- Osobne porty USB (najlepiej różne kontrolery), 720p lub MJPG, kabel do ok. 3-5 m.
- Mapowanie kamer po ścieżce USB (udev), żeby nie zamieniały się po restarcie.
- Fuzja wyników: wybór trafienia z większą pewnością, a przy rozbieżności pokazanie graczowi do potwierdzenia.
- Synchronizacja klatek nie jest krytyczna, bo rzutka po wbiciu stoi nieruchomo.

---

# Backend i API

## Założenie

Backend jest jedynym źródłem prawdy o stanie gry. Kamera, symulator i front wysyłają zdarzenia, a backend liczy wynik i rozgłasza stan.

## Odpowiedzialności

- Przyjmowanie trafień ze źródeł (symulator, kamera, ręczny wpis).
- Silnik gry: wynik, bust, checkout, zmiana gracza.
- Rozgłaszanie stanu na żywo przez WebSocket (front, widok TV, audio).
- Persystencja: mecze, każda rzutka, profile graczy.
- Statystyki liczone z zapisanych rzutek.

## Architektura

Modularny monolit. Jedyny osobny proces to detekcja (inny cykl życia).

```
[Kamera USB] → [Moduł detekcji] ──HTTP/WS──┐
[Front: tarcza SVG / klawiatura] ──HTTP/WS─┼→ [Backend]
                                            │   ├ Silnik gry
                                            │   ├ API + WebSocket
                                            │   └ Persystencja + statystyki
[Front / TV / audio] ←── WebSocket (stan, zdarzenia) ┘
```

## Model danych

- **Player:** id, nazwa, avatar, data utworzenia.
- **Match:** tryb, ustawienia (501, double-out, liczba legów), status, uczestnicy w kolejności.
- **Leg:** numer, zwycięzca, czas.
- **Turn:** gracz, numer tury, suma, bust.
- **Throw (dart):** segment, mnożnik, punkty, kolejność w turze, czas, źródło, confidence, status (`confirmed`, `pending`, `corrected`), opcjonalne pole `review` (patrz sekcja "Rzut do weryfikacji").

Rzutka jako najmniejsza jednostka danych daje wszystkie statystyki z jednej tabeli.

## Zapis zdarzeniowy (lekki event sourcing)

Zapisujemy strumień zdarzeń (rzutka, korekta, cofnięcie, nowa runda), a stan meczu wynika z ich odtworzenia przez silnik.

- Undo i korekta to nowe zdarzenia, a nie grzebanie w danych.
- Odtworzenie meczu po restarcie lub awarii.
- Debugowanie detekcji: widać, co zgłosiła kamera i co zmienił gracz.
- Nowe statystyki można policzyć wstecz.

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

- `eventId` zapewnia idempotencję (ponowne wysłanie nie zdubluje rzutki).
- `segment` i `multiplier` są jednakowe dla wszystkich źródeł. Outer Bull = `segment: 25, multiplier: 1` (25 pkt), Bull = `segment: 25, multiplier: 2` (50 pkt, liczy się jako double przy double-out), miss = `segment: 0, multiplier: 0`. Mnożnik 3 dla segmentu 25 jest niedozwolony.
- Niska `confidence` oznacza status `pending` i wymaga potwierdzenia na froncie.

## API REST

| Metoda | Ścieżka | Cel |
|---|---|---|
| `GET/POST` | `/players` | Lista i tworzenie graczy |
| `POST` | `/matches` | Start meczu (tryb, gracze, ustawienia) |
| `GET` | `/matches/:id` | Aktualny stan meczu |
| `POST` | `/matches/:id/throws` | Nowa rzutka (kamera lub UI) |
| `PATCH` | `/matches/:id/throws/:throwId` | Korekta lub potwierdzenie rzutki |
| `POST` | `/matches/:id/throws/:throwId/flag` | Ręczne oznaczenie rzutki do weryfikacji |
| `POST` | `/matches/:id/throws/:throwId/verify` | Rozstrzygnięcie weryfikacji (potwierdź lub popraw segment) |
| `GET` | `/matches/:id/review-queue` | Rzutki oczekujące na weryfikację |
| `POST` | `/matches/:id/undo` | Cofnięcie ostatniej rzutki |
| `POST` | `/matches/:id/next-round` | Awaryjny reset tury ("nowa runda") |
| `GET` | `/players/:id/stats` | Statystyki gracza |
| `GET` | `/matches` | Historia meczów |

## WebSocket

Jeden kanał na mecz (`/matches/:id/live`). Serwer wysyła:

- `state_updated` (pełny lub przyrostowy stan),
- `throw_registered`, `throw_pending`, `throw_corrected`,
- `throw_flagged`, `throw_verified`,
- `turn_completed`, `bust`, `leg_won`, `match_won` (te same zdarzenia, na które nasłuchuje audio).

Po (re)connect klient pobiera pełny stan przez `GET`, a potem słucha przyrostów. Numer `sequence` pozwala wykryć utracone wiadomości.

## Zasady działania

- **Kolejność i spójność:** przetwarzanie sekwencyjne (kolejka na mecz), żeby kamera i ręczny wpis nie wyprzedziły się nawzajem.
- **Rzutka `pending`:** wchodzi do stanu, ale tura nie jest zamykana ani wynik odczytywany, dopóki nie zostanie potwierdzona. Bez automatycznego rozstrzygania po czasie (niepewna rzutka nie jest zgadywana); jedyną alternatywą jest tryb "zweryfikuj później" z jawnym odczytem tymczasowym.
- **Walidacja:** silnik odrzuca niemożliwe zdarzenia (rzutka po końcu meczu, 4. rzutka w turze).
- **Źródło ma wagę:** ręczna korekta zawsze wygrywa z kamerą.
- **Zdarzenia domenowe oddzielone od transportu:** silnik wypuszcza zdarzenia, a WebSocket i audio tylko je odbierają.

## Uwierzytelnianie

- **MVP lokalne:** brak logowania, wybór profilu z listy, token urządzenia dla modułu detekcji.
- **Później (online):** konta, sesje, uprawnienia, widok publiczny meczu przez link.

## Statystyki

- Na MVP liczone na żądanie z tabeli rzutek (zapytania SQL).
- Później zmaterializowane agregaty aktualizowane po zakończeniu meczu.
- Mecze gości zapisywane bez powiązania z profilem.

## Wdrożenie

Model **local-first**: backend, baza i detekcja na jednym mini PC lub laptopie przy tarczy, a front na tablecie i TV w tej samej sieci. Bez internetu, z minimalnymi opóźnieniami i bez wysyłania wideo do chmury. Wersja online (konta, zdalny multiplayer) to osobny etap na tym samym API.

---

# Język: całość w TypeScripcie

## Detekcja w JS

- **W przeglądarce:** `getUserMedia`, opencv.js (WASM), onnxruntime-web. Minus: karta musi być otwarta i na wierzchu (throttling kart w tle, usypianie ekranu).
- **W Node (wybór):** proces w tle na mini PC, klatki przez ffmpeg lub bibliotekę do kamer, przetwarzanie w opencv-wasm lub onnxruntime-node. Natywne bindingi OpenCV dla Node bywają kłopotliwe, więc lepiej WASM.
- Detekcja analizuje klatki po rzucie (przed/po), a nie 30 fps non stop, więc wydajność WASM powinna wystarczyć.

## Słabsze strony JS

- Mniej materiałów i przykładów o CV niż w Pythonie (większość tutoriali o detekcji rzutek jest w Pythonie).
- Wolniejsze prototypowanie eksperymentów z progami i filtrami.
- Trening modelu (jeśli kiedyś YOLO) i tak w Pythonie, ale gotowy model ONNX działa w JS.

## Koszt utrzymania: JS vs Python

| | Wszystko w JS | Backend/front w TS + detekcja w Pythonie |
|---|---|---|
| Języki i narzędzia | Jedno środowisko (npm) | Dwa (npm + pip/venv) |
| Build, CI, wdrożenie | Jeden pipeline | Dwa pipeline'y, dwa procesy |
| Zależności | Jedna rodzina | Python: numpy, wersje OpenCV, natywne biblioteki |
| Kontrakt | Wspólne typy w całym kodzie | JSON Schema jako źródło prawdy, generowanie typów |
| Prototypowanie CV | Wolniejsze | Szybsze |
| Wsparcie społeczności dla CV | Mniejsze | Duże |

Wybór języka detekcji jest odwracalny, bo moduł jest za interfejsem zdarzeń (HTTP + schemat). Wariant "całość w Pythonie" odradzany: dwa języki i brak współdzielenia silnika gry z frontem.

## Decyzja

Całość w TypeScripcie. Kod w ok. 95% tworzony przez Claude Code, więc przewagą jest jedna pętla feedbacku (`npm test`, typecheck, lint dla wszystkiego), wspólne typy jako siatka bezpieczeństwa i prostszy review.

---

# Praca z Claude Code

- **Silnik gry z gęstymi testami jednostkowymi** (bust, double-out, checkouty, edge case'y). Najłatwiejsza część do pełnej automatycznej weryfikacji.
- **Schemat zdarzeń jako źródło prawdy** (Zod/JSON Schema).
- **`CLAUDE.md` w repo** z architekturą, konwencjami, komendami testowymi i decyzjami (patrz osobny plik `CLAUDE.md`).
- **Małe, weryfikowalne kroki:** jedna funkcjonalność, testy, review, następny krok.
- **Człowiek trzyma decyzje i review.**

## Detekcja: dane są ważniejsze niż język

Agent nie "widzi" prawdziwej tarczy, więc kod może wyglądać dobrze, a w praktyce się mylić. Potrzebne:

1. **Zestaw testowy:** nagrane klatki "przed" i "po" rzucie z realnej tarczy, z oznaczoną poprawną odpowiedzią (segment, mnożnik). Zbiera go człowiek.
2. **Skrypt ewaluacji:** liczy trafność (ile poprawnych, ile "do potwierdzenia", ile błędnych), uruchamiany po każdej zmianie.
3. **Testy regresyjne** na tych klatkach.

## Struktura repo (monorepo TS)

```
/packages
  /engine      # silnik gry (czysty TS, testy)
  /schema      # kontrakt zdarzeń (Zod), współdzielony
  /server      # API + WebSocket + persystencja
  /web         # front (ekran gry, klawiatura wpisu, statystyki)
  /vision      # detekcja (Node + opencv-wasm), wysyła zdarzenia do API
  /audio       # klipy i mapowanie zdarzeń na dźwięki
/fixtures      # klatki testowe z tarczy z oznaczeniami
CLAUDE.md
```

## Realizacja przez claude-rollout

Plan realizujemy jako serię PR-ów przez [claude-rollout](https://boldare.github.io/claude-rollout/index.html): agenci Claude Code piszą brief i kod każdego PR-a, niezależny agent próbuje go podważyć, a bramka scala dopiero po zielonym CI i mojej akceptacji. Pasuje do zasad projektu: małe kroki, testy, człowiek trzyma decyzje i review.

**Co zostaje po mojej stronie:** plan (te dwa pliki), odpowiedzi na pytania agentów (`rollout note`), akceptacja każdego PR-a (review na GitHubie), pauza i zatrzymanie.

### Wymagania (stan na 2026-10-15)

| Wymaganie | Stan |
|---|---|
| Node 24+ | ✅ 24.22 przez nvm (`.nvmrc`); domyślny w nvm nadal 22 |
| git, gh zalogowany | ✅ |
| pnpm | ✅ 12.10 |
| `claude` na PATH | ⚠️ zainstalowany pod Node 22; pod Node 24 ustawić `claudeBin` w manifeście albo doinstalować |
| Repozytorium lokalne (`main`) ze szkieletem monorepo | ✅ bez pierwszego commita |
| Repozytorium na GitHubie | ⏸️ na razie git tylko lokalnie (decyzja 2026-10-15); rollout ruszy dopiero po wypchnięciu repo |
| CI (checki `test`, `typecheck`, `lint`) | ✅ workflow gotowy, zadziała po pushu |
| Konto bota z rolą Write i tokenem, ruleset na gałęzi bazowej, squash merge | ❌ do założenia ręcznie (patrz strona Accounts) |
| Skill zainstalowany w `~/.claude/skills/rollout` | ✅ |

### Kroki przygotowania

1. Podnieść Node do 24+.
2. Zainstalować skill: `git clone https://github.com/boldare/claude-rollout ~/.claude/skills/rollout && cd ~/.claude/skills/rollout && npm ci`.
3. PR 0, ręcznie (poza rolloutem): `git init`, szkielet monorepo pnpm, pusty pakiet z jednym testem, GitHub Actions z checkami `test`, `typecheck`, `lint`, repo na GitHubie.
4. Założyć konto bota, ruleset na `main` i włączyć squash merge.
5. ✅ Manifest w repo: `rollout/etap1/manifest.yaml` (wersjonowany, przechodzi walidację), a w katalogu rolloutu `~/.rollouts/autoscore-etap1/` jest do niego dowiązanie. Stan rolloutu (ledger, logi, inbox, briefy) zostaje poza repo. `briefing.sources` wskazuje na `CLAUDE.md` i ten plik, więc briefy pisze agent. Do uzupełnienia po założeniu repo: `repo.github`, `repo.public`, token bota.
6. `rollout preflight`, potem `rollout preflight --live`.
7. Dry run na jednym PR-ze (`--only P1 --dry-run`) we własnym terminalu, nie w sesji Claude Code.

### Etap 1 jako PR-y (zgodnie z [`rollout/etap1/manifest.yaml`](rollout/etap1/manifest.yaml))

| PR | Zakres | Zależy od |
|---|---|---|
| P1 ✅ | `schema`: kontrakt trafienia (Zod) z kodowaniem Bull/Outer Bull/miss, zdarzenia domenowe | — |
| P2 ✅ | `engine`: X01 dla meczu 1v1 (bust, double-out, legi, kto zaczyna) z testami | P1 |
| P3 | `engine`: zabawa (`placements`) i trening (Free run, Solo 501) z testami | P2 |
| P4 | `server`: `POST /matches`, `POST .../throws`, undo, WebSocket, SQLite (zapis zdarzeniowy) | P3 |
| P5 | `web`: ekran gry z paskiem wyników i klawiaturą wpisu | P4 |
| P5b | `web`: ekran gry według makiet motywu A (`design/mockups`, tokeny z `design/theme.css`) | P5 |
| P6 | `server` + `web`: statystyki z tabeli rzutek, ekran podsumowania | P5b |
| P7 | `audio`: odczyt wyniku, `bust`, `winner` (Web Speech API, odtwarzany we froncie) | P5 |
| P8 | `server` + `web` (+ `engine`, `schema`): historia meczów (`GET /matches`, lista ze szczegółami meczu), head-to-head z meczów 1v1, wykres formy (średnia z ostatnich meczów), profil gracza (edycja imienia i avatara, archiwizacja zamiast usuwania, zapisanie gościa po meczu), ranking graczy według średniej na 3 rzutki (patrz niżej); pełna historia rozbudowuje listę meczów z P9 | P9 |
| P9 | `schema` + `server` + `web`: porzucenie i wznowienie meczu (patrz niżej), lista nieskończonych meczów na ekranie startowym | P6 |

Uwagi:

- P1 i P2 zrobione ręcznie w sesji i scalone do `main` (2026-10-18), więc nie ma ich już w manifeście; rollout zaczyna od P3.
- `schema` idzie przed `engine` (odwrotnie niż w "Kolejności prac"), bo zgodnie z konwencją typy zdarzeń żyją tylko w `packages/schema`.
- `server` czeka na pełny silnik (P3), żeby API od razu obsługiwało wszystkie typy gier.
- P6 i P7 mogą iść równolegle po P5.
- Ranking w P8 (decyzja 2026-10-18, na próbę): lista graczy posortowana według średniej na 3 rzutki z ostatnich 20 legów, ze wszystkich gier z `countsToStats` (1v1, Zabawa, Solo 501; bez Free run). Gracz trafia do rankingu po 5 legach. Obok średniej: % doubli i bilans wygranych. Goście i zarchiwizowani poza rankingiem. Liczony z odtworzenia logu, bez przechowywanych liczników. Elo lub Glicko ewentualnie później.
- Porzucenie meczu w P9 (decyzja 2026-10-18): przycisk "Porzuć mecz" w górnym pasku ekranu gry z potwierdzeniem. Porzucenie to zdarzenie `match_abandoned` w logu (kto, kiedy, opcjonalny powód), nic nie jest usuwane. Porzucony mecz jest tylko do odczytu, z odznaką "Porzucony" (ikona i tekst). Wznowienie to zdarzenie `match_resumed` i gra toczy się dalej od miejsca przerwania. Ekran startowy (HOME) pokazuje listę nieskończonych meczów (w trakcie i porzuconych) z opcją kontynuacji lub wznowienia. Statystyki: porzucony mecz nie ma zwycięzcy i nie liczy się do bilansu meczów ani head-to-head; ukończone legi liczą się normalnie (wygrane legi, zamknięcia, najlepszy leg); przerwany leg nie wchodzi do średniej na 3 rzutki ani do rankingu. W Zabawie gracze, którzy już skończyli, zachowują miejsca.
- Agenci nie mogą zmieniać `CLAUDE.md`, tego pliku ani `rollout/**` (`repo.forbid`), a plik spoza zakresu PR-a wraca do poprawki (`gates.preVerify.scope`).

---

# Reguły X01 (ustalone)

- **Wyjście:** double-out (domyślnie).
- **Format meczu 1v1:** best of 3 legów (wygrywa pierwszy, kto weźmie 2 legi). Zabawa 3-4 graczy: jeden leg z rankingiem miejsc (patrz sekcja "Typy gier").
- **Bust:** wynik tury się anuluje, gracz wraca do wyniku sprzed tury, a tura się kończy. Bust następuje, gdy:
  - wynik spadłby poniżej zera,
  - zostałaby dokładnie 1 (przy double-out nie da się zamknąć),
  - wynik doszedłby do zera rzutką, która nie jest double (ani Bull).
- **Rzutka poza tarczą lub odbita:** liczy się jako wykonana rzutka za 0 (miss).
- **Wejście:** straight-in (punkty liczone od pierwszej rzutki).
- **Punkty startowe:** 301, 501 lub 701 do wyboru w ustawieniach.
- **Kto zaczyna:** pierwszy leg meczu wyłoniony losowaniem, kolejne legi rozpoczynają gracze na przemian.

# Sprzęt i etapy

## Środowisko

- **Teraz:** Mac autora jako serwer (backend, baza, detekcja), tablet lub telefon w tej samej sieci jako ekran gry.
- **Później:** mini PC (Linux) przy tarczy z autostartem.

## Etapy

| Etap | Sprzęt | Cel |
|---|---|---|
| 1 | Mac, bez kamery | Silnik X01, API, front z symulatorem trafień, zapis meczów i statystyki, audio |
| 2 | Mac + jedna kamera USB | Kalibracja, wykrywanie rzutek, weryfikacja i zestaw testowy |
| 3 | Mac + dwie kamery USB | Fuzja odczytów, mniej błędów przy zasłanianiu |
| 4 | Mini PC | Przeniesienie na docelowy sprzęt, autostart, praca bez monitora |
| 5 | Dowolny | Wersja online: konta, zdalny multiplayer (Supabase/Postgres) |

Każdy etap ma kończyć się działającą rzeczą, którą da się użyć, bo przy pracy po godzinach to chroni przed utknięciem w połowie.

## Wskazówki na Maca

- **Kamera:** macOS wymaga zgody w Ustawieniach (Prywatność i ochrona → Kamera) dla aplikacji, która jej używa (Terminal, Node). Dostęp do kamery przez AVFoundation (np. ffmpeg `-f avfoundation`), a na Linuksie później v4l2, więc źródło klatek chować za interfejsem `CameraSource`.
- **Usypianie:** podczas gry blokować uśpienie Maca (np. `caffeinate`), inaczej kamera i serwer zasną.
- **Adres w sieci:** tablet łączy się z Makiem przez nazwę `*.local` lub stały adres IP; ustawić firewall tak, by przepuszczał port aplikacji.

## Wskazówki pod późniejszy mini PC

- Trzymać wszystko przenośne: czysty Node, WASM zamiast natywnych bindingów, jeden plik SQLite do skopiowania.
- Konfiguracja przez zmienne środowiskowe (porty, ścieżka bazy, indeks kamery), bez ścieżek zaszytych w kodzie.
- Autostart jako usługa (systemd) lub kontener, ale to dopiero w etapie 4.

---

# Front: decyzje

- **Technologia:** React + Vite (SPA, bez SSR), TypeScript, Tailwind ze zmiennymi CSS jako tokenami motywu, i18n (polski, później angielski), testy Vitest i Playwright (smoke).
- **Motyw (wybrany): A, ciemny klasyczny** (czerń, krem, czerwień i zieleń z tarczy, kondensowana typografia Barlow, kanciaste karty). Wariant B (nowoczesny) odrzucony. Kolor nigdy nie niesie znaczenia samodzielnie (ikona i tekst obok).
- **Układ ekranu gry (monitor 16:9):** po lewej **pasek wyników inspirowany transmisją telewizyjną** (kolejka rzutów: rzucający zawsze na górze, pod nim następni w kolejności, z płynną animacją zamiany; wiersz = avatar, imię i pozostały wynik; wolne miejsca dla graczy 3 i 4 jako przerywane wiersze "Dodaj gracza"), w środku bieżąca tura: 3 sloty rzutek, suma tury, duży panel zamknięcia (np. D12) i przyciski Cofnij, Nowa runda, Do weryfikacji. Bez podglądu tarczy na ekranie. Pozostały wynik pokazany tylko raz, w pasku wyników.
- **Pasek wyników zależy od typu gry:** w meczu 1v1 pokazuje licznik legów (jak kolumny Sets/Legs w transmisji), w zabawie nie. Rotacja kolejki (rzucający zawsze na górze) działa w obu typach. W zabawie gracz, który zamknął leg, wypada z kolejki, trafia na dół paska z odznaką miejsca (1., 2., 3.), a gra toczy się dalej o pozostałe miejsca.
- **Pasek wyników jako komponent w dwóch rozmiarach:** duży na ekranie gry, kompaktowy na późniejszy widok TV lub nakładkę do streamu (ten sam strumień danych z backendu). Rotacja kolejki jako ustawienie (domyślnie włączona), z alternatywą stałej kolejności i podświetleniem rzucającego.
- **Gracze:** profil to imię plus avatar (emoji lub zdjęcie), bez kont i haseł na etapach 1-4. Nowy gracz dodawany w kreatorze gry przyciskiem "+ Nowy gracz". Gość bez zapisu statystyk, z opcją zapisania po meczu. Archiwizacja zamiast usuwania. Pod wersję online: opcjonalne `accountId` w profilu.
- **Urządzenie:** na start monitor (Mac), później tablet i TV jako drugi ekran. Układ responsywny.
- **Wyniki i zakończenia na ekranie:** podpowiedź zamknięcia (np. D12) i liczba rzutek do wygrania lega widoczne na ekranie gry, a na koniec lega i meczu ekran podsumowania (wynik, średnie, najwyższe zakończenie).
- **Makiety:** [AUTO Score: ekran gry (2 motywy)](https://claude.ai/artifact/X3fQ7qb26tmktL3amc2pML). Obowiązuje motyw A (czerwony): ekrany „A: 2 graczy” i „A: 4 graczy”. Zielony wariant B („Ciemny nowoczesny”) jest odrzucony.
- **Zrzuty ekranów A** w repo (1440×810): `design/mockups/theme-a-2-players.png`, `design/mockups/theme-a-4-players.png`. Na makietach brakuje klawiatury ręcznego wpisu (decyzja zapadła później), więc P5 musi ją zaprojektować w tym samym stylu.
- **Tokeny motywu A** w repo: `design/theme.css` (kolory, fonty, rozmiary z makiety 1440×810, promienie). Uwaga do P5: kremowy tekst na czerwonym akcencie ma kontrast 4,4:1, więc nadaje się tylko do dużego tekstu; mała odznaka „Rzuca” (13 px) z makiety wymaga większego, pogrubionego tekstu albo innego rozwiązania.

# Typy gier: mecz 1v1, zabawa i trening

| | Mecz 1v1 | Zabawa (3-4 graczy) |
|---|---|---|
| Liczba graczy | Dokładnie 2 | 3-4 (dopuszczalne też 2 jako luźna gra) |
| Format | Best of 3 legów (ustawialne: best of 1/3/5, później sety) | Jeden leg |
| Koniec | Gdy ktoś wygra wymaganą liczbę legów | Gdy zostanie jeden gracz bez zamkniętego lega |
| Wynik | Zwycięzca i wynik w legach | Ranking miejsc (1., 2., 3., 4.) |
| Pasek wyników | Z licznikiem legów | Bez legów, z odznaką miejsca po zamknięciu |
| Później | Turnieje, drabinki, ewentualnie ranking | Cricket i inne tryby |

## Zasady zabawy z rankingiem miejsc

- Gracz, który zamknie leg (double-out), zajmuje kolejne wolne miejsce (pierwszy 1., drugi 2. itd.) i wypada z kolejki rzutów.
- Pozostali grają dalej, aż zostanie jeden gracz, który dostaje ostatnie miejsce bez konieczności dokończenia.
- Na pasku wyników zakończeni gracze trafiają na dół z odznaką miejsca, a kolejka rotuje już tylko wśród grających.
- Podsumowanie pokazuje podium i średnie każdego gracza.

## Statystyki

- Wszystkie mecze liczą się razem (średnia, 180-tki, % doubli, najwyższe zakończenie, wygrane).
- "Wygrana" w zabawie to 1. miejsce. Każdy mecz ma typ, więc widok statystyk ma filtr (wszystkie, tylko mecze 1v1, tylko zabawa).
- Head-to-head ma pełny sens tylko dla 1v1, więc domyślnie liczymy go z meczów 1v1.

## Trening (solo, bez przeciwnika)

Dwa tryby dla jednego gracza:

- **Free run:** swobodne rzucanie, w którym system tylko notuje rzuty (z licznikiem sesji, np. suma i średnia), bez zasad gry i bez końca. **Nie zapisuje się do statystyk gracza.** Rzuty zostają w logu zdarzeń (np. do podglądu sesji i zestawu testowego dla detekcji), ale agregaty statystyk je pomijają.
- **Solo 501:** zejście z 501 do zera w trybie jednoosobowym (z zasadami X01: bust, double-out). Wchodzi do statystyk, z filtrem "trening".

Free run jest też dobrym narzędziem do zbierania klatek testowych dla detekcji, bo notuje rzuty bez presji meczu.

## Wpływ na dane i UI

- `match.type`: `match`, `casual` albo `practice` (z `practiceMode`: `free_run` lub `solo_501`). `match` wymaga dokładnie dwóch graczy, `practice` jednego.
- Flaga `countsToStats` na meczu: `true` dla `match`, `casual` i `solo_501`, `false` dla `free_run`. Agregaty statystyk uwzględniają tylko mecze z tą flagą.
- Dla zabawy wynik meczu to lista miejsc (`placements`), dla meczu 1v1 wynik w legach.
- Kreator gry: pierwszy wybór "Mecz 1v1", "Zabawa" albo "Trening", a kolejny krok dopasowany do wyboru (format meczu, punkty startowe i zasada wyjścia albo tryb treningowy).

---

# Dodatkowe funkcje na później

- Podpowiedzi checkoutów (np. 170 = T20, T20, Bull) rozbudowane o alternatywne ścieżki.
- Tryby online: dwóch graczy w różnych miejscach z własnymi tarczami.
- Turnieje i drabinki, ligi klubowe.
- Tryby treningowe i wyzwania dzienne.
- "Bull-off" jako alternatywa losowania przy wyborze, kto zaczyna.

# Proponowany MVP (kolejność prac)

1. Silnik 501 z poprawnymi zasadami i testami (zdarzenia: `turn_completed`, `bust`, `leg_won`, `match_won`).
2. Prosty frontend do ręcznego wpisywania rzutów (symulator trafień).
3. Zapis meczów (każda rzutka) i podstawowe statystyki.
4. Warstwa audio: odczyt wyniku, "bust", "winner" (Web Speech API na start).
5. Moduł detekcji na jednej kamerze USB, wysyłający zdarzenia do API.
6. Korekta ręczna w UI i status "do potwierdzenia".
7. Opcja "rzut do weryfikacji": ręczne oznaczenie, ekran weryfikacji z kandydatami, kolejka i eksport do `/fixtures`.

# Otwarte pytania

- [x] Wariant na start: B (ręczne wpisywanie) jako baza, potem A z jedną kamerą USB.
- [x] Liczba graczy: 1-4.
- [x] Statystyki: klasyczne dla darta.
- [x] Głos: odczyt wyniku po turze plus "bust" i "winner".
- [x] Drugi tryb gry: odłożony, najpierw tylko X01 (potem Cricket lub Around the Clock).
- [x] Lokalnie (LAN), najpierw Mac, później mini PC. Online jako późniejszy etap.
- [x] Język: całość w TypeScripcie (detekcja w Node + opencv-wasm, wymienna w razie potrzeby).
- [x] Sprzęt: Mac z jedną, potem dwiema kamerami USB, później mini PC.
- [x] Format zdarzenia trafienia: szkic w sekcji Backend i API.
- [ ] Głos: czy czytać też imię gracza ("Marek, sto") i czy `game_shot` ma być osobnym komunikatem?
- [x] Głos: Web Speech API na start, gotowe klipy później (zgodnie ze stackiem).
- [ ] Zestaw testowy dla detekcji: kto i kiedy nagrywa klatki z tarczy?
- [x] Baza na MVP: SQLite (Supabase/Postgres rozważamy przy wersji online).
- [x] Weryfikacja: domyślnie "potwierdź teraz", "zweryfikuj później" dostępny w ustawieniach.
- [ ] Margines `near_wire` (w mm lub px), od którego rzutka trafia do weryfikacji.
- [ ] Zapisywanie klatek: domyślnie włączone czy opcjonalne? Jak długo przechowywać?
- [x] Zasada wyjścia: double-out. Format meczu: best of 3 legów.
- [x] Wejście do gry: straight-in.
- [x] Punkty startowe: 301, 501 i 701 do wyboru w ustawieniach.
- [x] Motyw wizualny: A (ciemny klasyczny).
- [x] Rejestracja gracza: imię + avatar (emoji lub zdjęcie).
- [x] Główne urządzenie na start: monitor.
- [x] Koniec zabawy: gra toczy się dalej o kolejne miejsca.
- [x] Statystyki: zabawa liczy się razem z meczami (z filtrem po typie).
- [x] Pasek wyników w 1v1: rotacja (rzucający zawsze na górze).
- [ ] Zabawa: zasada wyjścia (robocze założenie: do wyboru w kreatorze, domyślnie double-out).
- [x] Gra solo: osobny tryb treningowy (Free run oraz Solo 501).
- [x] Kto zaczyna pierwszy leg meczu: losowanie.
- [x] Solo 501 liczy się do statystyk, z filtrem "trening".
- [x] Ręczny wpis rzutów: klawiatura (1-20, 25, Miss, mnożnik S/D/T).
- [x] Kodowanie: Outer Bull = 25×1, Bull = 25×2 (double), miss = 0×0.
