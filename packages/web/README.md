# @autoscore/web

Front: SPA w React 19 i Vite, układ pod tablet w poziomie. Style to Tailwind 4 oparty tylko na tokenach motywu z [design/theme.css](../../design/theme.css), importowanych w `src/theme.css`. Teksty dla użytkownika są po polsku w `src/i18n/pl.ts`.

## Uruchomienie

```sh
pnpm --filter @autoscore/web dev
```

Front potrzebuje działającego serwera. Vite przekazuje `/api` (także WebSocket) do adresu z `AUTOSCORE_API_URL`, domyślnie `http://localhost:3000`, i obcina prefiks `/api`. Serwer Vite nasłuchuje na wszystkich interfejsach, więc tablet w sieci otwiera `http://<adres-IP-komputera>:5173`. Całość, czyli serwer i front razem, uruchamia `pnpm dev` w katalogu głównym, zobacz [README](../../README.md).

## Konfiguracja

| Zmienna | Domyślnie | Znaczenie | Przykład |
|---|---|---|---|
| `VITE_API_URL` | brak, front woła `/api` | Adres serwera API dla REST i połączenia na żywo. Wskazuje główny adres serwera, bez `/api`. | `https://api.example.com` |
| `VITE_BASE` | `/` | Ścieżka bazowa builda, gdy aplikacja jest pod podścieżką. Musi zaczynać się i kończyć na `/`. | `/autoscore/` |

Obie zmienne są czytane przy starcie Vite (`build` i `dev`), więc zmiana wymaga nowego builda albo restartu serwera Vite. Bez `VITE_API_URL` front woła `/api` przez proxy Vite. Z nią front woła API bezpośrednio, a WebSocket używa `wss://` albo `ws://` zależnie od schematu tego adresu. `VITE_BASE` pochodzi ze zmiennych środowiskowych powłoki, nie z plików `.env`:

```sh
VITE_BASE=/autoscore/ VITE_API_URL=https://api.example.com pnpm --filter @autoscore/web build
```

## Ekrany

Routing przez hash w `src/App.tsx`, z sześcioma trasami opisanymi niżej.

Każdy inny adres przekierowuje na `#/`.

### `#/`: ekran startowy

Po lewej formularz nowej gry:

- Najpierw typ: „Mecz 1v1”, „Zabawa” albo „Trening”.
- Potem gracze, od ostatnio aktywnego, z przyciskiem „+ Nowy gracz”. Nowy gracz ma imię, avatar emoji i jeden z 16 kolorów. Bez wyboru kolor jest dobrany automatycznie.
- Emoji wybiera się z siatki 3 grup po 10: „Film i gry”, „Sport”, „Postaci”. Można też wpisać jedno własne w polu „Inne emoji”, a „Bez emoji” zostawia inicjał.
- Opcje zależne od typu: punkty startowe, liczba legów albo tryb treningu (Free run, Solo 501, Końcówki). Przy „Końcówkach” dochodzi przedział „2-50” albo „51-100” (domyślnie 2-50).

Po prawej podsumowanie wybranych ustawień i lista gier do dokończenia (w trakcie i porzuconych, od najnowszej):

- Każdy wiersz ma przycisk „Dokończ”.
- „Porzuć” pojawia się po co najmniej jednym ukończonym legu.
- „Zakończ trening” (z potwierdzeniem) pojawia się w treningu po pierwszej rzutce, a w „Końcówkach” po pierwszej próbie.
- Wiersz „Końcówek” pokazuje udane próby, wszystkie próby i skuteczność, np. „7/12” i „58%”.
- Zakończony trening znika z listy.

### `#/matches/:id`: ekran gry

Ekran ma:

- pasek wyników, trzy sloty rzutek, sumę tury i podpowiedź zamknięcia,
- klawiaturę: 1-20 w kolejności z tarczy, osobne „25” i „Bull”, „Miss”, „Reszta Miss” i S/D/T,
- „Cofnij”,
- „Porzuć mecz”, z potwierdzeniem, po co najmniej jednym ukończonym legu,
- „Zakończ trening”, z potwierdzeniem, w treningu po pierwszej rzutce albo próbie,
- przełączniki głosu i efektów.

„Nowa runda” i „Do weryfikacji” nie stoją na ekranie gry, dopóki nie dostaną działania.

#### Nagłówek i układ

- Nagłówek pokazuje „Kolejka N”, czyli kolejkę rzucającego w bieżącym legu. Free run nie ma kolejki.
- Obok stoi zegar lega liczony od pierwszej rzutki lega, bez przerw między porzuceniem a wznowieniem. W Free run to zegar sesji.
- „Cofnij” stoi w klawiaturze. Po końcu Solo 501, gdy klawiatury już nie ma, stoi osobno pod slotami rzutek.
- Od lg karta zamknięcia stoi na dole prawej kolumny, pod klawiaturą. Poniżej lg stoi pod slotami, nad klawiaturą.

#### Pasek wyników i panel lega

- Pasek wyników pokazuje punkty zbite w legu („▼ 131 w 2 turach”) i ostatnią turę czekających graczy („▼ 60” albo „Bust”).
- Poza treningiem „Końcówki” jest panel lega z historią tur i kafelkami „Najwyższa tura”, „Rzutek w legu” i „Busty”. W Free run panel nie ma kafelków.
- Od lg panel lega stoi w lewej kolumnie pod paskiem wyników, do dołu ekranu. Poniżej lg otwiera go przycisk „Tury” w nagłówku.

#### Klawiatura i skróty

- Liczby leżą domyślnie na kole z 20 na górze i z „25” i „Bull” w środku. Siatkę w tej samej kolejności można wybrać na ekranie „Ustawienia”.
- „25” i „Bull” nie zależą od S/D/T.
- „Reszta Miss” to jedna komenda (`POST /matches/:id/rest-miss`), po której serwer wpisuje Miss za każdą rzutkę, która została w turze.
- Rząd „Najczęstsze: <imię>” pokazuje do 6 najczęstszych trafień rzucającego z `GET /players/:id/frequent-hits` (zamknięte tury gier liczonych do statystyk, bez Miss, np. S20, T20, Bull). Klik wpisuje dokładnie to trafienie bez względu na S/D/T.
- W siatce ten rząd stoi nad liczbami. W kole jest tylko od lg, nad „Miss”. Miejsce na rząd jest zarezerwowane, więc klawiatura nie przesuwa się w trakcie ładowania, po błędzie ani po zmianie gracza.
- Kliknięcie albo dotknięcie karty zamknięcia wpisuje pierwszą rzutkę podpowiedzi.

Skróty na klawiaturze komputera:

- Spacja to Miss. S, D i T zmieniają mnożnik.
- Cyfry wpisują 1-20. Po 1 albo 2 ekran czeka do 1 s na drugą cyfrę, a Enter wpisuje od razu.
- B to 25, Shift+B to Bull, Backspace to „Cofnij”.
- Enter bez czekającej cyfry wpisuje pierwszą rzutkę podpowiedzi zamknięcia.
- Skróty nie działają w polach tekstowych, przy otwartym oknie i z wciśniętym Ctrl, Cmd albo Alt.
- Spacja i Enter z fokusem na przycisku, linku albo przełączniku poza klawiaturą rzutek klikają tę kontrolkę.

#### Komendy i błędy

- Rzutka, której nie udało się zapisać, odrzuca stuknięcia czekające za nią w kolejce. Błąd zostaje do następnej udanej akcji.
- Każde żądanie do API kończy się błędem po 8 s bez odpowiedzi.
- Po błędzie sieci rzutka idzie jeszcze raz, z tym samym `eventId`. „Reszta Miss” po błędzie sieci też idzie jeszcze raz, z tym samym `eventId`.
- „Cofnij”, „Reszta Miss”, próby i pominięcia końcówki, porzucenie, wznowienie i koniec treningu wysyłają ostatni `eventSeq`, który widział ekran.
- Odpowiedź `stale_state` pokazuje bieżący stan z serwera bez błędu, a komenda nie idzie drugi raz. Wyjątkiem są porzucenie, wznowienie i koniec treningu. Idą jeszcze raz z `eventSeq` stanu z odpowiedzi, a druga odmowa pokazuje zwykły błąd tej komendy.

#### Trening „Końcówki”

- Zamiast slotów, sumy tury i klawiatury jest karta celu: wylosowana końcówka, podpowiedź trasy na 3 rzutki i licznik, np. „7 z 12 · 58%”.
- Pod kartą stoją przyciski „Udało się” i „Nie udało się”, a pod nimi w jednym rzędzie „Nowa końcówka” i „Cofnij”.
- Po „Nie udało się” końcówka zostaje do ponownej próby. Nowa losuje się po „Udało się” albo po „Nowa końcówka”.
- „Nowa końcówka” nie jest próbą, więc nie zmienia licznika ani listy prób.
- „Cofnij” cofa ostatnią próbę albo ostatnie pominięcie i przywraca poprzednią końcówkę.
- Pasek wyników pokazuje „Próby”, „Udane” i „Skuteczność”, a pod nim jest lista do 5 ostatnich prób.
- Nagłówek nie ma kolejki ani zegara.
- Skróty: Enter albo 1 to „Udało się”, 0 to „Nie udało się”, N to „Nowa końcówka”, Backspace to „Cofnij”. Działają tylko w trwającej sesji z połączeniem z serwerem, z tymi samymi wyjątkami co na klawiaturze rzutek i bez reakcji na przytrzymany klawisz. Backspace bez prób i pominięć zostaje dla przeglądarki.
- Zakończony trening pokazuje podsumowanie z liczbą prób, udanych, skutecznością i listą wszystkich prób.

#### Koniec gry

- Po końcu gry podsumowanie pokazuje zamiast kolejki i zegara „Czas gry” jako osobny element z dużą wartością.
- Podsumowanie meczu 1v1 pokazuje przy każdym legu jego czas z ikoną zegara. Trening nie pokazuje czasu lega.
- Podsumowanie pokazuje przy każdym gościu przycisk „Zapisz gracza”.
- Zakończony mecz 1v1 otwiera widok podsumowania z przyciskami „Rewanż” i „Nowy mecz”. Rewanż ma tych samych graczy, punkty i liczbę legów, a kto zaczyna, losuje serwer.
- Podsumowanie meczu 1v1 (pod kartami legów) i zabawy (pod tabelą) ma wykres „Leg N · zejście z wyniku”. Wykres pokazuje pozostały wynik po każdej rzutce ostatniego lega, jedną linię na gracza w kolorze avatara i z własnym wzorem. Bust jest oznaczony ikoną i tekstem „Bust”.
- Siatka wykresu ma linię co kolejkę (3 lotki) i co 50 punktów (301) albo 100 punktów (501, 701), a obie osie mają liczby. Trening nie ma wykresu.
- W zakończonej grze „Cofnij” odlicza czas do `editableUntil`, np. „Cofnij (4:12)”. Potem przycisk jest nieaktywny, a obok stoi kłódka i tekst „Mecz zamknięty, nie można go już zmienić”. Odliczanie idzie z zegara urządzenia, a o zamknięciu decyduje serwer.
- Porzucona gra jest tylko do odczytu, z przyciskiem „Wznów mecz”. Zakończony trening jest tylko do odczytu, bez wznowienia.

#### Osiągnięcia

Osiągnięcie meczu 1v1 (na przykład rekord tury albo najkrótszy leg) pokazuje na 5 s nakładkę z gwiazdką, imieniem gracza i wartością. Nakładka pojawia się także w widoku podsumowania zakończonego meczu i przy wyłączonym głosie.

### `#/stats`: ranking

- Ranking graczy po średniej z ukończonych legów.
- Sześć kafelków z pierwszą piątką: „Win rate”, rekordowy leg, najwyższe zamknięcie, najkrótszy leg, najwyższa tura z meczów 1v1 i „Trafienia T20”.
- Filtr typu gier i filtr „Okres”: „30 dni”, „Kwartał” albo „Cały czas”, domyślnie „Cały czas”. Okres liczy się wstecz od zegara serwera, więc „Kwartał” to ostatnie 90 dni.
- Podtytuł rankingu nazywa okres, np. „Ranking graczy z ostatnich 30 dni”.
- Wybór okresu jest wspólny dla rankingu i karty gracza. Zostaje na urządzeniu w `localStorage` pod kluczem `autoscore.statsPeriod`.
- „Win rate” liczy graczy z co najmniej 3 ukończonymi grami, a przy filtrze „Trening” pokazuje „Tylko mecze i zabawa”.
- Od xl kolumna kafelków przewija się osobno i można do niej przejść klawiszem Tab.

Przycisk „Overall” za „Trening” pokazuje wszystkie gry z wybranego okresu liczone do statystyk razem:

- łączną liczbę lotek,
- średnią ze średnich graczy (każdy gracz z ukończonym legiem waży tyle samo),
- liczbę gier i legów,
- graczy powyżej i poniżej tej średniej, z różnicą i liczbą lotek. Gracze bez ukończonego lega są na końcu.

### `#/stats/:playerId`: karta gracza

- Profil z avatarem i przyciskiem „Edytuj profil”: imię, avatar z tej samej siatki emoji i kolor. Niezmieniony avatar nie jest wysyłany, więc starszy avatar z tekstem zostaje.
- „Archiwizuj” (z potwierdzeniem) albo „Przywróć”. Na liście graczy są też zarchiwizowani, z napisem „Zarchiwizowany”.
- Pod profilem statystyki z filtrem typu gier. Obejmują też „Win rate” („—” bez ukończonych gier) i „Trafienia T20”.
- Wykres formy: średnia z ukończonych legów w każdej z ostatnich 20 gier, dla tego samego filtra, z liniami siatki na okrągłych średnich i numerami gier na osi poziomej.
- Bilans 1v1 z wybranym rywalem z ukończonych meczów 1v1.
- Historia gier gracza.
- Ten sam filtr „Okres” co w rankingu zawęża statystyki, wykres formy i bilans 1v1. Zmiana okresu zostawia wybranego rywala, a historia gier gracza zostaje pełna.

### `#/settings`: ustawienia

- Ustawienia tego urządzenia: układ klawiatury („Koło” albo „Siatka”) oraz przełączniki „Głos”, „Efekty dźwiękowe” i „Komentarze do zera”.
- „Komentarze do zera” są domyślnie wyłączone. Przy wyłączonym głosie przełącznik jest nieaktywny i pokazuje zapisany wybór.
- Wybór zostaje na urządzeniu w `localStorage` pod kluczami `autoscore.keypadLayout`, `autoscore.voice`, `autoscore.effects` i `autoscore.zeroComments`.

### `#/history`: historia

Historia wszystkich gier, od ostatnio aktywnej, z filtrem typu (trening obejmuje też Free run). Każdy wiersz ma datę, typ, graczy z wynikiem, status z ikoną i tekstem oraz link „Szczegóły” do `#/matches/:id`.

## Pierwsze ładowanie

Kod ekranów statystyk, historii i ustawień wczytuje się dopiero po wejściu na nie (`React.lazy` w `src/App.tsx`). W trakcie `LazyScreen` pokazuje „Ładowanie…”, a gdy kod się nie wczyta, na przykład po wdrożeniu nowej wersji przy otwartej karcie, „Nie udało się wczytać ekranu.” z przyciskiem „Odśwież stronę”. Fonty Barlow i Barlow Condensed idą tylko w podzbiorach `latin` i `latin-ext`, w którym są polskie litery.

## Okna i komunikaty

- Okna (nowy gracz, edycja i archiwizacja gracza, porzucenie meczu, koniec treningu) otwierają się jako natywny modalny `<dialog>`. Fokus zostaje w oknie, a strona pod spodem nie reaguje.
- Po zamknięciu fokus wraca do przycisku, który okno otworzył. Przy oknie otwartym z menu gry wraca do przycisku „Menu gry”.
- Gdy okno nowego gracza albo edycji gracza zapisuje dane, Escape i „Anuluj” nic nie robią.
- Czytniki ekranu ogłaszają od razu (`role="alert"`) komunikaty `Notice` o błędach i utracie połączenia, błąd startu gry i błędy w oknach gracza. Komunikaty o grze tylko do odczytu i zamkniętym meczu idą jako `role="status"`.
- Błędy API przy starcie gry i w oknach gracza pokazują polski tekst wybrany po kodzie błędu, nigdy angielski komunikat serwera.

## Logowanie

- Ekran logowania pojawia się tylko wtedy, gdy serwer ma ustawione hasło i odpowiada `401` z kodem `unauthorized`. Zastępuje bieżący ekran, a po zalogowaniu ten sam ekran wraca.
- Bez hasła na serwerze front działa jak wcześniej, bez logowania.
- Token zostaje w `localStorage` pod kluczem `autoscore.token`.
- Każde żądanie REST wysyła token w nagłówku `Authorization: Bearer <token>`. Połączenie na żywo wysyła najpierw wiadomość `{ "type": "auth", "token": "…" }`.
- Wygasły token albo zmieniony klucz serwera kończy się odrzuceniem tokenu (`401` albo zamknięcie WebSocketa kodem `4401`). Front usuwa wtedy token i znów pokazuje ekran logowania.

## Struktura

- `src/api/`: klient REST, token i sygnał logowania (`session.ts`), generowanie `eventId`, hook stanu gry z WebSocketem i ponownym połączeniem, hook podsumowania meczu.
- `src/audio/`: głos z nagrań (`recorded-speaker.ts`) z Web Speech API jako zapasem, efekty przez Web Audio API, hook `useAnnouncer`.
- `src/components/`:
  - wspólne okno modalne (`Dialog`), komunikat (`Notice`) i ekran wczytywany na żądanie (`LazyScreen`),
  - górna nawigacja, avatar, przełączniki, ikony,
  - formularz nowej gry z podsumowaniem, okno nowego gracza, lista gier do dokończenia,
  - historia gier (`MatchHistoryList`), ranking, profil gracza (`PlayerProfile`) z oknami edycji i archiwizacji,
  - wykres formy (`FormChart`), wykres zejścia z wyniku w ostatnim legu (`ScoreProgressChart`), bilans 1v1 (`HeadToHeadPanel`), panele statystyk i podsumowania meczu,
  - pasek wyników, panel tury, klawiatura, nagłówek gry, komunikaty osiągnięć (`AchievementNotices`), okna porzucenia meczu i zakończenia treningu.
- `src/game/`: podpowiedź zamknięcia i jej trasa dla bieżącej tury (`checkout-route.ts`), skróty klawiatury (`keypad-shortcut.ts`) i składanie cyfr w liczbę (`shortcut-number.ts`), etykiety trafień, kolejność paska wyników, formatowanie statystyk, stan formularza nowej gry, teksty i data aktywności na liście gier do dokończenia, teksty wiersza historii (`history-row.ts`), współrzędne, siatka i etykiety osi wykresu formy (`form-chart.ts`) i wykresu zejścia z wyniku (`score-progress-chart.ts`), teksty osiągnięć (`achievement-text.ts`), reguły porzucenia i zakończenia treningu.
- `src/screens/`: `HomeScreen`, `GameScreen`, `StatsScreen`, `HistoryScreen`, `SettingsScreen` i `LoginScreen`.
- `src/i18n/`: teksty po polsku.

## Ikony i kolor przeglądarki

- Ikona karty to znak aplikacji w `public/favicon.svg` (kopia `design/scena/assets/Logo/autoscore-mark.svg`).
- Ikona ekranu głównego tabletu i telefonu to ten sam znak na tle sceny w `public/apple-touch-icon.png` (180 px).
- `theme-color` w `index.html` to kolor tła sceny (`--color-bg`).

## Dźwięk

- Głos i efekty są domyślnie włączone na każdym urządzeniu. Przełączniki są na ekranie gry i na ekranie „Ustawienia”. Wybór z nich zostaje w `localStorage` pod kluczami `autoscore.voice` i `autoscore.effects`.
- Na drugim ekranie wyłącz je ręcznie, żeby wynik nie był czytany dwa razy. Nic nie wyłącza ich automatycznie.
- Głos gra nagrania z `public/audio/pl/`. Komunikat to lista nagrań grana po kolei:
  1. wynik tury (albo bust, game shot, zwycięzca),
  2. po turze za 0 jeden z dwóch żartobliwych komentarzy, tylko gdy przełącznik „Komentarze do zera” w „Ustawieniach” jest włączony,
  3. na końcu po jednym nagraniu na każdy rodzaj osiągnięcia meczu 1v1.
- Gdy nagrania brak albo nie da się go odtworzyć (błąd sieci, blokada autoodtwarzania), tę część czyta Web Speech API, a po odczycie gra następna.
- Ekran gry wczytuje 16 nagrań zdarzeń (także komentarze i osiągnięcia) od razu, a nagrania sum przy pierwszym użyciu.
- Logikę komunikatów dostarcza [@autoscore/audio](../audio/README.md).

## Testy

```sh
pnpm --filter @autoscore/web test
```

Vitest w środowisku jsdom z Testing Library. Konfiguracja jest w bloku `test` w `vite.config.ts`, a przygotowanie środowiska w `src/test-setup.ts`.

Testy jednostkowe sprawdzają zachowanie przez rolę, nazwę, tekst i stan (`aria-*`, `data-pressed`, `data-flash`, `checked`, `disabled`), a nie przez klasy Tailwinda. jsdom nie wczytuje CSS, więc układ (przewijanie, mieszczenie się w oknie, położenie klawiatury) sprawdza `e2e/layout.spec.ts` w prawdziwej przeglądarce. Klasę sprawdzamy tylko wtedy, gdy to ona jest znaczeniem, na przykład stały kolor awatara, i taka linia ma nad sobą komentarz z powodem.

## Katalog komponentów (describe-me)

Katalog pokazuje stany komponentów zapisane z testów Vitesta, klatka po klatce, oraz zakładkę Foundations z tokenami motywu. Na razie nagrywane są tylko `Scoreboard`, `Keypad` i `MatchEndView`.

```sh
pnpm --filter @autoscore/web test   # zapisuje dane do packages/web/.describe-me/
pnpm run docs                       # przeglądarka katalogu na http://localhost:6006
```

Sam `pnpm docs` uruchamia wbudowaną komendę pnpm, dlatego potrzebny jest `pnpm run docs`. Statyczną kopię katalogu zapisuje `pnpm --filter @autoscore/web docs:build` do `packages/web/describe-me-dist/`. Oba katalogi są tylko lokalne, git je ignoruje i nic ich nie publikuje.

Nowy komponent trafia do katalogu po dopisaniu jego pliku testów do `include` w `describeMe()` w `vite.config.ts`. Tokeny w Foundations pochodzą z `src/theme.css`, który nagrywane testy importują same.
