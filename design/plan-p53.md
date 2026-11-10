# P53: zakładka „Overall” na ekranie Statystyki

Pomysł graczy z 2026-10-28 (`feedback-graczy.md`), decyzje autora z tego samego dnia. Wspólne zasady z `design/rwd.md` obowiązują dalej. Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts`, typy i DTO tylko z `packages/schema`, kolor nigdy sam nie niesie znaczenia. Statystyki liczone z tabeli rzutek, nie z osobno utrzymywanych liczników.

## P53: liczba lotek, średnia ogólna i gracze powyżej i poniżej średniej (schema, server, web)

**Pomysł:** „Nowa zakładka overall. I tam liczba lotek całkowita, średnia z 3 całkowita. I może statystyki kto jest powyżej, a kto poniżej”.

**Dziś:** ekran rankingu (`#/stats`, `StatsScreen` w `packages/web/src/screens/StatsScreen.tsx`) ma przełącznik typu gier `FilterButtons` (Wszystkie / Mecze 1v1 / Zabawa / Trening, `StatsFilter` w `packages/schema/src/stats.ts`) i pod nim `RankingBoard` z danymi z `GET` rankingu (`StatsRankings`, liczone w `buildRankings` w `packages/server/src/stats/rankings.ts`, wołane z `stats-service.ts`). Ranking ma łączną liczbę gier i legów oraz średnią na 3 rzutki każdego gracza z ukończonych legów (pozycja dopiero od `MIN_LEGS_FOR_AVERAGE` legów). Nie ma łącznej liczby lotek, średniej ogólnej ani porównania z nią.

**Decyzje 2026-10-28:**
- „Overall” to piąta pozycja przełącznika na ekranie rankingu, na prawo od „Trening”: Wszystkie / Mecze 1v1 / Zabawa / Trening / Overall. Na karcie gracza (`#/stats/<id>`) przełącznik zostaje bez zmian;
- Overall liczy wszystkie gry wliczane do statystyk razem (te same gry co „Wszystkie”: `countsToStats`, bez Free run);
- średnia ogólna to **średnia ze średnich graczy** (każdy gracz waży tyle samo), a średnia gracza liczona jak w rankingu (z ukończonych legów);
- do porównania powyżej i poniżej wchodzą **wszyscy gracze** z co najmniej jednym ukończonym legiem, także poniżej progu `MIN_LEGS_FOR_AVERAGE`; gracz bez ukończonego lega nie ma średniej i nie wchodzi ani do średniej ogólnej, ani do porównania (ale jego lotki liczą się do sum);
- z dodatkowych statystyk na razie tylko **liczba lotek każdego gracza**.

**Zmiana:**
1. **Schema:** nowy typ `StatsOverall`: `games`, `legs` (jak w rankingu), `darts` (wszystkie rzucone lotki w tych grach, także w nieukończonych legach i z tur z bustem, bez rzutek `pending` i cofniętych), `average` (średnia ogólna, `null`, gdy nikt nie ma ukończonego lega) i `players`: dla każdego gracza z co najmniej jedną lotką `playerId`, `name`, `avatar`, `color`, `darts`, `legs` (ukończone), `average` (`null` bez ukończonego lega) i `difference` (średnia gracza minus średnia ogólna, `null` bez średniej). Testy schematu.
2. **Serwer:** nowy endpoint `GET /stats/overall` (wzór i sposób autoryzacji jak w endpoincie rankingu) liczony przez odtworzenie zdarzeń z tych samych danych co ranking. Goście bez zapisu statystyk i profile zarchiwizowane traktowane tak samo jak w rankingu. Lista graczy posortowana po `difference` malejąco, gracze bez średniej na końcu po liczbie lotek.
3. **Front:**
   - przycisk „Overall” w przełączniku na ekranie rankingu; po jego wybraniu zamiast `RankingBoard` widok `OverallBoard` z danymi z `GET /stats/overall`; adres i zachowanie pozostałych filtrów bez zmian;
   - kafelki na górze: łączna liczba lotek, średnia ogólna na 3 rzutki (z jednym miejscem po przecinku, jak w rankingu), liczba gier i legów;
   - lista graczy w dwóch grupach z nagłówkami „Powyżej średniej” i „Poniżej średniej” (gracz równy średniej w „Powyżej”), a gracze bez ukończonego lega osobno na końcu („Bez ukończonego lega”); wiersz: awatar, imię, średnia, różnica ze znakiem (np. „+4,2”, „−3,1”), liczba lotek;
   - grupa niesie znaczenie nagłówkiem, ikoną strzałki i znakiem różnicy, nie tylko kolorem;
   - stany ładowania, błędu i braku gier jak w rankingu.
4. **RWD:** przy 375×812 kafelki jeden pod drugim lub po dwa, lista bez poziomego przewijania strony; przełącznik z pięcioma pozycjami mieści się albo przewija poziomo w swoim pasku (tak jak dziś na wąskim ekranie), bez łamania układu.

**Testy:**
- serwer: suma lotek z kilku typów gier (bez Free run), lotki z nieukończonego lega i z bustu wliczone; średnia ogólna jako średnia ze średnich (dwóch graczy o różnej liczbie lotek daje inną wartość niż średnia wszystkich lotek razem); gracz poniżej progu legów w porównaniu; gracz bez ukończonego lega bez średniej i z lotkami w sumie; brak gier;
- front: przycisk „Overall” za „Trening”, widok z kafelkami i grupami, różnica ze znakiem, gracz bez ukończonego lega na końcu, powrót do rankingu po wybraniu innego filtra;
- zrzuty ekranu widoku Overall przy 375×812, 768×1024 i 1920×1080 w opisie PR-a (jeśli wgranie obrazków nie działa, PR to opisuje).

**Poza zakresem:** pozostałe propozycje z wpisu (łączne 180/140+/100+/60+, % doubli, najczęstsze trafienie wszystkich, rekordy wszech czasów, „najbardziej zapracowany”, wykres średniej w czasie), Overall na karcie gracza, filtrowanie Overall po typie gier, zmiany w rankingu.
