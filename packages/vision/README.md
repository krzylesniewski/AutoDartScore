# @autoscore/vision

Źródła klatek, geometria tarczy i ewaluacja detekcji. Pakiet czyta obraz z kamery, z nagrania albo z plików JPEG w `/fixtures` i zwraca go w jednym formacie `Frame`. Ma też model tarczy w mm i homografię z obrazu na płaską tarczę. Detekcja to na razie baseline, który odróżnia zmianę po rzucie od szumu, ale nie odczytuje segmentu. Komenda `snapshot` wysyła jedną klatkę do serwera, żeby skalibrować kamerę na ekranie „Kalibracja kamery”. Komenda `start` czyta kamerę albo nagranie i wysyła każdą wykrytą lotkę jako `HitEvent` do gry w trakcie.

## Wymagania i ograniczenia

- ffmpeg i ffprobe na `PATH`. Testy też ich potrzebują. Bez nich `pnpm test` kończy się błędem, a nie pomija testy.
- Zgodę na kamerę w macOS dostaje aplikacja, która uruchamia proces (na przykład Terminal). Kamerę na żywo uruchamia więc człowiek. Testy nigdy nie otwierają kamery.
- Kamera (Logitech C920 przez USB 2.0) daje w AVFoundation 1080p tylko bez kompresji, w `uyvy422`. W praktyce to około 5 kl./s, choć tryb jest ogłaszany jako 30.
- Przez ffmpeg w macOS nie da się wyłączyć autofocusa, automatycznej ekspozycji ani automatycznego balansu bieli. Narzędzie UVC albo aplikacja producenta są jeszcze do sprawdzenia.
- Linux (v4l2) nie jest zaimplementowany. Gotowy jest tylko interfejs `CameraSource`.

## Format klatki

`Frame` ma pola `width`, `height`, `data` i `timestamp`.

- `data`: `Uint8Array` w RGB24, czyli 3 bajty na piksel (`FRAME_BYTES_PER_PIXEL`), wiersze od lewego górnego rogu, bez wyrównania. Długość to `width * height * 3`. Każda klatka ma własną tablicę.
- `timestamp` w ms. Dla nagrania to pts klatki z ffprobe, bez przesuwania początku do zera, więc da się go porównać z `afterTime` w `labels.json` (po pomnożeniu przez 1000). Dla kamery to czas monotoniczny od uruchomienia ffmpeg.

## API

- `CameraSource`: `frames()` zwraca `AsyncIterable<Frame>`, `close()` zatrzymuje źródło. Kontrakt każdej implementacji:
  - proces startuje dopiero z iteracją `frames()`,
  - `frames()` działa raz, drugie wywołanie od razu rzuca błąd,
  - `close()` kończy proces i rozwiązuje się dopiero po jego wyjściu. Kolejne wywołania nic nie psują,
  - po `close()` trwająca iteracja kończy się bez błędu. `frames()` wywołane po `close()` nie daje żadnej klatki,
  - wyjście z pętli `for await` (`break`) też kończy proces,
  - błędy wychodzą z iteracji (`next()` odrzuca), nie z wywołania `frames()`.
- `VideoFileSource(path, { ffmpegPath?, ffprobePath? })`: klatki z nagrania. Najpierw ffprobe czyta rozmiar i pts klatek pierwszego strumienia wideo, potem ffmpeg dekoduje je do RGB24. Klatki przychodzą tak szybko, jak ffmpeg dekoduje, bez odtwarzania w czasie rzeczywistym. Brak pliku albo plik nieczytelny daje błąd ze ścieżką.
- `AvFoundationSource(name, { ffmpegPath?, now? })`: kamera w macOS przez `-f avfoundation`, 1920×1080, `uyvy422`, `-framerate 30.000030`. Kamerę wybiera nazwa, bo indeksy AVFoundation zmieniają się po restarcie. Nazwa trafia do ffmpeg jako jeden argument, bez powłoki. `avFoundationArgs(name)` zwraca pełną listę argumentów ffmpeg.
- `readJpegFrame(filePath, timestamp = 0)`: dekoduje JPEG (na przykład z `/fixtures`) do `Frame` w czystym JS (`jpeg-js`), bez natywnych bindingów.
- `encodeJpegFrame(frame, quality = 90)`: koduje `Frame` do JPEG (`Uint8Array`) w czystym JS. `jpeg-js` koduje tylko RGBA, więc klatka dostaje kanał alfa 255.
- `loadConfig(env, homeDir = os.homedir())` i `createCameraSource(config, platform?)`: konfiguracja ze zmiennych środowiskowych (`camera`, `api`, `detector`, `framesDir`, `pendingConfidence`) i źródło do niej dopasowane. `homeDir` wyznacza domyślny `framesDir`. AVFoundation poza macOS daje błąd z podpowiedzią, żeby użyć `AUTOSCORE_CAMERA_VIDEO`.
- `captureFrame(source, { settleMs })`: pierwsza klatka co najmniej `settleMs` po pierwszej klatce źródła. Gdy źródło skończy się wcześniej, zwraca ostatnią, a bez żadnej klatki rzuca `Camera gave no frame`. Zawsze zamyka źródło. Czas oczekiwania pomija ciemne pierwsze klatki kamery na żywo.
- `sendSnapshot({ api, cameraId, jpeg, fetch? })`: z hasłem najpierw `POST /auth/login`, potem `PUT /cameras/:cameraId/snapshot` z `content-type: image/jpeg` i tokenem. Złe hasło daje `Login failed: invalid AUTOSCORE_PASSWORD`, inna odpowiedź spoza 2xx daje błąd ze statusem HTTP i kodem `error` z serwera, a brak połączenia `Cannot reach the server at <adres>: <przyczyna>`. Hasło nigdy nie trafia do komunikatu. Każde żądanie to jedna próba, bez powtórek.
- `createApiClient({ api, fetch?, sleep?, retryDelaysMs? })`: klient API dla `start`.
  - Z hasłem loguje się przy pierwszym żądaniu i trzyma token. Odpowiedź 401 powoduje jedno ponowne logowanie i jedno powtórzenie żądania. Drugie 401 to błąd. Bez hasła nigdy nie woła `/auth/login`.
  - Błąd sieci i odpowiedź 5xx powtarza z tym samym ciałem po każdym opóźnieniu z `retryDelaysMs` (domyślnie 250, 500, 1000, 2000 i 4000 ms), czyli najwyżej `retryDelaysMs.length + 1` prób. Potem rzuca `Cannot reach the server at <adres>: <przyczyna>`. Dla 5xx przyczyną jest status HTTP i kod `error`. Inne odpowiedzi spoza 2xx nie są powtarzane.
  - `getCalibration(cameraId)`: `GET /cameras/:cameraId/calibration`, `null` dla 404.
  - `listUnfinishedMatches()`: `GET /matches?status=unfinished`, od najnowszej gry.
  - `sendHit(hit)`: `POST /matches/:matchId/throws`. Zwraca `{ ok: true, status }` dla 2xx i `{ ok: false, status, error }` dla innego 4xx, gdzie `error` to kod z serwera albo `null`. Rzuca tylko po wyczerpaniu prób.
- `pickActiveMatch(items)`: pierwsza gra `in_progress` z listy od najnowszej. Porzucone gry pomija. Gdy ta gra to trening checkoutów albo żadnej nie ma, zwraca `null`.
- `createDartWatcher({ removalMs = 1500, isStill? })`: `push(frame)` zwraca `settled` z parą `before` i `after`, `removal` albo `null`. Opis w sekcji „Lotki do gry”.
- `saveDartFrames({ framesDir, matchId, eventId, before, after })`: zapisuje `<matchId>/<eventId>-before.jpg` i `-after.jpg` w `framesDir`, tworząc katalog w razie potrzeby, i zwraca te ścieżki względne (`ReviewFrames`). Niczego nie usuwa.
- `runCamera({ source, detector, calibration, client, framesDir, pendingConfidence, log, now?, newEventId?, watcher? })`: pętla komendy `start`. Zwraca `RunSummary`: `sent`, `rejected`, `failed`, `skippedNoMatch` i `removals`.

## Geometria tarczy

`board.ts`, `homography.ts` i `calibration.ts` to czysty TypeScript bez `node:*` i bez OpenCV. Importują tylko `@autoscore/schema` i siebie nawzajem, więc działają też w przeglądarce. Przeglądarka importuje je przez `@autoscore/vision/geometry` (`src/geometry.ts`), bo główny eksport `@autoscore/vision` ciągnie też źródła klatek z `node:child_process`.

Współrzędne:

- tarcza: mm, środek w (0, 0), x w prawo, y w górę. Kąt liczony zgodnie z ruchem wskazówek zegara od góry,
- obraz: piksele, początek w lewym górnym rogu, y w dół.

Oba układy używają typu `Point` (`{ x, y }`), zgodnego z `ImagePoint` z `@autoscore/schema`.

Tarcza (BDO/WDF, `BOARD_RADII`, promień w mm):

| Obszar | Promień r | Trafienie |
|---|---|---|
| Bull | 0 ≤ r ≤ 6.35 | 25×2 |
| Outer Bull | 6.35 < r ≤ 15.9 | 25×1 |
| Single wewnętrzny | 15.9 < r < 99 | S×1 |
| Treble | 99 ≤ r ≤ 107 | S×3 |
| Single zewnętrzny | 107 < r < 162 | S×1 |
| Double | 162 ≤ r ≤ 170 | S×2 |
| Miss | r > 170 | 0×0 |

`BOARD_SEGMENTS` to segmenty zgodnie z ruchem wskazówek zegara od góry: 20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5. Każdy ma 18°, a 20 jest wyśrodkowane na górze. Punkt dokładnie na drucie promieniowym należy do segmentu zgodnie z ruchem wskazówek zegara.

- `scorePoint(point)`: punkt na tarczy w mm daje `{ hit, wireDistance }`. `hit` to `Hit` z `@autoscore/schema`. `wireDistance` to odległość w mm do najbliższego drutu: jednego z sześciu okręgów albo jednego z 20 drutów promieniowych, które biegną od r = 15.9 do r = 170. Miss też ma `wireDistance`. Współrzędna nieskończona albo `NaN` daje błąd.
- `computeHomography(from, to)`: homografia z czterech par punktów (DLT z normalizacją Hartleya). Błąd, gdy trzy z czterech punktów w którymkolwiek zbiorze leżą na jednej prostej (także przy powtórzonym punkcie), gdy układ równań jest osobliwy albo gdy współrzędna nie jest skończona.
- `applyHomography(h, point)`: odwzorowuje punkt. Błąd, gdy punkt trafia w nieskończoność (w = 0).
- `invertHomography(h)`: odwrotna homografia. Błąd dla macierzy osobliwej.
- `Homography`: macierz 3×3 wierszami. Skala jest dowolna, więc porównuje się odwzorowane punkty, a nie elementy macierzy.

Kalibracja: `CameraCalibration` z `@autoscore/schema` ma rozmiar obrazu i cztery punkty na zewnętrznej krawędzi pierścienia double, na granicach 5|20, 13|6, 17|3 i 8|11, w tej kolejności (góra, prawo, dół, lewo tarczy w jej własnej orientacji). Kamera patrzy z boku i pod kątem, więc o orientacji decyduje kolejność punktów. `CALIBRATION_BOARD_POINTS` to te same punkty na tarczy (r = 170, kąty 351°, 81°, 171° i 261°). `calibrationHomography(calibration)` zwraca homografię obraz → tarcza. Tarcza → obraz to `invertHomography` jej wyniku.

## Klatka do kalibracji

```sh
pnpm --filter @autoscore/vision snapshot
```

Komenda czyta konfigurację, bierze jedną klatkę ze źródła, koduje ją do JPEG i wysyła do serwera jako klatkę kamery `camera-1` (`DEFAULT_CAMERA_ID` z `@autoscore/schema`). Z kamery na żywo czeka 2 s od pierwszej klatki, z nagrania bierze pierwszą. Po sukcesie wypisuje jedną linię, np. `Snapshot sent to http://localhost:3000: 1920x1080, 412345 bytes`. Błąd trafia na stderr, a proces kończy się kodem 1. Kamerę na żywo uruchamia człowiek w Terminalu, bo to on dostaje zgodę macOS na kamerę.

Na ekranie „Kalibracja kamery” w trybie „Plik JPEG” można pobrać `calibration.json` do `fixtures/<sesja>/`. Plik to obiekt `CameraCalibration` bez zmian, sformatowany z wcięciem 2 spacji:

```json
{
  "imageWidth": 1920,
  "imageHeight": 1080,
  "points": [
    { "x": 1001, "y": 374 },
    { "x": 870, "y": 787 },
    { "x": 365, "y": 747 },
    { "x": 551, "y": 296 }
  ]
}
```

Punkty leżą na zewnętrznej krawędzi pierścienia double na granicach 5|20, 13|6, 17|3 i 8|11, w tej kolejności, w pikselach obrazu.

## Lotki do gry

```sh
pnpm --filter @autoscore/vision start
pnpm dev:camera
```

`start` działa, dopóki źródło daje klatki. `pnpm dev:camera` w katalogu głównym uruchamia razem serwer, front i `start`. Zwykłe `pnpm dev` uruchamia tylko serwer i front.

Przebieg:

1. Na starcie komenda czyta kalibrację `camera-1` z serwera. Powtórki klienta API (łącznie około 8 s) dają serwerowi czas na start pod `pnpm dev:camera`. Bez kalibracji detektor dostaje `null`. Kalibracja jest czytana tylko raz, więc po nowej kalibracji trzeba uruchomić `start` ponownie.
2. Pierwsza klatka to klatka odniesienia. Kolejna klatka bez zmiany względem poprzedniej (`measureChange` poniżej progu baseline'u) staje się nowym odniesieniem, co pochłania powolne zmiany światła.
3. Klatka ze zmianą zaczyna ruch albo go przedłuża. Pierwsza spokojna klatka kończy ruch i staje się nowym odniesieniem. Czas ruchu liczy się tylko ze znaczników klatek.
4. Ruch trwający 1,5 s lub dłużej to wyjmowanie lotek: nowe odniesienie, bez detektora i bez wysyłki. Krótszy ruch to para klatek dla detektora: odniesienie sprzed ruchu i klatka po nim.
5. Wynik `none` i `removal` z detektora niczego nie wysyła. Dla lotki komenda pobiera listę niezakończonych gier i wybiera najnowszą grę w trakcie. Gdy najnowsza gra w trakcie to trening checkoutów albo żadnej nie ma, lotka nie jest wysyłana i nie zapisuje klatek.
6. Lotka idzie jako `HitEvent` ze `source: "camera-1"`, nowym `eventId` i `sequence` od 0, rosnącym z każdą lotką w tym procesie. Lotka bez odczytu (`hit: null`) idzie jako `0×0` z pewnością 0.
7. Lotka jest niepewna, gdy nie ma odczytu albo jej pewność jest poniżej `AUTOSCORE_PENDING_CONFIDENCE`. Tylko niepewna lotka zapisuje parę klatek w `AUTOSCORE_FRAMES_DIR` i dostaje `review` z powodem `low_confidence`, kandydatami od najbardziej prawdopodobnego (najwyżej 10) i ścieżkami klatek. Gdy zapis klatek się nie uda, `review` idzie bez nich. O statusie `pending` decyduje serwer.
8. Błąd sieci i 5xx są powtarzane z tym samym `eventId`, więc serwer nie zapisze lotki dwa razy. Odrzucenie (4xx, np. `409 turn_pending`) i wyczerpane próby trafiają do logu, a komenda działa dalej. Błąd źródła albo detektora kończy komendę kodem 1.

Linie logu, na przykład:

```
Kalibracja camera-1: 1920x1080. Po nowej kalibracji uruchom start ponownie.
Start: kamera HD Pro Webcam C920:none, detektor baseline, serwer http://localhost:3000, klatki w ~/.autoscore/frames
Lotka T20, pewność 0.95, gra m_1
Lotka brak odczytu, pewność 0.00, do potwierdzenia, gra m_1, klatki: ~/.autoscore/frames/m_1
Wyjmowanie lotek (ruch 2.2 s), nowa klatka odniesienia
Brak gry w trakcie, lotka nie została wysłana
Serwer odrzucił lotkę brak odczytu (gra m_1): 409 turn_pending
Koniec: wysłane 4, odrzucone 1, nieudane 0, bez gry 1, wyjmowanie lotek 1
```

Ścieżki w logu są pełne, tu skrócone do `~`. Bez kalibracji pierwsza linia to `Brak kalibracji kamery camera-1, detektor dostanie null`. Błędy (odrzucenia, nieudane wysyłki i zapisy klatek) idą na stderr.

Ctrl+C albo SIGTERM zamyka źródło, wypisuje podsumowanie i kończy proces kodem 0, także gdy ffmpeg zakończył się błędem po tym samym Ctrl+C. Inny błąd trafia na stderr, a kod wyjścia to 1.

Kamera na żywo w macOS: zgodę na kamerę dostaje Terminal, więc komendę uruchamia człowiek, na przykład `caffeinate -i pnpm dev:camera`. `caffeinate -i` nie pozwala Macowi zasnąć w trakcie gry.

Znana luka: baseline nigdy nie odczytuje segmentu, więc do czasu prawdziwego detektora każda lotka z kamery przychodzi jako `0×0` do potwierdzenia. Przy `AUTOSCORE_PENDING_CONFIDENCE=0` na serwerze taka lotka liczy się jako Miss bez weryfikacji.

## Ewaluacja

Detektor sprawdzamy na zestawie testowym z `/fixtures`. Układ katalogów i format `labels.json` opisuje [`fixtures/README.md`](../../fixtures/README.md).

```sh
pnpm --filter @autoscore/vision eval
pnpm --filter @autoscore/vision eval --detector baseline --threshold 0.8 --json /tmp/eval.json
```

| Flaga | Domyślnie | Znaczenie |
|---|---|---|
| `--detector <nazwa>` | `baseline` | Detektor z `DETECTORS`. Nieznana nazwa daje błąd z listą dostępnych. |
| `--fixtures <katalog>` | `fixtures/` w repo | Katalog z sesjami. Sesja to podkatalog z `labels.json`, pozostałe wpisy są pomijane. |
| `--threshold <liczba>` | `0.8` | Próg pewności od 0 do 1. Lotka poniżej progu trafia do potwierdzenia. |
| `--json <plik>` | brak | Zapis raportu w JSON. |

Ścieżki względne liczą się od katalogu roboczego, pod `pnpm --filter` to `packages/vision`. Nieznana flaga, nieznany detektor, zły próg, błędny `labels.json` albo `calibration.json` i błąd detektora kończą komendę kodem 1. Błędne detekcje nie są błędem: kod 0 znaczy, że ewaluacja się odbyła.

Wynik każdego zdarzenia:

- **poprawne**: dobry rodzaj zdarzenia, a dla lotki w sesji z kalibracją także dobry segment i mnożnik,
- **do potwierdzenia**: wykryta lotka bez odczytu (`hit: null`) albo z pewnością poniżej progu, tam gdzie lotka naprawdę była,
- **błędne**: zły rodzaj zdarzenia, zły odczyt pewnej lotki albo lotka (także niepewna) tam, gdzie nie było rzutu,
- **bez oceny**: pewna lotka w sesji bez `calibration.json`. Trafienie oceniamy tylko z kalibracją.

Raport JSON ma te same liczby: `totals`, `sessions`, `kinds` (rodzaj oczekiwany i wykryty), `hits` (trafienia z sesji z kalibracją, `skippedNoCalibration` i `byHit`) oraz `events` z wynikiem każdego zdarzenia. Nie ma w nim znaczników czasu ani ścieżek, więc dwa przebiegi na tym samym kodzie dają identyczny plik. Zmianę w detekcji porównujemy z raportem sprzed niej.

`loadFixtureSessions(dir)` i `loadFixtureSession(dir)` wczytują sesje i sprawdzają `labels.json` schematem Zod (trafienie przez `Hit` z `@autoscore/schema`). Błąd podaje ścieżkę pliku i pola. Klatki dekoduje dopiero `loadEventFrames(event)`.

### Interfejs `Detector`

`detect({ before, after, calibration })` dostaje parę klatek i kalibrację sesji (albo `null`) i zwraca `Detection`:

- `{ kind: 'dart', hit, confidence, candidates }`: `hit` to `Hit` albo `null` (brak odczytu, zawsze do potwierdzenia), `confidence` od 0 do 1, `candidates` to `Hit` z `probability`, jak `review.candidates` w kontrakcie,
- `{ kind: 'removal' }`: wyjmowanie lotek,
- `{ kind: 'none' }`: zmiana, która nie jest rzutem.

Ewaluacja sprawdza wynik detektora i zatrzymuje się z nazwą sesji i zdarzenia, gdy jest niepoprawny. Nowy detektor dopisujemy do `DETECTORS` w `src/detectors.ts`.

### Baseline

`baselineDetector` to metoda ze spike'a `spikes/camera/detect-events.mjs` przeniesiona na parę klatek. `measureChange` liczy jasność w 320×180 i zmienione piksele (różnica ponad 25) w kratkach 20×20. Mała zmiana, zmiana całego kadru (ekspozycja, autofocus) albo zmiana w mniej niż 2 kratkach to `none`. Reszta to lotka bez odczytu, więc każda wykryta lotka jest do potwierdzenia. Kalibracji baseline nie używa.

Ograniczenie: baseline nie widzi wyjmowania lotek. Spike rozpoznawał je po długości ruchu między klatkami, a para klatek tej informacji nie ma. Na `session-01` oba zdarzenia `removal` wychodzą jako lotka. Komenda `start` rozpoznaje wyjmowanie sama, po długości ruchu, zanim wywoła detektor.

## Konfiguracja

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `AUTOSCORE_CAMERA_NAME` | `HD Pro Webcam C920:none` | Nazwa kamery w AVFoundation. Sufiks `:none` oznacza brak dźwięku. Pusta wartość daje domyślną. Znak sterujący (na przykład nowa linia) daje błąd `Invalid AUTOSCORE_CAMERA_NAME`. |
| `AUTOSCORE_CAMERA_VIDEO` | brak | Nagranie zamiast kamery. Gdy jest ustawione, wygrywa z `AUTOSCORE_CAMERA_NAME`. Ścieżka względna liczy się od katalogu roboczego, pod `pnpm --filter` to `packages/vision`. |
| `AUTOSCORE_API_URL` | `http://localhost:3000` | Adres serwera, ta sama zmienna co w proxy Vite. Musi być adresem `http:` albo `https:`. Końcowy `/` jest obcinany. Inna wartość daje błąd `Invalid AUTOSCORE_API_URL`. |
| `AUTOSCORE_PASSWORD` | brak | Hasło serwera. Z nim `snapshot` i `start` najpierw się logują. Pusta wartość oznacza brak hasła. Wartość jest brana bez obcinania spacji, jak na serwerze. |
| `AUTOSCORE_DETECTOR` | `baseline` | Detektor z `DETECTORS` dla `start`. Pusta wartość daje domyślny. Nieznana nazwa daje błąd `Invalid AUTOSCORE_DETECTOR` z listą dostępnych. |
| `AUTOSCORE_FRAMES_DIR` | `~/.autoscore/frames` | Katalog klatek niepewnych lotek, tworzony w razie potrzeby. Ścieżki w `review.frames` są względne wobec niego (`<matchId>/<eventId>-before.jpg`). Pusta wartość daje domyślny. Ścieżka względna liczy się od katalogu roboczego. Klatki nie są usuwane. |
| `AUTOSCORE_PENDING_CONFIDENCE` | `0.8` | Próg pewności od 0 do 1, ta sama zmienna co na serwerze, więc ustaw obu tę samą wartość. `start` zapisuje klatki i dołącza `review` dla lotki poniżej progu albo bez odczytu, a o statusie `pending` decyduje serwer. Wartość spoza formatu liczby albo powyżej 1 daje błąd `Invalid AUTOSCORE_PENDING_CONFIDENCE`. |

Listę nazw kamer w macOS pokazuje `ffmpeg -f avfoundation -list_devices true -i ""`.

## Testy

```sh
pnpm --filter @autoscore/vision test
```

Testy generują krótkie nagrania `testsrc` i małe pliki JPEG w katalogu tymczasowym i usuwają je po sobie. `end-to-end.test.ts` uruchamia w procesie prawdziwy serwer z bazą w pamięci (`@autoscore/server` jako devDependency), generuje bezstratne nagranie FFV1 z rzutami i wyjmowaniem lotek i puszcza je przez `runCamera`. Test regresji baseline'u dekoduje wszystkie 42 klatki `session-01`, więc trwa kilka sekund.
