# @autoscore/vision

Źródła klatek, geometria tarczy i ewaluacja detekcji. Pakiet czyta obraz z kamery, z nagrania albo z plików JPEG w `/fixtures` i zwraca go w jednym formacie `Frame`. Ma też model tarczy w mm i homografię z obrazu na płaską tarczę. Detekcja to na razie baseline, który odróżnia zmianę po rzucie od szumu, ale nie odczytuje segmentu. Pakiet nie wysyła jeszcze niczego do API.

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
- `loadConfig(env)` i `createCameraSource(config, platform?)`: konfiguracja ze zmiennych środowiskowych i źródło do niej dopasowane. AVFoundation poza macOS daje błąd z podpowiedzią, żeby użyć `AUTOSCORE_CAMERA_VIDEO`.

## Geometria tarczy

`board.ts`, `homography.ts` i `calibration.ts` to czysty TypeScript bez `node:*` i bez OpenCV. Importują tylko `@autoscore/schema` i siebie nawzajem, więc zadziałają też w przeglądarce.

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

Ograniczenie: baseline nie widzi wyjmowania lotek. Spike rozpoznawał je po długości ruchu między klatkami, a para klatek tej informacji nie ma. Na `session-01` oba zdarzenia `removal` wychodzą jako lotka.

## Konfiguracja

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `AUTOSCORE_CAMERA_NAME` | `HD Pro Webcam C920:none` | Nazwa kamery w AVFoundation. Sufiks `:none` oznacza brak dźwięku. Pusta wartość daje domyślną. Znak sterujący (na przykład nowa linia) daje błąd `Invalid AUTOSCORE_CAMERA_NAME`. |
| `AUTOSCORE_CAMERA_VIDEO` | brak | Nagranie zamiast kamery. Gdy jest ustawione, wygrywa z `AUTOSCORE_CAMERA_NAME`. Ścieżka względna liczy się od katalogu roboczego, pod `pnpm --filter` to `packages/vision`. |

Listę nazw kamer w macOS pokazuje `ffmpeg -f avfoundation -list_devices true -i ""`.

## Testy

```sh
pnpm --filter @autoscore/vision test
```

Testy generują krótkie nagrania `testsrc` i małe pliki JPEG w katalogu tymczasowym i usuwają je po sobie. Test regresji baseline'u dekoduje wszystkie 42 klatki `session-01`, więc trwa kilka sekund.
