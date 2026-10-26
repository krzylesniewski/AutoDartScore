# @autoscore/schema

Kontrakt projektu: schematy Zod i typy TypeScript wspólne dla wszystkich pakietów. Każdy schemat jest też typem o tej samej nazwie (`z.infer`). Inne pakiety nie definiują własnych kopii tych typów, tylko importują je stąd.

## API

`hit.ts`:

- `Hit`: `{ segment, multiplier }` ze sprawdzeniem kombinacji,
- `HitEvent`: zdarzenie trafienia wysyłane do API (`eventId`, `matchId`, `source`, `sequence`, `segment`, `multiplier`, `confidence`, `detectedAt`),
- `Segment`, `Multiplier`, `HitSource`,
- `MISS_SEGMENT` (0), `BULL_SEGMENT` (25).

Kodowanie trafienia: miss to 0×0, Outer Bull to 25×1 (25 pkt), Bull to 25×2 (50 pkt, liczy się jako double), a 25×3 jest odrzucane.

`match.ts`: `MatchType` (`match`, `casual`, `practice`), `PracticeMode` (`free_run`, `solo_501`, `checkouts`), `CheckoutRange` (`2-50`, `51-100`), `CheckoutAttempt` (`{ target, success }`), `StartingScore` (301, 501, 701), `BestOf` (1, 3, 5), `Placement`, `MatchStatus` (`in_progress`, `abandoned`, `ended`, `finished`).

`player.ts`: `Player`, `CreatePlayerRequest`.

`match-api.ts`: `CreateMatchRequest`, `ThrowRecord`, `MatchSnapshot`, `MatchSnapshotPlayer`, `CheckoutSession`, `Abandonment`, `AbandonMatchRequest`, `MatchListQuery`, `MatchListItem`, `CheckoutAttemptRequest`, `ThrowResult`, `UndoResult`, `ApiError`, `HealthResponse`.

- `CreateMatchRequest` dla treningu `checkouts` wymaga `checkoutRange`, a dla innych trybów go odrzuca.
- `CheckoutSession` to postęp treningu checkoutów: `range`, bieżący `target`, `attempts`, `successes`, `skips` (pominięte cele, które nadal się liczą) i `history` (zakończone próby w kolejności). Pominięcia nie wchodzą do `attempts`, `successes` ani `history`. Liczniki prób muszą zgadzać się z historią. Ziarna i zasady losowania nie ma w żadnej odpowiedzi.
- `MatchSnapshot`, `MatchListItem` i `MatchSummary` mają pole `checkouts` z `CheckoutSession`, `null` poza treningiem checkoutów.
- `UndoResult.undoneThrowId` jest `null`, gdy cofnięto próbę albo pominięcie checkoutu.

`domain-events.ts`: `DomainEvent`, unia zdarzeń `TurnCompleted`, `Bust`, `LegWon`, `MatchWon`, `PlayerFinished`, `CasualFinished`.

`stats.ts`: `StatsFilter`, `PlayerStatsQuery`, `PlayerStatLine`, `PlayerStats`, `MatchSummaryLeg`, `MatchSummaryPlayer`, `LegProgressPoint`, `LegProgressPlayer`, `LegProgress`, `MatchSummary`, `FREQUENT_HITS_LIMIT`, `FrequentHit`, `FrequentHitsResponse`.

`auth.ts`: `LoginRequest` (hasło bez przycinania spacji), `LoginResponse` (`token`, `expiresAt`), `LiveAuthMessage` (pierwsza wiadomość klienta na WebSocket, `{ type: 'auth', token }`).

`live.ts`: `LiveMessage`, unia wiadomości WebSocket. Obejmuje `StateUpdated`, `ThrowRegistered`, `ThrowUndone`, `Achievement` (rodzaj z `AchievementKind`, `value` i `previous`, które jest `null` tylko dla `first_*`) i zdarzenia domenowe, każde z polami `matchId` i `eventSeq`.

## Testy

```sh
pnpm --filter @autoscore/schema test
```
