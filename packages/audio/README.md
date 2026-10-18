# @autoscore/audio

Zamienia wiadomości na żywo i zdarzenia domenowe na polski komunikat głosowy i efekt dźwiękowy. Nie używa API przeglądarki. Mowę i dźwięk dostarcza wywołujący przez interfejsy `Speaker` i `EffectPlayer`. Implementacje dla przeglądarki są w `packages/web/src/audio/` (`web-speech-speaker.ts`, `web-audio-effect-player.ts`, `use-announcer.ts`).

## API

- `createAnnouncer(speaker, effects?)`: zwraca `Announcer` z metodami `handle(message)` dla każdej wiadomości WebSocket i `stop()`.
- `Speaker`: `speak(text)` i `cancel()`.
- `EffectPlayer`: `play(effect)` zwraca, ile ms głos ma czekać na koniec efektu, oraz `stop()`.
- `announcementFor(events)`: komunikat dla zdarzeń jednej rzutki (`score`, `bust` albo `winner`) albo `null`.
- `spokenNumber(value)`: liczba słownie po polsku, na przykład „sto”, „czterdzieści pięć”.
- `soundEffectFor(events)`: `bust`, `fanfare_short` (wygrany leg, miejsce poza pierwszym w zabawie), `fanfare_long` (wygrany mecz, pierwsze miejsce w zabawie) albo `null`.
- `effectTones(effect)` i `effectDurationMs(effect)`: tony efektu i jego długość.
- `pl`: teksty komunikatów („Bust”, „Zwycięzca”).

## Działanie announcera

- Serwer wysyła na jedną rzutkę paczkę wiadomości z tym samym `eventSeq`. Announcer zbiera zdarzenia domenowe i reaguje raz, na `state_updated` z tym `eventSeq`.
- Najpierw gra efekt, potem głos. Głos czeka tyle ms, ile zwróci `EffectPlayer.play`.
- Nowy komunikat przerywa poprzedni. `throw_undone` też przerywa trwający komunikat.
- Stan wysyłany po połączeniu nigdy nie jest czytany.

## Testy

```sh
pnpm --filter @autoscore/audio test
```
