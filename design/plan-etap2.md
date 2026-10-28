# Etap 2: Mac + jedna kamera USB (rollout `autoscore-etap2`)

Prośba autora z 2026-10-28: rozpocząć prace nad kamerą w osobnym rolloucie. Wiążą `CLAUDE.md` (zasady nadrzędne, „Kontrakt zdarzenia trafienia”, „Weryfikacja rzutki”, „Detekcja: zasady pracy”) i `auto-score-dart-pomysly.md` (sekcje „Detekcja: jedna kamera USB (MVP)”, „Rzut do weryfikacji”). Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts`, typy i DTO tylko z `packages/schema`, kolor nigdy sam nie niesie znaczenia, wspólne zasady RWD z `design/rwd.md`.

## Gałąź i kamienie milowe (decyzja 2026-10-28)

- Cały etap 2 powstaje na gałęzi integracyjnej **`feat/camera`**. PR-y rolloutu celują w nią (`repo.base: feat/camera`), nie w `main`.
- Do `main` kod wchodzi **raz na kamień milowy**: autor otwiera i scala PR `feat/camera` → `main`, gdy kamień działa. Przed takim PR-em `main` jest scalany do `feat/camera`.
- `feat/camera` ma CI na push (`.github/workflows/ci.yml`), bo bramka rolloutu wymaga zielonego CI na bazie. Deploy (`deploy.yml`) chodzi tylko z `main`, więc nic z `feat/camera` nie trafia online.

| Kamień | PR-y | Co działa po scaleniu do `main` |
|---|---|---|
| **K1: fundamenty i weryfikacja** | C1-C5 | pakiet `vision` z `CameraSource`, geometria tarczy, ewaluacja na `/fixtures`; w aplikacji rzutka `pending` (z niską `confidence` albo oznaczona ręcznie) z potwierdzeniem lub poprawką jednym kliknięciem |
| **K2: kamera end-to-end** | C6-C8 | kalibracja na tablecie, wykrywanie rzutek, rzut przed kamerą (albo odtworzone nagranie) pojawia się na żywo w grze, niepewne rzutki jako `pending` |

Druga paczka (po K2, osobny plan): ekran kolejki weryfikacji z kandydatami, eksport rozstrzygniętych przypadków do `/fixtures`, wykrywanie wyjmowania lotek jako koniec tury.

## Dane (decyzje 2026-10-28)

- Zestaw testowy jest w repo: `fixtures/<sesja>/` z parami klatek JPEG i `labels.json` (format w `fixtures/README.md`). Pierwsza sesja `fixtures/session-01` (21 zdarzeń: 9 lotek, same single, 2 wyjmowania, 10 zmian bez rzutu) jest już na `feat/camera`.
- Agenci nie mają dostępu do kamery: pracują na `/fixtures` i nagraniach. Żywą kamerę uruchamia autor.
- **Autor nagra kolejne sesje** (łącznie ok. 30-50 lotek, także double, triple, Outer Bull, Bull i lotki przy drucie) i skalibruje je narzędziem z C6, zanim ruszy C7. C7 nie startuje, dopóki tych danych nie ma na `feat/camera`.
- Agenci nie zmieniają `/fixtures` (`repo.forbid`), żeby ewaluacja była uczciwa. Nowe sesje i kalibracje dodaje autor.
- Każdy PR, który zmienia detekcję, podaje w opisie wynik ewaluacji (poprawne / do potwierdzenia / błędne) na całym zestawie i nie obniża go względem bazy.

## Decyzje robocze (do potwierdzenia przez autora przed startem C4 i C7)

- **Próg `pending`:** rzutka z `confidence < 0.8` dostaje status `pending`; próg w zmiennej `AUTOSCORE_PENDING_CONFIDENCE` serwera.
- **`near_wire`:** liczony w milimetrach na spłaszczonej tarczy (po homografii), nie w pikselach; domyślnie 2 mm od najbliższego drutu; w konfiguracji `vision`.
- **Klatki:** `vision` zapisuje parę klatek przed/po dla każdej rzutki `pending` w lokalnym katalogu (`AUTOSCORE_FRAMES_DIR`), bez automatycznego usuwania; w `review.frames` ścieżki względne.
- **Do którego meczu wysyła `vision`:** do ostatnio aktywnego meczu w trakcie (najświeższa rzutka albo utworzenie), odczytanego z API. Bez meczu w trakcie `vision` nie wysyła nic.
- **Punkty kalibracji:** cztery punkty na zewnętrznej krawędzi pierścienia double, na granicach segmentów 5|20, 13|6, 17|3 i 8|11 (góra, prawo, dół, lewo tarczy w jej własnej orientacji).

## Wymiary tarczy (dla C2)

Standard BDO/WDF, w mm od środka: Bull (double) r ≤ 6,35; Outer Bull r ≤ 15,9; treble 99-107; double 162-170; poza 170 to miss. Kolejność segmentów zgodnie z ruchem wskazówek zegara od góry: 20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5; każdy segment ma 18°, 20 jest wyśrodkowane na górze.

---

## C1: pakiet `vision` i `CameraSource` (vision)

**Dziś:** pakietu nie ma. Jest spike `spikes/camera/detect-events.mjs` (Node + ffmpeg, bez OpenCV) i opis ustawień kamery w `auto-score-dart-pomysly.md` („Sprzęt i pomiary”).

**Zmiana:**
1. Nowy pakiet `packages/vision` (`@autoscore/vision`) według zasad z `CLAUDE.md` („Nowy pakiet”): `package.json` ze skryptami `test` i `typecheck`, `tsconfig.json` rozszerzający `tsconfig.base.json`, README.
2. Typ klatki (`Frame`: szerokość, wysokość, piksele w jednym ustalonym formacie, np. RGB lub szarość, czas `timestamp` w ms) i interfejs `CameraSource` (`frames(): AsyncIterable<Frame>`, `close()`), zgodnie z zasadą przenośności (macOS AVFoundation, później Linux v4l2).
3. Dwie implementacje przez ffmpeg jako proces potomny (bez natywnych bindingów): `VideoFileSource` (plik wideo, do developmentu i testów) i `AvFoundationSource` (kamera wskazana **po nazwie**, np. `"HD Pro Webcam C920:none"`, 1920×1080, `uyvy422`, ok. 5 kl./s). Ustawienia kamery na sztywno tam, gdzie ffmpeg na to pozwala; czego się nie da (autofocus, ekspozycja na macOS), opisać w README.
4. Konfiguracja przez zmienne środowiskowe (`AUTOSCORE_CAMERA_NAME`, `AUTOSCORE_CAMERA_VIDEO` dla pliku zamiast kamery) w jednym module `config.ts` z walidacją, jak `packages/server/src/config.ts`.
5. Czytanie obrazów JPEG z `/fixtures` do tego samego typu `Frame` (czysty JS/WASM, bez natywnych bindingów), bo z tego korzystają C3 i C7.

**Testy:** `VideoFileSource` na krótkim wideo wygenerowanym w teście przez ffmpeg (np. `lavfi testsrc`, bez commitowania plików wideo), liczba i rozmiar klatek, `close()` kończy proces; parsowanie konfiguracji; wczytanie klatki z `fixtures/session-01`. Jeśli runner CI nie ma ffmpeg, PR dodaje jego instalację w `ci.yml` (jedyna dozwolona zmiana workflow).

**Poza zakresem:** detekcja, kalibracja, wysyłka do API, Linux v4l2 (tylko interfejs gotowy na niego).

## C2: geometria tarczy i homografia (vision, czysta logika)

**Zmiana:**
1. Model tarczy w mm z wymiarów powyżej: `scorePoint({ x, y })` (punkt na płaskiej tarczy, środek w 0,0, oś y w górę) zwraca trafienie w kodowaniu kontraktu (`Hit` z `packages/schema`) oraz odległość do najbliższego drutu w mm (pod `near_wire`).
2. Homografia z 4 par punktów (obraz → płaska tarcza) i jej odwrotność, w czystym TS (bez OpenCV): `computeHomography`, `applyHomography`. Punkty referencyjne na płaskiej tarczy dla punktów kalibracji z „Decyzji roboczych”.
3. Typ `CameraCalibration` (4 punkty w pikselach obrazu + rozmiar obrazu) w `packages/schema`, bo użyją go serwer i front w C6.

**Testy:** każdy segment i każdy pierścień (środki pól), granice pierścieni po obu stronach, Bull i Outer Bull, miss poza 170 mm, granice segmentów (np. 20|1), odległość do drutu; homografia: punkty kalibracji wracają na swoje miejsca, punkt przekształcony tam i z powrotem, przypadek zdegenerowany (punkty współliniowe) daje błąd.

**Poza zakresem:** dystorsja obiektywu, automatyczne wykrywanie punktów kalibracji.

## C3: ewaluacja na `/fixtures` (vision)

**Zmiana:**
1. Czytnik zestawu: sesje z `fixtures/*/labels.json` (walidacja schematem Zod w pakiecie `vision`, bo to format narzędzia, nie API), pary klatek, opcjonalny `calibration.json`.
2. Interfejs detektora (`Detector`: para klatek + kalibracja → wynik `dart` z trafieniem, `confidence` i kandydatami, albo `removal` / `none`) i skrypt `pnpm --filter @autoscore/vision eval [--detector <nazwa>]`, który dla każdego zdarzenia porównuje wynik z `expected` i drukuje podsumowanie: **poprawne**, **do potwierdzenia** (wynik z `confidence` poniżej progu albo jawny `pending`), **błędne**, osobno dla rodzaju zdarzenia i dla segmentu/mnożnika; wynik także jako JSON (do porównania przed i po w PR-ach).
3. Detektor bazowy przeniesiony ze spike'a: klasyfikacja zdarzenia (`dart` / `removal` / `none`) po zmianie obrazu, bez odczytu segmentu (wynik zawsze „do potwierdzenia” dla `dart`). To punkt odniesienia dla C7.
4. Sesja bez `calibration.json` liczy się tylko w klasyfikacji zdarzeń, nie w trafieniach.

**Testy:** czytnik na `fixtures/session-01`, liczenie podsumowania na sztucznych wynikach, błędny `labels.json` daje czytelny błąd. Wynik ewaluacji detektora bazowego na `session-01` w opisie PR-a.

## C4: rzutka `pending` i weryfikacja (schema, engine, server)

**Dziś:** `HitEvent` i `ThrowRecord` mają `confidence`, ale serwer zalicza każdą rzutkę od razu; nie ma statusu `pending`, pola `review` ani endpointów `flag` / `verify` z `CLAUDE.md`.

**Zmiana:**
1. **Schema:** status rzutki (`confirmed` / `pending`), pole `review` według `CLAUDE.md` („Weryfikacja rzutki”: `reason`, `flaggedBy`, `candidates`, opcjonalne `frames` i `tip`, `resolved`), opcjonalne `review` w `HitEvent` (kamera przysyła kandydatów), żądania `flag` i `verify`, nowe wiadomości WebSocket `throw_flagged` i `throw_verified`, stan meczu z informacją o rzutkach `pending`. Testy schematu.
2. **Zdarzenia:** oznaczenie i weryfikacja to zdarzenia w logu (zasada 4 i 7), nic nie jest nadpisywane. Wynik rzutki po weryfikacji to `resolved`, a pierwotny odczyt zostaje w logu.
3. **Engine / odtwarzanie:** rzutka `pending` nie jest zaliczana: tura się nie zamyka, wynik nie jest odczytywany, kolejne rzutki czekają w kolejności `sequence` i są zaliczane po weryfikacji. Zmiana wyniku po weryfikacji przelicza turę, leg, bust i checkout przez odtworzenie zdarzeń (testy obowiązkowe według `CLAUDE.md`).
4. **Serwer:** rzutka z `confidence` poniżej `AUTOSCORE_PENDING_CONFIDENCE` dostaje `pending` z `review.reason: low_confidence`, `flaggedBy: system`; `POST /matches/:id/throws/:throwId/flag` (gracz oznacza rzutkę, `reason: manual`, także już zaliczoną w bieżącej turze), `POST /matches/:id/throws/:throwId/verify` (potwierdzenie albo poprawka; ręczna korekta zawsze wygrywa z kamerą), `GET /matches/:id/review-queue`. Zdarzenia domenowe dla audio (`turn_completed`, `bust`, `leg_won`, `match_won`) dopiero po weryfikacji. Undo i blokada zakończonej gry działają też z `pending`.

**Testy:** silnik: rzutka pending wstrzymuje turę, weryfikacja bez zmiany i z poprawką, poprawka zamieniająca wynik w bust i w checkout, poprawka wygrywającej rzutki cofa wygraną, rzutki po pending czekają i liczą się po weryfikacji, zabawa i trening; serwer: próg, idempotencja `eventId` z `review`, flag i verify (także dla nieistniejącej rzutki i zakończonej gry), kolejka, wiadomości WebSocket, restart serwera odtwarza stan z pending.

**Poza zakresem:** tryb „zweryfikuj później” z odczytem tymczasowym, front (C5), ekran kolejki.

## C5: `pending` i poprawka na ekranie gry (web)

**Zmiana:**
1. Slot rzutki `pending` na ekranie gry wyraźnie oznaczony ikoną i tekstem („Do potwierdzenia”), nie tylko kolorem; suma tury i pasek wyników pokazują, że tura czeka.
2. Potwierdzenie jednym kliknięciem i poprawka: wybór jednego z kandydatów (jeśli są) albo wpis klawiaturą ręcznego wpisu; wywołuje `verify`.
3. Przycisk „Do weryfikacji” na ekranie gry (jest już w układzie z makiet) oznacza wybraną rzutkę bieżącej tury (`flag`).
4. Głos i efekty odczytują wynik tury dopiero po weryfikacji (wynika z C4, bo audio idzie za zdarzeniami domenowymi; front tego nie obchodzi).
5. Obsługa nowych wiadomości WebSocket na każdym podłączonym ekranie.

**Testy:** slot pending z ikoną i tekstem, potwierdzenie, poprawka kandydatem i klawiaturą, ręczne oznaczenie, tura zamyka się po weryfikacji; zrzuty ekranu przy 375×812, 768×1024 i 1920×1080 w opisie PR-a.

**Poza zakresem:** ekran kolejki weryfikacji, podgląd klatek.

---

## C6: kalibracja kamery na tablecie (schema, server, web, vision)

**Zmiana:**
1. **Serwer:** `PUT /cameras/:cameraId/snapshot` (vision wysyła bieżącą klatkę JPEG), `GET /cameras/:cameraId/snapshot`, `GET` i `PUT /cameras/:cameraId/calibration` (`CameraCalibration` z C2, zapis w bazie za warstwą dostępu do danych). Autoryzacja jak pozostałe endpointy.
2. **Vision:** komenda `pnpm --filter @autoscore/vision snapshot` wysyła klatkę z `CameraSource` do serwera; logowanie do API przez `AUTOSCORE_API_URL` i `AUTOSCORE_PASSWORD`, jeśli serwer ma hasło.
3. **Front:** ekran „Kalibracja” (wejście z „Ustawień”): klatka z kamery, instrukcja z rysunkiem, który punkt kliknąć (kolejno 4 punkty z „Decyzji roboczych”), powiększenie przy klikaniu, poprawianie punktu, podgląd siatki segmentów nałożonej przez homografię na klatkę, zapis. Działa na tablecie dotykiem.
4. **Tryb dla zestawu testowego:** na tym samym ekranie wczytanie pliku JPEG z dysku zamiast klatki z kamery i pobranie wyniku jako `calibration.json` w formacie `/fixtures` (autor kalibruje nim sesje testowe).

**Testy:** serwer: zapis i odczyt kalibracji i klatki, walidacja, autoryzacja; front: kolejność punktów, poprawka punktu, zapis, tryb pliku i pobranie JSON-a; vision: wysyłka klatki (serwer w teście). Zrzuty ekranu kalibracji w trzech rozmiarach.

## C7: wykrywanie rzutki i odczyt segmentu (vision)

**Warunek startu:** na `feat/camera` są nowe sesje w `/fixtures` z `calibration.json` (patrz „Dane”).

**Zmiana:**
1. Wykrycie wbicia: porównanie z ostatnią stabilną klatką odniesienia (wniosek 1 ze spike'a), odróżnienie zmian globalnych (autofocus, ekspozycja) i wyjmowania lotek (ręka w kadrze dłużej niż ok. 1,5 s), analiza tylko obszaru tarczy z kalibracji.
2. Lokalizacja grotu (nie środka lotki, wniosek 4), przejście przez homografię na płaską tarczę, trafienie z C2, `confidence` i kandydaci (np. sąsiedni segment lub pierścień przy drucie), `review.reason` (`near_wire`, `low_confidence`, `occlusion`) i `tip`. Klasyczne metody na start (opencv-wasm, jeśli potrzebne; bez natywnych bindingów).
3. Niepewność daje niską `confidence` i kandydatów, a nie zgadywanie (zasada 7).
4. Detektor podpięty pod ewaluację z C3.

**Testy i ewaluacja:** testy jednostkowe na syntetycznych obrazach (np. narysowana lotka na płaskiej tarczy); wynik ewaluacji na całym `/fixtures` w opisie PR-a: poprawne / do potwierdzenia / błędne, ogółem i dla każdej sesji, z porównaniem do detektora bazowego z C3. Kryterium: zero rzutek błędnych z wysoką `confidence` jest ważniejsze niż mało „do potwierdzenia”.

## C8: `vision` end-to-end (vision, server)

**Zmiana:**
1. Komenda `pnpm --filter @autoscore/vision start`: `CameraSource` (kamera albo plik wideo), kalibracja pobrana z serwera, detektor z C7, wysyłka `HitEvent` (`source: camera-1`, `eventId` UUID, kolejny `sequence`, `confidence`, `review` z kandydatami) do meczu z „Decyzji roboczych”; ponowienie po błędzie sieci bez dublowania (idempotencja `eventId`).
2. Zapis pary klatek dla rzutek `pending` (`AUTOSCORE_FRAMES_DIR`) i ścieżki w `review.frames`.
3. Wyjmowanie lotek resetuje klatkę odniesienia, bez wysyłania rzutek.
4. Odtworzenie nagrania do meczu (`AUTOSCORE_CAMERA_VIDEO`) jako test end-to-end: serwer w teście, mecz utworzony przez API, po odtworzeniu stan meczu zgadza się z oczekiwanym (na wideo wygenerowanym z klatek `/fixtures` albo syntetycznym).
5. `pnpm dev` może uruchamiać też `vision` (opcjonalnie, np. `pnpm dev:camera`); README opisuje uruchomienie z kamerą na Macu (zgoda na kamerę dla Terminala, `caffeinate`).

**Testy:** wybór meczu, brak meczu w trakcie, ponowienie bez dublowania, pending z klatkami, reset po wyjmowaniu; test end-to-end z punktu 4. Autor sprawdza żywą kamerę po scaleniu (agent nie ma do niej dostępu).

**Poza zakresem (druga paczka):** ekran kolejki weryfikacji z kandydatami i klatkami, eksport rozstrzygniętych przypadków do `/fixtures`, koniec tury po wyjmowaniu lotek, dwie kamery.
