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

- `#/`: ekran startowy. Po lewej formularz nowej gry: najpierw „Mecz 1v1”, „Zabawa” albo „Trening”, potem gracze (od ostatnio aktywnego) z przyciskiem „+ Nowy gracz” (imię i avatar emoji) i opcje zależne od typu: punkty startowe, liczba legów albo tryb treningu (Free run, Solo 501). Po prawej podsumowanie wybranych ustawień i lista gier do dokończenia (w trakcie i porzuconych, od najnowszej) z przyciskiem „Dokończ”, „Porzuć” po co najmniej jednym ukończonym legu oraz „Zakończ trening” (z potwierdzeniem) w treningu po pierwszej rzutce. Zakończony trening znika z listy.
- `#/matches/:id`: ekran gry. Pasek wyników, trzy sloty rzutek, suma tury, podpowiedź zamknięcia, klawiatura (1-20 w kolejności z tarczy, osobne „25” i „Bull”, „Miss”, „Reszta Miss” i S/D/T), „Cofnij”, „Porzuć mecz” (z potwierdzeniem, po co najmniej jednym ukończonym legu), „Zakończ trening” (z potwierdzeniem, w treningu po pierwszej rzutce) i przełączniki głosu i efektów. Po końcu gry podsumowanie pokazuje przy każdym gościu przycisk „Zapisz gracza”. Zakończony mecz 1v1 otwiera widok podsumowania z przyciskami „Rewanż” (ci sami gracze, punkty i liczba legów, kto zaczyna losuje serwer) i „Nowy mecz”. Porzucona gra jest tylko do odczytu, z przyciskiem „Wznów mecz”. Zakończony trening jest tylko do odczytu, bez wznowienia. „Nowa runda” i „Do weryfikacji” są nieaktywne, z etykietą „Wkrótce”. Liczby na klawiaturze leżą domyślnie na kole z 20 na górze i z „25” i „Bull” w środku. Przełącznik obok S/D/T zmienia koło na siatkę w tej samej kolejności. Wybór zostaje na urządzeniu w `localStorage` pod kluczem `autoscore.keypadLayout`. „25” i „Bull” nie zależą od S/D/T. „Reszta Miss” wpisuje Miss za każdą rzutkę, która została w turze. Na klawiaturze komputera Spacja to Miss, S, D i T zmieniają mnożnik, cyfry wpisują 1-20 (po 1 albo 2 ekran czeka do 1 s na drugą cyfrę, Enter wpisuje od razu), B to 25, Shift+B to Bull, Backspace to „Cofnij”, a Enter bez czekającej cyfry wpisuje pierwszą rzutkę podpowiedzi zamknięcia. Skróty nie działają w polach tekstowych, przy otwartym oknie i z wciśniętym Ctrl, Cmd albo Alt. Kliknięcie albo dotknięcie panelu zamknięcia też wpisuje pierwszą rzutkę podpowiedzi.
- `#/stats`: ranking graczy po średniej z ukończonych legów i cztery kafelki z pierwszą trójką (rekordowy leg, najwyższe zamknięcie, najkrótszy leg, najwyższa tura z meczów 1v1), z filtrem typu gier.
- `#/stats/:playerId`: karta jednego gracza. Profil z avatarem, „Edytuj profil” (imię i avatar), „Archiwizuj” (z potwierdzeniem) albo „Przywróć”. Na liście graczy są też zarchiwizowani, z napisem „Zarchiwizowany”. Pod profilem statystyki z filtrem typu gier, wykres formy (średnia z ukończonych legów w każdej z ostatnich 20 gier, dla tego samego filtra), bilans 1v1 z wybranym rywalem z ukończonych meczów 1v1 i historia gier gracza.
- `#/history`: historia wszystkich gier, od ostatnio aktywnej, z filtrem typu (trening obejmuje też Free run). Każdy wiersz ma datę, typ, graczy z wynikiem, status z ikoną i tekstem oraz link „Szczegóły” do `#/matches/:id`.
- Każdy inny adres przekierowuje na `#/`.

## Logowanie

Ekran logowania pojawia się tylko wtedy, gdy serwer ma ustawione hasło i odpowiada `401` z kodem `unauthorized`. Zastępuje bieżący ekran, a po zalogowaniu ten sam ekran wraca. Bez hasła na serwerze front działa jak wcześniej, bez logowania. Token zostaje w `localStorage` pod kluczem `autoscore.token`. Każde żądanie REST wysyła go w nagłówku `Authorization: Bearer <token>`, a połączenie na żywo wysyła najpierw wiadomość `{ "type": "auth", "token": "…" }`. Wygasły token albo zmieniony klucz serwera kończy się odrzuceniem tokenu (`401` albo zamknięcie WebSocketa kodem `4401`), więc front usuwa token i znów pokazuje ekran logowania.

## Struktura

- `src/api/`: klient REST, token i sygnał logowania (`session.ts`), generowanie `eventId`, hook stanu gry z WebSocketem i ponownym połączeniem, hook podsumowania meczu.
- `src/audio/`: głos z nagrań (`recorded-speaker.ts`) z Web Speech API jako zapasem, efekty przez Web Audio API, hook `useAnnouncer`.
- `src/components/`: górna nawigacja, avatar, formularz nowej gry z podsumowaniem, okno nowego gracza, lista gier do dokończenia, historia gier (`MatchHistoryList`), ranking, profil gracza (`PlayerProfile`) z oknami edycji i archiwizacji, wykres formy (`FormChart`), bilans 1v1 (`HeadToHeadPanel`), pasek wyników, panel tury, klawiatura, nagłówek gry, okna porzucenia meczu i zakończenia treningu, panele statystyk i podsumowania meczu, przełączniki, ikony.
- `src/game/`: podpowiedź zamknięcia i jej trasa dla bieżącej tury (`checkout-route.ts`), skróty klawiatury (`keypad-shortcut.ts`) i składanie cyfr w liczbę (`shortcut-number.ts`), etykiety trafień, kolejność paska wyników, formatowanie statystyk, stan formularza nowej gry, teksty i data aktywności na liście gier do dokończenia, teksty wiersza historii (`history-row.ts`), współrzędne wykresu formy (`form-chart.ts`), reguły porzucenia i zakończenia treningu.
- `src/screens/`: `HomeScreen`, `GameScreen`, `StatsScreen`, `HistoryScreen` i `LoginScreen`.
- `src/i18n/`: teksty po polsku.

## Dźwięk

Głos i efekty są domyślnie włączone na każdym urządzeniu. Wybór z przełączników zostaje w `localStorage` pod kluczami `autoscore.voice` i `autoscore.effects`. Na drugim ekranie wyłącz je ręcznie, żeby wynik nie był czytany dwa razy. Nic nie wyłącza ich automatycznie. Głos gra nagrania z `public/audio/pl/`. Gdy nagrania brak albo nie da się go odtworzyć (błąd sieci, blokada autoodtwarzania), ten sam komunikat czyta Web Speech API. Ekran gry wczytuje nagrania zdarzeń od razu, a nagrania sum przy pierwszym użyciu. Logikę komunikatów dostarcza [@autoscore/audio](../audio/README.md).

## Testy

```sh
pnpm --filter @autoscore/web test
```

Vitest w środowisku jsdom z Testing Library. Konfiguracja jest w bloku `test` w `vite.config.ts`, a przygotowanie środowiska w `src/test-setup.ts`.
