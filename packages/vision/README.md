# @autoscore/vision

Źródła klatek dla detekcji. Pakiet czyta obraz z kamery, z nagrania albo z plików JPEG w `/fixtures` i zwraca go w jednym formacie `Frame`. Nie ma jeszcze detekcji i nie wysyła niczego do API.

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

Testy generują krótkie nagrania `testsrc` w katalogu tymczasowym i usuwają je po sobie.
