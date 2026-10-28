# @autoscore/schema

Kontrakt projektu: schematy Zod i typy TypeScript wspólne dla wszystkich pakietów. Każdy schemat jest też typem o tej samej nazwie (`z.infer`). Inne pakiety nie definiują własnych kopii tych typów, tylko importują je stąd.

## API

`hit.ts`:

- `Hit`: `{ segment, multiplier }` ze sprawdzeniem kombinacji,
- `HitEvent`: zdarzenie trafienia wysyłane do API (`eventId`, `matchId`, `source`, `sequence`, `segment`, `multiplier`, `confidence`, `detectedAt`),
- `HitEvent.review` (opcjonalne): `HitReview` od detektora, czyli `reason` (`ReviewReason` bez `manual`), `candidates` (do 10 `ReviewCandidate` z `probability` 0..1, domyślnie `[]`), opcjonalne `frames` (`ReviewFrames`: ścieżki względne `before` i `after` bez `..`) i opcjonalny `tip` (`ReviewTip`: `{ x, y }` w pikselach obrazu),
- `ReviewReason`: `low_confidence`, `near_wire`, `detector_disagreement`, `occlusion`, `manual`,
- `Segment`, `Multiplier`, `HitSource`,
- `MISS_SEGMENT` (0), `BULL_SEGMENT` (25).

Kodowanie trafienia: miss to 0×0, Outer Bull to 25×1 (25 pkt), Bull to 25×2 (50 pkt, liczy się jako double), a 25×3 jest odrzucane.

`review.ts`:

- `ReviewActor` (`system`, `player`), `ThrowStatus` (`confirmed`, `pending`), `ThrowScoring` (`counted`, `waiting`, `void`),
- `ThrowReview`: ostatnie oznaczenie rzutki (`reason`, `flaggedBy`, `candidates`, opcjonalne `frames` i `tip`) i `resolved` (`ReviewResolution`: `{ segment, multiplier, by, at }` albo `null` przed weryfikacją),
- `ReviewedThrow`: rzutka z pierwotnym odczytem `reading`, wartością `value` (ostatnia weryfikacja albo `reading`), `status`, `scoring` i `review` (`null`, gdy rzutki nigdy nie oznaczono),
- `VerifyThrowRequest`: `Hit`.

`match.ts`: `MatchType` (`match`, `casual`, `practice`), `PracticeMode` (`free_run`, `solo_501`, `checkouts`), `CheckoutRange` (`2-50`, `51-100`), `CheckoutAttempt` (`{ target, success }`), `StartingScore` (301, 501, 701), `BestOf` (1, 3, 5), `Placement`, `MatchStatus` (`in_progress`, `abandoned`, `ended`, `finished`).

`player.ts`: `Player`, `CreatePlayerRequest`.

`match-api.ts`: `CreateMatchRequest`, `ThrowRecord`, `MatchSnapshot`, `MatchSnapshotPlayer`, `CheckoutSession`, `Abandonment`, `AbandonMatchRequest`, `MatchListQuery`, `MatchListItem`, `CheckoutAttemptRequest`, `ThrowResult`, `UndoResult`, `ReviewResult`, `ReviewQueue`, `ApiError`, `HealthResponse`.

- `CreateMatchRequest` dla treningu `checkouts` wymaga `checkoutRange`, a dla innych trybów go odrzuca.
- `CheckoutSession` to postęp treningu checkoutów: `range`, bieżący `target`, `attempts`, `successes`, `skips` (pominięte cele, które nadal się liczą) i `history` (zakończone próby w kolejności). Pominięcia nie wchodzą do `attempts`, `successes` ani `history`. Liczniki prób muszą zgadzać się z historią. Ziarna i zasady losowania nie ma w żadnej odpowiedzi.
- `MatchSnapshot`, `MatchListItem` i `MatchSummary` mają pole `checkouts` z `CheckoutSession`, `null` poza treningiem checkoutów.
- `UndoResult.undoneThrowId` jest `null`, gdy cofnięto próbę albo pominięcie checkoutu.
- `ThrowRecord` ma pierwotny odczyt i `review` tylko wtedy, gdy trafienie je miało.
- `MatchSnapshot.lastTurnThrows` to do 3 rzutek ostatniej tury jako `ReviewedThrow`, a `awaitingReview` mówi, czy któraś rzutka czeka (`scoring: 'waiting'`).
- `ReviewResult` (`{ throw, events, state }`) to odpowiedź na oznaczenie i weryfikację, a `ReviewQueue` (`{ matchId, eventSeq, throws }`) to rzutki do weryfikacji w kolejności z logu.

`domain-events.ts`: `DomainEvent`, unia zdarzeń `TurnCompleted`, `Bust`, `LegWon`, `MatchWon`, `PlayerFinished`, `CasualFinished`.

`stats.ts`: `StatsFilter`, `PlayerStatsQuery`, `PlayerStatLine`, `PlayerStats`, `MatchSummaryLeg`, `MatchSummaryPlayer`, `LegProgressPoint`, `LegProgressPlayer`, `LegProgress`, `MatchSummary`, `FREQUENT_HITS_LIMIT`, `FrequentHit`, `FrequentHitsResponse`.

`auth.ts`: `LoginRequest` (hasło bez przycinania spacji), `LoginResponse` (`token`, `expiresAt`), `LiveAuthMessage` (pierwsza wiadomość klienta na WebSocket, `{ type: 'auth', token }`).

`live.ts`: `LiveMessage`, unia wiadomości WebSocket. Obejmuje `StateUpdated`, `ThrowRegistered`, `ThrowUndone`, `ThrowFlagged` i `ThrowVerified` (oba z `throw: ReviewedThrow`), `Achievement` (rodzaj z `AchievementKind`, `value` i `previous`, które jest `null` tylko dla `first_*`) i zdarzenia domenowe, każde z polami `matchId` i `eventSeq`.

`camera.ts`:

- `ImagePoint`: `{ x, y }` w pikselach obrazu, początek w lewym górnym rogu, y w dół, wartości ułamkowe dozwolone,
- `CameraCalibration`: `imageWidth`, `imageHeight` (dodatnie liczby całkowite) i `points`, dokładnie cztery punkty wewnątrz obrazu. Punkty leżą na zewnętrznej krawędzi pierścienia double, na granicach 5|20, 13|6, 17|3 i 8|11, w tej kolejności.

## Testy

```sh
pnpm --filter @autoscore/schema test
```
