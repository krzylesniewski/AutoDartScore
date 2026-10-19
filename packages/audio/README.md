# @autoscore/audio

Zamienia wiadomości na żywo i zdarzenia domenowe na polski komunikat głosowy i efekt dźwiękowy. Nie używa API przeglądarki. Mowę i dźwięk dostarcza wywołujący przez interfejsy `Speaker` i `EffectPlayer`. Implementacje dla przeglądarki są w `packages/web/src/audio/` (`recorded-speaker.ts`, `web-speech-speaker.ts`, `web-audio-effect-player.ts`, `use-announcer.ts`).

## API

- `createAnnouncer(speaker, effects?, random?)`: zwraca `Announcer` z metodami `handle(message)` dla każdej wiadomości WebSocket i `stop()`. `random` wybiera wariant nagrania i domyślnie jest `Math.random`.
- `Speaker`: `speak(announcement)` i `cancel()`. Speaker sam wybiera, czy gra nagranie, czy czyta `text`.
- `EffectPlayer`: `play(effect)` zwraca, ile ms głos ma czekać na koniec efektu, oraz `stop()`.
- `announcementFor(events, random)`: komunikat dla zdarzeń jednej rzutki albo `null`. Komunikat ma pola `kind` (`score`, `bust`, `winner` albo `game_shot`), `text` i `clip`. `random` zwraca liczbę z `[0, 1)` jak `Math.random` i jest wywoływane tylko przy wyborze wariantu.
- `clip`: ścieżka nagrania względem folderu języka, na przykład `scores/100.mp3` albo `events/bust_2.mp3`. `null` oznacza brak nagrania, wtedy zostaje odczyt `text`. Sumy 163, 166, 169, 172, 173, 175, 176, 178 i 179 nie mają nagrań, bo trzema rzutkami nie da się ich zdobyć.
- `EVENT_CLIPS`: ścieżki sześciu nagrań zdarzeń, do wczytania z wyprzedzeniem.
- `spokenNumber(value)`: liczba słownie po polsku, na przykład „sto”, „czterdzieści pięć”.
- `soundEffectFor(events)`: `bust`, `fanfare_short` (wygrany leg, miejsce poza pierwszym w zabawie), `fanfare_long` (wygrany mecz, pierwsze miejsce w zabawie) albo `null`.
- `effectTones(effect)` i `effectDurationMs(effect)`: tony efektu i jego długość.
- `pl`: teksty komunikatów („Bust”, „Zwycięzca”, „Game shot”).

## Działanie announcera

- Serwer wysyła na jedną rzutkę paczkę wiadomości z tym samym `eventSeq`. Announcer zbiera zdarzenia domenowe i reaguje raz, na `state_updated` z tym `eventSeq`.
- Paczka daje najwyżej jeden komunikat. Kolejność: zwycięzca (`match_won` albo pierwsze miejsce w zabawie, jedno z dwóch nagrań), bust (jedno z trzech nagrań), game shot, suma tury.
- Game shot zastępuje sumę tury przy każdym `leg_won`, który nie kończy meczu (leg 1v1, zamknięcie w Solo 501), i przy drugim lub dalszym miejscu w zabawie.
- Najpierw gra efekt, potem głos. Głos czeka tyle ms, ile zwróci `EffectPlayer.play`.
- Nowy komunikat przerywa poprzedni. `throw_undone` też przerywa trwający komunikat.
- Stan wysyłany po połączeniu nigdy nie jest czytany.

## Testy

```sh
pnpm --filter @autoscore/audio test
```
