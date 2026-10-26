# P48-P51: poprawki treningu „Końcówki”, osiągnięcia i komentarz do zera

Feedback z 2026-10-26 (`feedback-graczy.md`), decyzje autora z tego samego dnia. Wspólne zasady z `design/rwd.md` i kryteria stabilności klawiatury z P31 (`design/plan-p31-p32.md`) obowiązują dalej. Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts` (front) i `packages/audio/src/pl.ts` (audio), typy i DTO tylko z `packages/schema`, kolor nigdy sam nie niesie znaczenia.

Kolejność: P48, P49 i P50 są niezależne; P51 zależy od P50.

## Nagrania

Autor wygenerował nagrania w ElevenLabs. Leżą już w repo w `packages/web/public/audio/pl/events/` (tam, gdzie `bust_1.mp3`), ścieżki względem folderu języka:

| Plik | Do czego | Długość |
|---|---|---|
| `events/achievement_turn_record.mp3` | rekord tury z 3 lotek | 4,0 s |
| `events/achievement_checkout_record.mp3` | rekord checkoutu | 2,8 s |
| `events/achievement_shortest_leg.mp3` | najkrótszy leg | 4,0 s |
| `events/achievement_longest_leg.mp3` | najdłuższy leg (złośliwe) | 8,0 s |
| `events/first_100.mp3` | pierwsza tura 100+ | 1,6 s |
| `events/first_120.mp3` | pierwsza tura 120+ | 2,0 s |
| `events/first_140.mp3` | pierwsza tura 140+ | 2,3 s |
| `events/first_180.mp3` | pierwsze 180 | 4,0 s |
| `events/zero_1.mp3`, `events/zero_2.mp3` | komentarz do tury za 0 | 6,1 s, 4,9 s |

Nagrania zostają w obecnej długości (decyzja autora).

## P48: efekt wciśnięcia przycisków w treningu „Końcówki” (web)

**Feedback:** „Brakuje efektu kliknięcia w treningu końcówek”.

**Dziś:** „Udało się”, „Nie udało się” i „Cofnij” w `CheckoutActions` (`packages/web/src/components/CheckoutPracticePanel.tsx`) to zwykłe `<button>` bez stanu wciśnięcia i bez mignięcia. Klawiatura ekranu gry ma oba (`KeypadKey` z `flashOnPress`, P22).

**Zmiana:** te przyciski dostają ten sam efekt co klawisze klawiatury: widoczny stan wciśnięcia na dotyk i mysz oraz krótkie mignięcie po przyjęciu kliknięcia (także ze skrótu klawiszowego). Najlepiej przez wspólny kod z `KeypadKey`, a nie kopię. Wyłączony przycisk nie reaguje. Bez zmiany układu i rozmiarów.

**Testy:** mignięcie po kliknięciu i po skrócie, brak mignięcia na wyłączonym przycisku i w trakcie wysyłania (`busy`).

**Poza zakresem:** zachowanie po próbie (P49), inne ekrany.

## P49: ta sama końcówka po nieudanej próbie i przycisk „Nowa końcówka” (engine, schema, server, web)

**Feedback:** „Chcę kilka razy próbować jedną końcówkę. Czyli fail, niech nie losuje nowej. Nowa to 3 opcja poniżej”.

**Dziś:** każda próba, udana czy nie, losuje nową końcówkę: `applyCheckoutAttempt` w `packages/engine/src/checkouts.ts` zawsze woła `nextCheckoutTarget`. Log gry zna `checkout_attempt` i `checkout_attempt_undone` (`packages/server/src/db/database.ts`, `replay.ts`).

**Decyzje 2026-10-26:**
- po „Udało się” losuje się nowa końcówka, po „Nie udało się” zostaje ta sama;
- trzeci przycisk „Nowa końcówka” pod dwoma obecnymi losuje nową bez próby;
- „Nowa końcówka” nie liczy się do licznika prób ani procentu, ale jest zdarzeniem w logu (zasada 4);
- Cofnij cofa ostatnie zdarzenie: próbę albo „Nową końcówkę”.

**Zmiana:**
1. **Silnik:** cel zmienia się tylko po udanej próbie i po pominięciu. Numer losowania (`n` w `nextCheckoutTarget`) liczy zmiany celu, nie próby, więc odtworzenie daje te same końcówki. Nowa funkcja na pominięcie, `replayCheckouts` przyjmuje próby i pominięcia w kolejności z logu.
2. **Stare sesje bez zmian:** sesje zapisane przed tą zmianą muszą się odtwarzać jak dziś (każda próba losowała nową końcówkę), żeby ich historia prób i podsumowania się nie zmieniły. Np. reguła zapisana w danych gry (migracja dopisuje kolumnę z wartością starej reguły dla istniejących gier, nowe gry dostają nową) i silnik wybiera regułę z konfiguracji. Test na bazie z sesją zapisaną starą regułą.
3. **Log i API:** nowy wpis `checkout_skipped` przez `POST /matches/:id/checkout-skips` (bez treści), dozwolony tylko w aktywnym treningu „Końcówki” (inaczej 409 lub 400 jak próba). Cofnij (`POST /matches/:id/undo`) cofa ostatni wpis, próbę albo pominięcie. Stan idzie przez WebSocket jak po próbie. Snapshot bez zmian w kształcie poza tym, czego wymaga nowa reguła; liczniki prób i udanych bez pominięć.
4. **Front:** pod „Udało się” i „Nie udało się” trzeci przycisk „Nowa końcówka” (ikona i tekst), w tym samym stylu co „Cofnij”, ze skrótem klawiszowym N (podpowiedź w `title` i plakietka jak przy innych skrótach), z efektem wciśnięcia jak pozostałe przyciski, jeśli P48 jest już scalony. Lista ostatnich prób i podsumowanie nie pokazują pominięć. Układ mieści się bez przewijania na 375×812 i 768×1024.

**Testy:** silnik (porażka zostawia cel, sukces i pominięcie zmieniają, determinizm odtworzenia, stara reguła), serwer (pominięcie, Cofnij pominięcia i próby, pominięcie poza treningiem „Końcówki” odrzucone, odtworzenie po restarcie, migracja), front (trzeci przycisk, skrót N, licznik bez pominięć). Zrzuty ekranu przy 375×812, 768×1024 i 1920×1080 w opisie PR-a.

**Poza zakresem:** efekt wciśnięcia (P48), statystyki końcówek, limit powtórek jednej końcówki.

## P50: wykrywanie osiągnięć na serwerze i wiadomość na żywo (schema, server)

**Feedback:** „Przydałyby się osiągnięcia. Czyli podczas gry jak gracz rzuci swoją życiową wartość z 3 rzutów”.

**Dziś:** najwyższa tura, najwyższy checkout i najlepszy leg są liczone tylko w statystykach po fakcie (`packages/server/src/stats/tally.ts`, `rankings.ts`, `completed-legs.ts`). W trakcie gry nic nie porównuje wyniku z rekordem gracza.

**Decyzje 2026-10-26:**
- osiągnięcia tylko w meczach 1v1 (`match.type: 'match'`), rekordy i punkty odniesienia też tylko z meczów 1v1, jak ranking „Najwyższa tura”;
- tylko profile, goście bez osiągnięć;
- od drugiej gry profilu: osiągnięcia działają, gdy gracz ma co najmniej jeden zakończony mecz 1v1 przed bieżącym; pierwsza gra tylko ustala punkt odniesienia;
- w tej paczce osiem osiągnięć z nagraniami (niżej); rekord średniej w legu i Bull na zamknięcie odłożone.

**Osiągnięcia** (rekord = ściśle lepszy od dotychczasowego; punkt odniesienia = zakończone wcześniej mecze 1v1 gracza, liczone z tabeli rzutek jak statystyki, plus wcześniejsze tury i legi bieżącego meczu):
1. `turn_record`: suma tury wyższa niż każda wcześniejsza tura gracza. Sprawdzane przy `turn_completed` (bust to nie tura z wynikiem).
2. `checkout_record`: zamknięcie lega wyższe niż każdy wcześniejszy checkout gracza. Przy `leg_won`.
3. `shortest_leg`: wygrany leg w mniejszej liczbie lotek niż każdy wcześniej wygrany leg gracza. Przy `leg_won`, dla zwycięzcy.
4. `longest_leg`: liczba lotek gracza w legu większa niż w każdym jego wcześniejszym legu, wygranym lub przegranym (decyzja autora). Przy końcu lega, dla każdego gracza tego lega.
5. `first_100`, `first_120`, `first_140`, `first_180`: pierwsza w historii gracza tura z sumą co najmniej 100, 120, 140 albo równa 180. Gdy jedna tura przekracza kilka progów po raz pierwszy, tylko najwyższy z nich.

**Zmiana:**
1. **Schema:** nowa wiadomość na żywo `achievement` (np. `matchId`, `eventSeq`, `playerId`, `kind` z listy wyżej, `value`, `previous` albo `null` dla pierwszych razy) w `LiveMessage` (`packages/schema/src/live.ts`), z testami Zod.
2. **Serwer:** po rzutce, która daje `turn_completed` lub koniec lega, serwer wylicza osiągnięcia i wysyła je w tej samej paczce co zdarzenia domenowe, przed `state_updated` (ten sam `eventSeq`), żeby announcer złożył jeden komunikat. Osiągnięcia wynikają z rzutek i nie są osobno zapisywane ani utrzymywane jako liczniki (zapis zdarzeniowy, statystyki z tabeli rzutek). Silnik zostaje bez zmian, bo nie zna historii gracza. Snapshot po połączeniu nie zawiera osiągnięć. Cofnięcie rzutki nie wymaga osobnej obsługi; ponowna rzutka może dać osiągnięcie jeszcze raz.
3. **Wydajność:** punkt odniesienia liczony raz na mecz albo z cache unieważnianego przy zakończeniu meczu, a nie pełnym przeliczeniem statystyk przy każdej rzutce.

**Testy:** każde osiągnięcie (pobity i niepobity rekord, remis = brak osiągnięcia), tylko 1v1 (zabawa, Solo 501 i trening bez osiągnięć), gość bez osiągnięć, pierwsza gra profilu bez osiągnięć, druga z osiągnięciami, rekord pobity drugi raz w tym samym meczu, najwyższy próg pierwszych razy, najdłuższy leg u przegranego, kolejność wiadomości w paczce, mecz porzucony nie liczy się jako zakończony.

**Poza zakresem:** front i dźwięk (P51), rekord średniej, Bull na zamknięcie, lista osiągnięć na karcie gracza, osiągnięcia w zabawie i treningu.

## P51: osiągnięcia i komentarz do zera na ekranie gry i w głosie (audio, web)

**Feedback:** osiągnięcia (wyżej) i „A jakieś 2-3 śmieszne komentarze do wyniku zero?”.

**Dziś:** announcer (`packages/audio/src/announcer.ts`, `announcement.ts`) daje najwyżej jeden komunikat na rzutkę: efekt, potem jedno nagranie (zwycięzca, bust, game shot albo suma tury). Speaker (`packages/web/src/audio/recorded-speaker.ts`) gra jedno nagranie.

**Decyzje 2026-10-26:**
- najpierw odczyt wartości (suma tury, game shot, zwycięzca), potem komentarz do zera, potem osiągnięcia, wszystko po kolei;
- komentarz do zera przy każdej turze za 0 punktów (nie przy buście), losowo `zero_1` albo `zero_2`, we wszystkich typach gier, w których czytana jest suma tury;
- wszystkie nagrania osiągnięć z tej samej tury grają po kolei.

**Zmiana:**
1. **Audio:** komunikat może mieć kilka nagrań w kolejności (np. `scores/0.mp3`, `events/zero_2.mp3`), każde z tekstem zastępczym na wypadek braku pliku. Kolejność: efekt dźwiękowy, główny komunikat jak dziś, komentarz do zera, osiągnięcia w kolejności: pierwsze razy, rekord tury, rekord checkoutu, najkrótszy leg, najdłuższy leg. Osiągnięcia przychodzą jako wiadomość `achievement` w paczce (P50). Polskie teksty zastępcze w `pl.ts` (np. „Nowy rekord tury”, „Najdłuższy leg w historii”). Nowe nagrania w `EVENT_CLIPS`, żeby się wczytały z wyprzedzeniem.
2. **Przerywanie bez zmian:** nowy komunikat i `throw_undone` przerywają całą sekwencję, tak jak dziś. Rzutki bez komunikatu (1. i 2. lotka następnego gracza) jej nie przerywają.
3. **Speaker:** gra listę nagrań po kolei; brak pliku w środku listy czyta tekst tego elementu i przechodzi dalej; `cancel` zatrzymuje całą listę.
4. **Ekran gry:** przy osiągnięciu krótki komunikat na ekranie gry (np. pasek nad slotami rzutek na kilka sekund): ikona, imię gracza i tekst z wartością, np. „Rekord tury: 140 (było 121)”, „Najdłuższy leg: 42 lotki”, „Pierwsze 180!”. Kilka osiągnięć naraz pokazuje się razem albo po kolei. Komunikat nie zasłania klawiatury ani przycisków i nie przesuwa układu (kryteria P31). Działa też przy wyłączonym głosie. Kolor nie niesie znaczenia sam.

**Testy:** audio (suma i komentarz do zera, bust za 0 bez komentarza, suma i osiągnięcie, game shot z rekordem checkoutu i najkrótszym legiem, kolejność, przerwanie sekwencji, brak pliku w środku), speaker (lista nagrań, fallback, cancel), front (komunikat osiągnięcia z wiadomości `achievement`, kilka naraz, brak przy wyłączonym głosie bez wpływu na ekran). Zrzuty ekranu przy 375×812, 768×1024 i 1920×1080 w opisie PR-a.

**Poza zakresem:** wykrywanie osiągnięć (P50), komentarze do innych wyników niż 0, nowe nagrania, ustawienie wyłączające same komentarze.
