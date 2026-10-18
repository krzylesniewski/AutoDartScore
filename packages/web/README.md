# @autoscore/web

Front: SPA w React 19 i Vite, układ pod tablet w poziomie. Style to Tailwind 4 oparty tylko na tokenach motywu z [design/theme.css](../../design/theme.css), importowanych w `src/theme.css`. Teksty dla użytkownika są po polsku w `src/i18n/pl.ts`.

## Uruchomienie

```sh
pnpm --filter @autoscore/web dev
```

Front potrzebuje działającego serwera. Vite przekazuje `/api` (także WebSocket) do adresu z `AUTOSCORE_API_URL`, domyślnie `http://localhost:3000`, i obcina prefiks `/api`. Serwer Vite nasłuchuje na wszystkich interfejsach, więc tablet w sieci otwiera `http://<adres-IP-komputera>:5173`. Całość, czyli serwer i front razem, uruchamia `pnpm dev` w katalogu głównym, zobacz [README](../../README.md).

## Ekrany

Routing przez hash w `src/App.tsx`:

- `#/`: ekran startowy. Po lewej formularz nowej gry: najpierw „Mecz 1v1”, „Zabawa” albo „Trening”, potem gracze (od ostatnio aktywnego) z przyciskiem „+ Nowy gracz” (imię i avatar emoji) i opcje zależne od typu: punkty startowe, liczba legów albo tryb treningu (Free run, Solo 501). Po prawej podsumowanie wybranych ustawień i lista gier do dokończenia (w trakcie i porzuconych, od najnowszej) z przyciskiem „Dokończ”, „Porzuć” po co najmniej jednym ukończonym legu oraz „Zakończ trening” (z potwierdzeniem) w treningu po pierwszej rzutce. Zakończony trening znika z listy.
- `#/matches/:id`: ekran gry. Pasek wyników, trzy sloty rzutek, suma tury, podpowiedź zamknięcia, klawiatura (1-20, 25, Miss, S/D/T), „Cofnij”, „Porzuć mecz” (z potwierdzeniem, po co najmniej jednym ukończonym legu), „Zakończ trening” (z potwierdzeniem, w treningu po pierwszej rzutce) i przełączniki głosu i efektów. Porzucona gra jest tylko do odczytu, z przyciskiem „Wznów mecz”. Zakończony trening jest tylko do odczytu, bez wznowienia. „Nowa runda” i „Do weryfikacji” są nieaktywne, z etykietą „Wkrótce”.
- `#/stats`: ranking graczy po średniej z ukończonych legów i cztery kafelki z pierwszą trójką (rekordowy leg, najwyższe zamknięcie, najkrótszy leg, liczba 180), z filtrem typu gier.
- `#/stats/:playerId`: karta statystyk jednego gracza z filtrem typu gier.
- Każdy inny adres przekierowuje na `#/`.

## Struktura

- `src/api/`: klient REST, generowanie `eventId`, hook stanu gry z WebSocketem i ponownym połączeniem, hook podsumowania meczu.
- `src/audio/`: głos przez Web Speech API, efekty przez Web Audio API, hook `useAnnouncer`.
- `src/components/`: górna nawigacja, avatar, formularz nowej gry z podsumowaniem, okno nowego gracza, lista gier do dokończenia, ranking, pasek wyników, panel tury, klawiatura, nagłówek gry, okna porzucenia meczu i zakończenia treningu, panele statystyk i podsumowania meczu, przełączniki, ikony.
- `src/game/`: podpowiedź zamknięcia, etykiety trafień, kolejność paska wyników, formatowanie statystyk, stan formularza nowej gry, teksty i data aktywności na liście gier do dokończenia, reguły porzucenia i zakończenia treningu.
- `src/screens/`: `HomeScreen`, `GameScreen` i `StatsScreen`.
- `src/i18n/`: teksty po polsku.

## Dźwięk

Głos i efekty są domyślnie włączone na każdym urządzeniu. Wybór z przełączników zostaje w `localStorage` pod kluczami `autoscore.voice` i `autoscore.effects`. Na drugim ekranie wyłącz je ręcznie, żeby wynik nie był czytany dwa razy. Nic nie wyłącza ich automatycznie. Logikę komunikatów dostarcza [@autoscore/audio](../audio/README.md).

## Testy

```sh
pnpm --filter @autoscore/web test
```

Vitest w środowisku jsdom z Testing Library. Konfiguracja jest w bloku `test` w `vite.config.ts`, a przygotowanie środowiska w `src/test-setup.ts`.
