# @autoscore/schema

Kontrakt projektu: schematy Zod i typy TypeScript wspólne dla wszystkich pakietów. Każdy schemat jest też typem o tej samej nazwie (`z.infer`). Inne pakiety nie definiują własnych kopii tych typów, tylko importują je stąd.

## API

`hit.ts`:

- `Hit`: `{ segment, multiplier }` ze sprawdzeniem kombinacji,
- `HitEvent`: zdarzenie trafienia wysyłane do API (`eventId`, `matchId`, `source`, `sequence`, `segment`, `multiplier`, `confidence`, `detectedAt`),
- `Segment`, `Multiplier`, `HitSource`,
- `MISS_SEGMENT` (0), `BULL_SEGMENT` (25).

Kodowanie trafienia: miss to 0×0, Outer Bull to 25×1 (25 pkt), Bull to 25×2 (50 pkt, liczy się jako double), a 25×3 jest odrzucane.

`match.ts`: `MatchType` (`match`, `casual`, `practice`), `PracticeMode` (`free_run`, `solo_501`), `StartingScore` (301, 501, 701), `BestOf` (1, 3, 5), `Placement`, `MatchStatus` (`in_progress`, `abandoned`, `ended`, `finished`).

`player.ts`: `Player`, `CreatePlayerRequest`.

`match-api.ts`: `CreateMatchRequest`, `ThrowRecord`, `MatchSnapshot`, `MatchSnapshotPlayer`, `Abandonment`, `AbandonMatchRequest`, `MatchListQuery`, `MatchListItem`, `ThrowResult`, `UndoResult`, `ApiError`, `HealthResponse`.

`domain-events.ts`: `DomainEvent`, unia zdarzeń `TurnCompleted`, `Bust`, `LegWon`, `MatchWon`, `PlayerFinished`, `CasualFinished`.

`stats.ts`: `StatsFilter`, `PlayerStatsQuery`, `PlayerStatLine`, `PlayerStats`, `MatchSummaryLeg`, `MatchSummaryPlayer`, `LegProgressPoint`, `LegProgressPlayer`, `LegProgress`, `MatchSummary`, `FREQUENT_HITS_LIMIT`, `FrequentHit`, `FrequentHitsResponse`.

`auth.ts`: `LoginRequest` (hasło bez przycinania spacji), `LoginResponse` (`token`, `expiresAt`), `LiveAuthMessage` (pierwsza wiadomość klienta na WebSocket, `{ type: 'auth', token }`).

`live.ts`: `LiveMessage`, unia wiadomości WebSocket. Obejmuje `StateUpdated`, `ThrowRegistered`, `ThrowUndone` i zdarzenia domenowe, każde z polami `matchId` i `eventSeq`.

## Testy

```sh
pnpm --filter @autoscore/schema test
```
