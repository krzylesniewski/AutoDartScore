# @autoscore/audio

Zamienia wiadomości na żywo i zdarzenia domenowe na polski komunikat głosowy i efekt dźwiękowy. Nie używa API przeglądarki. Mowę i dźwięk dostarcza wywołujący przez interfejsy `Speaker` i `EffectPlayer`. Implementacje dla przeglądarki są w `packages/web/src/audio/` (`recorded-speaker.ts`, `web-speech-speaker.ts`, `web-audio-effect-player.ts`, `use-announcer.ts`).

## API

- `createAnnouncer(speaker, effects?, random?, options?)`: zwraca `Announcer` z metodami `handle(message)` dla każdej wiadomości WebSocket i `stop()`. `random` wybiera wariant nagrania i domyślnie jest `Math.random`. `options.zeroComments` to funkcja zwracająca, czy po turze za 0 grać komentarz. Announcer wywołuje ją przy każdym komunikacie. Bez niej komentarza nie ma.
- `Speaker`: `speak(announcement)` i `cancel()`. Speaker gra części komunikatu po kolei i dla każdej sam wybiera, czy gra nagranie, czy czyta `text`. `cancel()` przerywa całą listę.
- `EffectPlayer`: `play(effect)` zwraca, ile ms głos ma czekać na koniec efektu, oraz `stop()`.
- `announcementFor(events, achievements, random, options?)`: komunikat dla zdarzeń i rodzajów osiągnięć (`AchievementKind`) jednej rzutki albo `null`. Bez głównego odczytu zwraca `null`, także z osiągnięciami. Komunikat ma pola `kind` (`score`, `bust`, `winner` albo `game_shot`, rodzaj głównego odczytu) i `parts`, niepustą listę części `{ text, clip }`. `random` zwraca liczbę z `[0, 1)` jak `Math.random` i jest wywoływane tylko przy wyborze wariantu: najpierw głównego odczytu, potem komentarza do zera. Komentarz do zera, a więc i jego losowanie, jest tylko z `options.zeroComments: true`. Domyślnie go nie ma.
- `clip` części: ścieżka nagrania względem folderu języka, na przykład `scores/100.mp3` albo `events/bust_2.mp3`. `null` oznacza brak nagrania, wtedy zostaje odczyt `text`. Sumy 163, 166, 169, 172, 173, 175, 176, 178 i 179 nie mają nagrań, bo trzema rzutkami nie da się ich zdobyć.
- `EVENT_CLIPS`: ścieżki 16 nagrań zdarzeń (bust, game shot, zwycięzca, komentarze do zera i osiągnięcia), do wczytania z wyprzedzeniem.
- `ACHIEVEMENT_CLIPS`: ścieżka nagrania dla każdego rodzaju osiągnięcia, w kolejności odczytu.
- `spokenNumber(value)`: liczba słownie po polsku, na przykład „sto”, „czterdzieści pięć”.
- `soundEffectFor(events)`: `bust`, `fanfare_short` (wygrany leg, miejsce poza pierwszym w zabawie), `fanfare_long` (wygrany mecz, pierwsze miejsce w zabawie) albo `null`.
- `effectTones(effect)` i `effectDurationMs(effect)`: tony efektu i jego długość.
- `pl`: teksty komunikatów („Bust”, „Zwycięzca”, „Game shot”), dwa komentarze do zera („Tarcza wisi trochę wyżej”, „Następnym razem będzie lepiej”) i teksty osiągnięć, na przykład „Nowy rekord tury” albo „Pierwsza setka”. Speaker czyta je, gdy brakuje nagrania.

## Działanie announcera

- Serwer wysyła na jedną rzutkę paczkę wiadomości z tym samym `eventSeq`. Announcer zbiera zdarzenia domenowe i rodzaje osiągnięć (`achievement`) i reaguje raz, na `state_updated` z tym `eventSeq`. Wiadomość z innym `eventSeq` czyści oba bufory.
- Paczka daje najwyżej jeden komunikat. Główny odczyt to zwycięzca (`match_won` albo pierwsze miejsce w zabawie, jedno z dwóch nagrań), bust (jedno z trzech nagrań), game shot albo suma tury, w tej kolejności ważności.
- Po sumie tury 0 idzie jeden z dwóch komentarzy, tylko gdy `options.zeroComments` zwraca `true`. Bust nigdy go nie dostaje.
- Na końcu idzie po jednym nagraniu na rodzaj osiągnięcia: `first_100`, `first_120`, `first_140`, `first_180`, `turn_record`, `checkout_record`, `shortest_leg`, `longest_leg`. Nagrania nie mają imienia, więc dwa `longest_leg` z jednego lega dają jedno nagranie.
- Game shot zastępuje sumę tury przy każdym `leg_won`, który nie kończy meczu (leg 1v1, zamknięcie w Solo 501), i przy drugim lub dalszym miejscu w zabawie.
- Najpierw gra efekt, potem głos. Głos czeka tyle ms, ile zwróci `EffectPlayer.play`.
- Nowy komunikat przerywa cały poprzedni. `throw_undone` też przerywa trwający komunikat. Paczka bez efektu i bez komunikatu (pierwsza i druga rzutka następnego gracza) niczego nie przerywa.
- Stan wysyłany po połączeniu nigdy nie jest czytany.

## Testy

```sh
pnpm --filter @autoscore/audio test
```
