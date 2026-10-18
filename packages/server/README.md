# @autoscore/server

Serwer API: REST i WebSocket na Fastify. Jest jedynym źródłem prawdy o stanie gry. Zapisuje każdą rzutkę, każde cofnięcie, każde porzucenie i wznowienie gry oraz zakończenie treningu jako wpis w logu zdarzeń w SQLite. Stan gry nie jest zapisywany. Serwer odtwarza go z rzutek, które nadal się liczą, przez silnik z `@autoscore/engine`. Status porzucenia wynika z wpisów porzucenia i wznowienia, a status `ended` z wpisu zakończenia treningu. Komendy jednej gry wykonują się po kolei, a różne gry nie blokują się nawzajem.

Baza to SQLite przez wbudowany moduł `node:sqlite` i Kysely, bez natywnych bindingów. Migracje używają tylko typów text, integer i real i nie używają funkcji JSON, żeby dało się przejść na PostgreSQL.

## Uruchomienie

```sh
pnpm --filter @autoscore/server dev     # node --watch, restart po zmianie kodu
pnpm --filter @autoscore/server start
```

Oba skrypty uruchamiają `src/main.ts` przez `jiti`, bez kroku budowania. Przy starcie serwer wykonuje migracje. Zmienne `PORT`, `HOST` i `DATABASE_PATH`, trasy API i przykład z curl opisuje [README w katalogu głównym](../../README.md).

## Struktura

- `src/main.ts`: start procesu (konfiguracja, baza, migracje, nasłuch).
- `src/app.ts`: `buildApp`, czyli aplikacja Fastify z trasami i obsługą błędów.
- `src/config.ts`: `loadConfig`, czyli odczyt zmiennych środowiskowych.
- `src/errors.ts`: mapowanie błędów na `ApiError` i kody HTTP.
- `src/routes/`: `players.ts`, `matches.ts` (gry, lista gier, rzutki, cofnięcie, porzucenie, wznowienie i zakończenie treningu), `live.ts` (WebSocket), `stats.ts` (statystyki gracza, podsumowanie meczu i ranking graczy).
- `src/match-service.ts`: komendy gry (utworzenie, rzutka, cofnięcie, porzucenie, wznowienie, zakończenie treningu, lista, subskrypcja).
- `src/replay.ts`: wybór rzutek, które się liczą, stan porzucenia, czas zakończenia treningu i odtworzenie stanu w silniku.
- `src/snapshot.ts`: budowa `MatchSnapshot` ze stanu silnika.
- `src/stats-service.ts` i `src/stats/`: statystyki liczone z odtworzenia logu. W `src/stats/` są `tally.ts` (sumy gracza w grze), `completed-legs.ts` (punkty i rzutki w ukończonych legach) i `rankings.ts` (ranking graczy i rekordy).
- `src/live-hub.ts`: rozsyłanie wiadomości do subskrybentów jednej gry.
- `src/serial-queue.ts`: kolejka komend per gra.
- `src/store/store.ts`: warstwa dostępu do danych.
- `src/db/`: połączenie z bazą, adapter `node:sqlite`, migracje.

## Testy

```sh
pnpm --filter @autoscore/server test
```

Testy budują aplikację na bazie SQLite w pamięci (`:memory:`, zobacz `src/test-helpers.ts`). `src/restart.test.ts` używa pliku w katalogu tymczasowym, żeby sprawdzić stan po ponownym uruchomieniu.
