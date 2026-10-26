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
| `VITE_BASE` | `/` | Ścieżka bazowa builda, gdy aplikacja jest pod podścieżką. Musi zaczynać się i kończyć na `/`. | `/AutoDartScore/` |

Obie zmienne są czytane przy starcie Vite (`build` i `dev`), więc zmiana wymaga nowego builda albo restartu serwera Vite. Bez `VITE_API_URL` front woła `/api` przez proxy Vite. Z nią front woła API bezpośrednio, a WebSocket używa `wss://` albo `ws://` zależnie od schematu tego adresu. `VITE_BASE` pochodzi ze zmiennych środowiskowych powłoki, nie z plików `.env`:

```sh
VITE_BASE=/AutoDartScore/ VITE_API_URL=https://api.example.com pnpm --filter @autoscore/web build
```

## Ekrany

Routing przez hash w `src/App.tsx`:

- `#/`: ekran startowy. Po lewej formularz nowej gry: najpierw „Mecz 1v1”, „Zabawa” albo „Trening”, potem gracze (od ostatnio aktywnego) z przyciskiem „+ Nowy gracz” (imię, avatar emoji i jeden z 16 kolorów, bez wyboru dobrany automatycznie) i opcje zależne od typu: punkty startowe, liczba legów albo tryb treningu (Free run, Solo 501, Końcówki), a przy „Końcówkach” przedział „2-50” albo „51-100” (domyślnie 2-50). Po prawej podsumowanie wybranych ustawień i lista gier do dokończenia (w trakcie i porzuconych, od najnowszej) z przyciskiem „Dokończ”, „Porzuć” po co najmniej jednym ukończonym legu oraz „Zakończ trening” (z potwierdzeniem) w treningu po pierwszej rzutce, a w „Końcówkach” po pierwszej próbie. Wiersz „Końcówek” pokazuje udane próby, wszystkie próby i skuteczność, np. „7/12” i „58%”. Zakończony trening znika z listy.
- `#/matches/:id`: ekran gry. Pasek wyników, trzy sloty rzutek, suma tury, podpowiedź zamknięcia, klawiatura (1-20 w kolejności z tarczy, osobne „25” i „Bull”, „Miss”, „Reszta Miss” i S/D/T), „Cofnij”, „Porzuć mecz” (z potwierdzeniem, po co najmniej jednym ukończonym legu), „Zakończ trening” (z potwierdzeniem, w treningu po pierwszej rzutce albo próbie) i przełączniki głosu i efektów. Nagłówek pokazuje „Kolejka N” (kolejka rzucającego w bieżącym legu, bez niej w Free run) i zegar lega liczony od pierwszej rzutki lega bez przerw między porzuceniem a wznowieniem (w Free run zegar sesji), a po końcu gry podsumowanie pokazuje zamiast nich „Czas gry”. Po końcu gry podsumowanie pokazuje przy każdym gościu przycisk „Zapisz gracza”. Zakończony mecz 1v1 otwiera widok podsumowania z przyciskami „Rewanż” (ci sami gracze, punkty i liczba legów, kto zaczyna losuje serwer) i „Nowy mecz”. Podsumowanie meczu 1v1 (pod kartami legów) i zabawy (pod tabelą) ma wykres „Leg N · zejście z wyniku”: pozostały wynik po każdej rzutce ostatniego lega, jedna linia na gracza w kolorze avatara i z własnym wzorem, bust oznaczony ikoną i tekstem „Bust”. Trening nie ma wykresu. W zakończonej grze „Cofnij” odlicza czas do `editableUntil`, np. „Cofnij (4:12)”. Potem przycisk jest nieaktywny, a obok stoi kłódka i tekst „Mecz zamknięty, nie można go już zmienić”. Odliczanie idzie z zegara urządzenia, a o zamknięciu decyduje serwer. Porzucona gra jest tylko do odczytu, z przyciskiem „Wznów mecz”. Zakończony trening jest tylko do odczytu, bez wznowienia. „Nowa runda” i „Do weryfikacji” są nieaktywne, z etykietą „Wkrótce”. Liczby na klawiaturze leżą domyślnie na kole z 20 na górze i z „25” i „Bull” w środku. Siatkę w tej samej kolejności można wybrać na ekranie „Ustawienia”. „25” i „Bull” nie zależą od S/D/T. „Reszta Miss” wpisuje Miss za każdą rzutkę, która została w turze. Rząd „Najczęstsze: <imię>” pokazuje do 6 najczęstszych trafień rzucającego z `GET /players/:id/frequent-hits` (zamknięte tury gier liczonych do statystyk, bez Miss, np. S20, T20, Bull). Klik wpisuje dokładnie to trafienie bez względu na S/D/T. W siatce rząd stoi nad liczbami. W kole jest tylko od lg, nad „Miss”. Miejsce na rząd jest zarezerwowane, więc klawiatura nie przesuwa się w trakcie ładowania, po błędzie ani po zmianie gracza. Na klawiaturze komputera Spacja to Miss, S, D i T zmieniają mnożnik, cyfry wpisują 1-20 (po 1 albo 2 ekran czeka do 1 s na drugą cyfrę, Enter wpisuje od razu), B to 25, Shift+B to Bull, Backspace to „Cofnij”, a Enter bez czekającej cyfry wpisuje pierwszą rzutkę podpowiedzi zamknięcia. Skróty nie działają w polach tekstowych, przy otwartym oknie i z wciśniętym Ctrl, Cmd albo Alt. Kliknięcie albo dotknięcie panelu zamknięcia też wpisuje pierwszą rzutkę podpowiedzi. W treningu „Końcówki” zamiast slotów, sumy tury i klawiatury jest karta celu: wylosowana końcówka, podpowiedź trasy na 3 rzutki i licznik, np. „7 z 12 · 58%”. Pod nią stoją przyciski „Udało się” i „Nie udało się”, a pod nimi w jednym rzędzie „Nowa końcówka” i „Cofnij”. Po „Nie udało się” końcówka zostaje do ponownej próby, a nowa losuje się po „Udało się” albo po „Nowa końcówka”. „Nowa końcówka” nie jest próbą, więc nie zmienia licznika ani listy prób. „Cofnij” cofa ostatnią próbę albo ostatnie pominięcie i przywraca poprzednią końcówkę. Pasek wyników pokazuje „Próby”, „Udane” i „Skuteczność”, a pod nim jest lista do 5 ostatnich prób. Nagłówek nie ma kolejki ani zegara. Skróty: Enter albo 1 to „Udało się”, 0 to „Nie udało się”, N to „Nowa końcówka”, Backspace to „Cofnij”. Działają tylko w trwającej sesji z połączeniem z serwerem, z tymi samymi wyjątkami co na klawiaturze rzutek i bez reakcji na przytrzymany klawisz. Backspace bez prób i pominięć zostaje dla przeglądarki. Zakończony trening pokazuje podsumowanie z liczbą prób, udanych, skutecznością i listą wszystkich prób. Osiągnięcie meczu 1v1 (na przykład rekord tury albo najkrótszy leg) pokazuje na 5 s nakładkę z gwiazdką, imieniem gracza i wartością, także w widoku podsumowania zakończonego meczu i przy wyłączonym głosie.
- `#/stats`: ranking graczy po średniej z ukończonych legów i cztery kafelki z pierwszą piątką (rekordowy leg, najwyższe zamknięcie, najkrótszy leg, najwyższa tura z meczów 1v1), z filtrem typu gier.
- `#/stats/:playerId`: karta jednego gracza. Profil z avatarem, „Edytuj profil” (imię, avatar i kolor), „Archiwizuj” (z potwierdzeniem) albo „Przywróć”. Na liście graczy są też zarchiwizowani, z napisem „Zarchiwizowany”. Pod profilem statystyki z filtrem typu gier, wykres formy (średnia z ukończonych legów w każdej z ostatnich 20 gier, dla tego samego filtra), bilans 1v1 z wybranym rywalem z ukończonych meczów 1v1 i historia gier gracza.
- `#/settings`: ustawienia tego urządzenia. Układ klawiatury („Koło” albo „Siatka”) oraz przełączniki „Głos” i „Efekty dźwiękowe”. Wybór zostaje na urządzeniu w `localStorage` pod kluczami `autoscore.keypadLayout`, `autoscore.voice` i `autoscore.effects`.
- `#/history`: historia wszystkich gier, od ostatnio aktywnej, z filtrem typu (trening obejmuje też Free run). Każdy wiersz ma datę, typ, graczy z wynikiem, status z ikoną i tekstem oraz link „Szczegóły” do `#/matches/:id`.
- Każdy inny adres przekierowuje na `#/`.

## Logowanie

Ekran logowania pojawia się tylko wtedy, gdy serwer ma ustawione hasło i odpowiada `401` z kodem `unauthorized`. Zastępuje bieżący ekran, a po zalogowaniu ten sam ekran wraca. Bez hasła na serwerze front działa jak wcześniej, bez logowania. Token zostaje w `localStorage` pod kluczem `autoscore.token`. Każde żądanie REST wysyła go w nagłówku `Authorization: Bearer <token>`, a połączenie na żywo wysyła najpierw wiadomość `{ "type": "auth", "token": "…" }`. Wygasły token albo zmieniony klucz serwera kończy się odrzuceniem tokenu (`401` albo zamknięcie WebSocketa kodem `4401`), więc front usuwa token i znów pokazuje ekran logowania.

## Struktura

- `src/api/`: klient REST, token i sygnał logowania (`session.ts`), generowanie `eventId`, hook stanu gry z WebSocketem i ponownym połączeniem, hook podsumowania meczu.
- `src/audio/`: głos z nagrań (`recorded-speaker.ts`) z Web Speech API jako zapasem, efekty przez Web Audio API, hook `useAnnouncer`.
- `src/components/`: górna nawigacja, avatar, formularz nowej gry z podsumowaniem, okno nowego gracza, lista gier do dokończenia, historia gier (`MatchHistoryList`), ranking, profil gracza (`PlayerProfile`) z oknami edycji i archiwizacji, wykres formy (`FormChart`), wykres zejścia z wyniku w ostatnim legu (`ScoreProgressChart`), bilans 1v1 (`HeadToHeadPanel`), komunikaty osiągnięć (`AchievementNotices`), pasek wyników, panel tury, klawiatura, nagłówek gry, okna porzucenia meczu i zakończenia treningu, panele statystyk i podsumowania meczu, przełączniki, ikony.
- `src/game/`: podpowiedź zamknięcia i jej trasa dla bieżącej tury (`checkout-route.ts`), skróty klawiatury (`keypad-shortcut.ts`) i składanie cyfr w liczbę (`shortcut-number.ts`), etykiety trafień, kolejność paska wyników, formatowanie statystyk, stan formularza nowej gry, teksty i data aktywności na liście gier do dokończenia, teksty wiersza historii (`history-row.ts`), współrzędne wykresu formy (`form-chart.ts`), teksty osiągnięć (`achievement-text.ts`), reguły porzucenia i zakończenia treningu.
- `src/screens/`: `HomeScreen`, `GameScreen`, `StatsScreen`, `HistoryScreen`, `SettingsScreen` i `LoginScreen`.
- `src/i18n/`: teksty po polsku.

## Dźwięk

Głos i efekty są domyślnie włączone na każdym urządzeniu. Przełączniki są na ekranie gry i na ekranie „Ustawienia”. Wybór z nich zostaje w `localStorage` pod kluczami `autoscore.voice` i `autoscore.effects`. Na drugim ekranie wyłącz je ręcznie, żeby wynik nie był czytany dwa razy. Nic nie wyłącza ich automatycznie. Głos gra nagrania z `public/audio/pl/`. Komunikat to lista nagrań grana po kolei: najpierw wynik tury (albo bust, game shot, zwycięzca), po turze za 0 jeden z dwóch żartobliwych komentarzy, a na końcu po jednym nagraniu na każdy rodzaj osiągnięcia meczu 1v1. Gdy nagrania brak albo nie da się go odtworzyć (błąd sieci, blokada autoodtwarzania), tę część czyta Web Speech API, a po odczycie gra następna. Ekran gry wczytuje 16 nagrań zdarzeń (także komentarze i osiągnięcia) od razu, a nagrania sum przy pierwszym użyciu. Logikę komunikatów dostarcza [@autoscore/audio](../audio/README.md).

## Testy

```sh
pnpm --filter @autoscore/web test
```

Vitest w środowisku jsdom z Testing Library. Konfiguracja jest w bloku `test` w `vite.config.ts`, a przygotowanie środowiska w `src/test-setup.ts`.
