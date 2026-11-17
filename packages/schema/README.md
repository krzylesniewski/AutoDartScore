# @autoscore/schema

Kontrakt projektu: schematy Zod i typy TypeScript wspólne dla wszystkich pakietów. Każdy schemat jest też typem o tej samej nazwie (`z.infer`). Inne pakiety nie definiują własnych kopii tych typów, tylko importują je stąd.

## API

`hit.ts`:

- `Hit`: `{ segment, multiplier }` ze sprawdzeniem kombinacji,
- `HitEvent`: zdarzenie trafienia wysyłane do API (`eventId`, `matchId`, `source`, `sequence`, `segment`, `multiplier`, `confidence`, `detectedAt`),
- `Segment`, `Multiplier`, `HitSource`,
- `MISS_SEGMENT` (0), `BULL_SEGMENT` (25).

Kodowanie trafienia: miss to 0×0, Outer Bull to 25×1 (25 pkt), Bull to 25×2 (50 pkt, liczy się jako double), a 25×3 jest odrzucane.

`match.ts`: `MatchType` (`match`, `casual`, `practice`), `PracticeMode` (`free_run`, `solo_501`, `checkouts`), `CheckoutRange` (`2-50`, `51-100`), `CheckoutRule` (`new_each_attempt`, `repeat_on_miss`), `CheckoutTarget` (2-100), `CheckoutAttempt` (`{ target, success }`), `DARTS_PER_TURN` (3), `StartingScore` (301, 501, 701), `STARTING_SCORES` (te same wartości jako lista), `BestOf` (1, 3, 5), `LegsToWin` (1-9, do N wygranych legów), `Placement`, `MatchStatus` (`in_progress`, `abandoned`, `ended`, `finished`).

- `CheckoutRule` to zasada losowania celów w treningu checkoutów. Serwer ją zapisuje, ale nie wysyła w odpowiedziach API.
- `DARTS_PER_TURN` ogranicza `darts` w `TurnCompleted`, `Bust` i `LegTurn`, `throws` w `RestMissResult` oraz `MatchSnapshot.currentDarts` (do `DARTS_PER_TURN - 1`).

`player.ts`: `PlayerId` (niepusty napis, także w zdarzeniach domenowych, `Placement` i statystykach), `Player`, `CreatePlayerRequest`.

`match-api.ts`: `CreateMatchRequest`, `ThrowRecord`, `MatchSnapshot`, `MatchSnapshotPlayer`, `LegTurn`, `CheckoutSession`, `Abandonment`, `ExpectedSeq`, `CommandRequest`, `AbandonMatchRequest`, `MatchListQuery`, `MatchListItem`, `CheckoutAttemptRequest`, `ThrowResult`, `REST_MISS_SOURCE`, `RestMissRequest`, `RestMissResult`, `UndoResult`, `ApiError`, `STALE_STATE`, `StaleStateError`, `HealthResponse`.

- `ExpectedSeq` to ostatni `eventSeq`, który widział klient (liczba całkowita od 0). `CommandRequest` (`{ expectedSeq? }`) to body cofnięcia, wznowienia, końca treningu i pominięcia checkoutu, bez odrzucania nieznanych kluczy. `AbandonMatchRequest` i `CheckoutAttemptRequest` też mają opcjonalne `expectedSeq`.
- `RestMissRequest` (`{ eventId, expectedSeq? }`) to body `POST /matches/:id/rest-miss`. `RestMissResult` ma `throws` (do 3 rzutek ze `source` równym `REST_MISS_SOURCE`, czyli `rest-miss`, pusta lista przy ponownym wysłaniu), `events` i `state`.
- `StaleStateError` to body 409 `stale_state` (`STALE_STATE`) z bieżącym `state`. Parsuje się też jako `ApiError`.

- `CreateMatchRequest` dla treningu `checkouts` wymaga `checkoutRange`, a dla innych trybów go odrzuca.
- `CreateMatchRequest` dla meczu 1v1 przyjmuje `bestOf` albo `legsToWin`, nigdy oba naraz. Bez żadnego z nich serwer tworzy mecz best of 1. `MatchSnapshot.legsToWin` to `LegsToWin` albo `null` poza meczem 1v1.
- `CheckoutSession` to postęp treningu checkoutów: `range`, bieżący `target`, `attempts`, `successes`, `skips` (pominięte cele, które nadal się liczą) i `history` (zakończone próby w kolejności). Pominięcia nie wchodzą do `attempts`, `successes` ani `history`. Liczniki prób muszą zgadzać się z historią. Ziarna i zasady losowania nie ma w żadnej odpowiedzi.
- `LegTurn` to zamknięta tura bieżącego lega z `MatchSnapshot.legTurns`: `playerId`, `turnIndex`, `darts` (1-3 trafienia), `points`, `remainingAfter` (wynik po turze, `null` tylko w Free run) i `bust`. Bust ma `points: 0` i `remainingAfter` równe wynikowi sprzed tury.
- `MatchSnapshot`, `MatchListItem` i `MatchSummary` mają pole `checkouts` z `CheckoutSession`, `null` poza treningiem checkoutów.
- `MatchSnapshot` i `MatchListItem` mają wymagane pole `tournament` z `MatchTournament`, `null` poza meczem turniejowym. `MatchType` nie ma wartości `tournament`, bo mecz turniejowy to zwykły mecz 1v1.
- `UndoResult.undoneThrowId` jest `null`, gdy cofnięto próbę albo pominięcie checkoutu.

`domain-events.ts`: `DomainEvent`, unia zdarzeń `TurnCompleted`, `Bust`, `LegWon`, `MatchWon`, `PlayerFinished`, `CasualFinished`.

`stats.ts`: `StatsFilter`, `StatsPeriod` (`30d`, `90d`, `all`), `STATS_PERIOD_DAYS` (30, 90 i `null` dla `all`), `PlayerStatsQuery`, `OverallQuery`, `HeadToHeadQuery`, `PlayerStatLine`, `PlayerStats`, `MIN_GAMES_FOR_WIN_RATE` (3, tyle ukończonych gier 1v1 albo w zabawie potrzeba do rankingu wygranych), `MatchSummaryLeg`, `MatchSummaryPlayer`, `LegProgressPoint`, `LegProgressPlayer`, `LegProgress`, `MatchSummary`, `FREQUENT_HITS_LIMIT`, `FrequentHit`, `FrequentHitsResponse`.

Zapytania statystyk (`PlayerStatsQuery`, `RankingsQuery`, `PlayerFormQuery`, `OverallQuery`, `HeadToHeadQuery`) mają `period` z domyślnym `all`. Odpowiedzi `PlayerStats`, `StatsRankings`, `StatsOverall`, `HeadToHead` i `PlayerForm` mają wymagane pole `period`.

`MatchSummaryLeg.durationMs` to czas lega w milisekundach od pierwszej do zamykającej rzutki, bez przerw między porzuceniem a wznowieniem.

`auth.ts`: `LoginRequest` (hasło bez przycinania spacji), `LoginResponse` (`token`, `expiresAt`), `LiveAuthMessage` (pierwsza wiadomość klienta na WebSocket, `{ type: 'auth', token }`).

`live.ts`: `LiveMessage`, unia wiadomości WebSocket. Obejmuje `StateUpdated`, `ThrowRegistered`, `ThrowUndone`, `Achievement` (rodzaj z `AchievementKind`, `value` i `previous`, które jest `null` tylko dla `first_*`) i zdarzenia domenowe, każde z polami `matchId` i `eventSeq`.

`tournament.ts`: `TournamentId`, `FixtureId`, `TournamentFormat` (`league`, `cup`, `group_playoff`), `TournamentAdvance` (2, 4, 8), `TOURNAMENT_PLAYER_LIMITS`, `DEFAULT_TOURNAMENT_STARTING_SCORE` (501), `POINTS_PER_WIN` (2), `BracketRound` (`r16`, `qf`, `sf`, `final`), `TournamentLegsToWin`, `TournamentName`, `TournamentConfig`, `CreateTournamentRequest`, `FixtureLegs`, `TournamentEvent` (`TournamentDraw`, `FixtureStarted`, `PlayerWithdrawn`, `ResultCorrected`, `SharingChanged`, `TournamentArchived`), `MatchTournament`.

- `TournamentConfig` (i `CreateTournamentRequest`, ten sam schemat) to konfiguracja turnieju. `name` jest wymagane (1-60 znaków po przycięciu spacji). Domyślną nazwę z datą buduje klient. Domyślnie `startingScore` to 501, `thirdPlaceMatch` i `consolation` to `false`, a `sharing` to `true`.
- `TournamentLegsToWin` to długość meczów (`LegsToWin`) w każdej fazie: `group` 3, `r16` 3, `qf` 3, `sf` 3, `final` 4, `thirdPlace` 2, `consolation` 2. Brakujący klucz dostaje wartość domyślną. W lidze `group` to długość każdego meczu.
- `TOURNAMENT_PLAYER_LIMITS`: liga i grupa + play-off 3-10 graczy, puchar 3-16. `playerIds` muszą być różne.
- Zasady formatów: `advance` jest wymagane w `group_playoff` i nie może przekraczać liczby graczy. Liga i puchar odrzucają `advance` i `consolation: true`, a liga także `thirdPlaceMatch: true`. Jawne `false` przechodzi zawsze. Przełącznik, z którego drabinka nie zrobi meczu (np. mecz o 3. miejsce przy `advance: 2`), przechodzi, a silnik wtedy go pomija.
- `FixtureLegs` to wygrane legi obu stron (0-9) w kolejności slotów. Remis jest odrzucany.
- `TournamentEvent` to wpisy logu turnieju bez `seq` i `created_at`, które dodaje serwer. `draw` ma `order` (3-16 różnych graczy) i ostatnie losowanie w logu wyznacza bieżącą kolejność. Pozostałe wpisy: `fixture_started` (`fixtureId`, `matchId`), `player_withdrawn` (`playerId`), `result_corrected` (`fixtureId`, `legs`), `sharing_changed` (`sharing`), `archived`.
- `MatchTournament` (`id`, `name`, `fixtureId`, `label`) wiąże mecz z turniejem. `label` to tekst do wyświetlenia, np. „Półfinał 2”.

`tournament-api.ts`: `TournamentPlayer`, `TournamentPlacement`, `FixturePhase` (`group`, `playoff`, `third_place`, `consolation`), `FixtureStatus` (`waiting`, `ready`, `in_progress`, `finished`, `walkover`, `bye`), `FixtureSlot`, `FixtureResult`, `Fixture`, `StandingRow`, `TournamentStatus` (`in_progress`, `finished`), `TournamentView`, `TournamentListQuery`, `TournamentListItem`, `StartFixtureResult`, `TournamentApiErrorCode`, `TournamentStaleStateError`, `TournamentUpdated`, `TournamentLiveMessage`, `CorrectResultRequest`, `WithdrawPlayerRequest`, `SharingRequest`.

- `TournamentPlayer` to profil gracza z `MatchSnapshotPlayer` (`id`, `name`, `avatar`, `color`, `guest`). `TournamentPlacement` ma `place` 1-16, a gracze mogą dzielić miejsce.
- `FixtureSlot` to strona meczu: gracz (`seed`, `null` w grupie), zwycięzca albo przegrany innego meczu, miejsce w tabeli grupy albo wolny los (`bye`).
- `Fixture` to mecz turnieju. Mecze ligi mają fazę `group`, mecze drabinki pucharu `playoff`. `bracketRound` jest ustawione tylko w `playoff` i `consolation`. `averages` jest na razie zawsze `null`. Wynik (`FixtureResult`) jest tylko w statusie `finished` albo `walkover`. `winnerId` musi być graczem z jednego ze slotów. Zwycięzca ma dokładnie `legsToWin` legów, a przegrany mniej, więc walkower to `legsToWin`:0.
- `StandingRow` to wiersz tabeli grupy albo ligi. `played` to `won + lost`, `legDifference` to `legsFor - legsAgainst`, a `points` to `won * POINTS_PER_WIN`. `average` jest na razie zawsze `null`.
- `TournamentView` to stan turnieju odtworzony z konfiguracji, logu turnieju i wyników powiązanych meczów. `config` to konfiguracja z utworzenia z wartościami domyślnymi, więc `config.sharing` się nie zmienia. Bieżące udostępnianie po `sharing_changed` jest w `sharing`. `standings` jest puste w pucharze, a `placements` w trakcie turnieju zawiera tylko znane miejsca. `finishedAt` jest ustawione tylko w statusie `finished`. `archivedAt` to czas archiwizacji albo `null`.
- `TournamentListQuery` (`status?`, `archived?: 'include'`) to parametry listy turniejów, w stylu `ListPlayersQuery`. `TournamentListItem` to pozycja listy: `id`, `name`, `format`, `status`, `createdAt`, `finishedAt`, `archivedAt`, `players` i `placements` z `TournamentView`.
- `StartFixtureResult` (`matchId`, `tournament`) to odpowiedź na start meczu turnieju.
- `TournamentApiErrorCode` to kody błędów turnieju: `tournament_active`, `tournament_started`, `fixture_not_ready`, `tournament_not_finished`, `tournament_archived`, `archived_player`, `fixture_not_finished`, `invalid_result`, `dependent_started`, `already_withdrawn`, `tournament_finished` i `player_withdrawn`.
- `TournamentStaleStateError` to body 409 `stale_state` komendy turnieju z bieżącym `tournament` zamiast `state`. Parsuje się też jako `ApiError`.
- `TournamentLiveMessage` to unia wiadomości WebSocket jednego turnieju. Na razie ma tylko `TournamentUpdated` (`tournament_updated` z `tournamentId`, `eventSeq` i pełnym `tournament`). `LiveMessage` zostaje strumieniem jednej gry.
- `CorrectResultRequest` (`legs`), `WithdrawPlayerRequest` (`playerId`) i `SharingRequest` (`sharing`) mają opcjonalne `expectedSeq`. Schemat nie zna długości meczu, więc to, czy zwycięzca ma dokładnie N legów, sprawdza serwer. Ponowne losowanie, start meczu i archiwizacja używają `CommandRequest`.

## Testy

```sh
pnpm --filter @autoscore/schema test
```

Testy liczą pokrycie (v8) i nie przechodzą, gdy spadnie ono poniżej progów w `vitest.config.ts`.
