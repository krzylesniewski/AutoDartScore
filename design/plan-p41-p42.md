# P41-P42: porzucenie gry od startu, top 5 w rankingu statystyk

Feedback graczy z 2026-10-22 (`feedback-graczy.md`), decyzje autora z tego samego dnia. Wspólne zasady z `design/rwd.md` i kryteria stabilności klawiatury z P31 (`design/plan-p31-p32.md`) obowiązują dalej. Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts`, typy i DTO tylko z `packages/schema`, kolor nigdy sam nie niesie znaczenia.

Kolejność: P41 i P42 są niezależne i mogą iść równolegle.

## P41: porzucenie gry od startu, także z ekranu Historia (web)

**Feedback:** „zniknęła opcja porzucenia partii, albo nie możemy jej znaleźć”.

**Przyczyna:** `canAbandon` (`packages/web/src/game/can-abandon.ts`) pozwala porzucić grę dopiero po ukończonym legu: w meczu 1v1 przy `legIndex >= 1`, w zabawie gdy ktoś zajął miejsce, w treningu nigdy. Od P32 mecz ma domyślnie best of 1, więc jedyny leg kończy mecz i przycisk „Porzuć mecz” w praktyce się nie pokazuje. Serwer porzucenia nie ogranicza (`abandon` w `match-service.ts` odrzuca tylko grę zakończoną, zakończony trening i grę już porzuconą).

**Decyzje 2026-10-22:**
- porzucić można każdą grę w toku od startu, także przed pierwszą rzutką;
- Free run zostaje tylko z „Zakończ trening” (bez „Porzuć”); Solo 501 dostaje porzucenie jak mecz i zabawa, obok „Zakończ trening”, który ma już dziś;
- porzucona gra bez ukończonego lega nie liczy się do statystyk (rzuty zostają w logu);
- na telefonie przycisk zostaje w menu gry (☰ w `MatchHeader.tsx`), a porzucić grę można też z ekranu Historia.

**Zmiana:**
1. **Reguła:** `canAbandon` zwraca `true` dla każdej gry ze `status: 'in_progress'` typu `match` i `casual` oraz dla `practice` z `practiceMode: 'solo_501'`; dla Free run `false`. Komentarz w pliku opisuje nową regułę. Reguła działa w trzech miejscach: nagłówek gry (`MatchHeader`), lista niedokończonych gier na ekranie startowym (`UnfinishedGames`) i ekran Historia.
2. **Ekran Historia:** wiersz gry w toku (`in_progress`) w `MatchHistoryList` na `HistoryScreen` dostaje przycisk porzucenia, gdy `canAbandon` na to pozwala, z tym samym oknem `AbandonDialog` (wybór gracza i powód) co ekran startowy i ekran gry. Przycisk ma tekst lub ikonę z `aria-label` jak na ekranie startowym, co najmniej 44×44 px na telefonie. Po porzuceniu lista się odświeża, a wiersz pokazuje status „porzucona”. Błąd z serwera (np. 409, gdy gra skończyła się w międzyczasie) pokazuje komunikat jak na ekranie startowym i nie zamyka listy. Wiersz gry w toku dalej prowadzi do gry, a klik w przycisk porzucenia nie otwiera gry.
3. **Statystyki:** bez zmian w kodzie. Średnie, rankingi, legi i mecze już dziś biorą tylko ukończone legi i zakończone gry (`packages/server/src/stats/completed-legs.ts`), więc porzucona gra bez ukończonego lega nie zmienia średniej, wygranych ani liczby meczów. Rzutki i punkty z przerwanego lega liczą się do sumy rzutek i punktów jak dotąd (ta sama reguła co dla przerwanego lega porzuconego meczu). Test serwera to potwierdza.
4. **Stabilność:** pojawienie się przycisku „Porzuć mecz” od startu gry nie zmienia położenia ani rozmiaru klawiatury (pomiary z P31, ±1 px), na każdej szerokości.

**Testy:** front (`canAbandon` dla meczu 1v1 przed pierwszą rzutką i w pierwszym legu, zabawy bez miejsc, Solo 501, Free run, gry zakończonej i porzuconej; przycisk w nagłówku gry od startu meczu i w menu ☰ poniżej `lg`; ikona porzucenia na liście niedokończonych gier od startu; przycisk na ekranie Historia tylko przy grze w toku, okno `AbandonDialog`, odświeżenie listy, komunikat błędu; Free run bez „Porzuć”); serwer (porzucenie gry bez żadnej rzutki i w trakcie pierwszego lega; statystyki gracza nie zmieniają się po porzuceniu gry bez ukończonego lega).

**Poza zakresem:** zmiana tekstu „Porzuć mecz” dla zabawy i treningu, porzucenie lub zakończenie pustego Free run (dziś „Zakończ trening” pojawia się po pierwszej rzutce), usuwanie porzuconych gier, wznowienie gry z ekranu Historia, zmiany w serwerze poza testami.

## P42: top 5 w kafelkach rankingu statystyk (server, web)

**Feedback:** „zobacz jeszcze, czy to celowo w statystykach pokazujemy top 3? Bo jeśli tak, zwiększyłbym to do top 5 albo nawet 10. Jak się nie zmieści, to dodałbym scrolla”.

**Decyzja 2026-10-22:** top 5. Ta sekcja zastępuje „Ranking top 3” z `design/stats-highest-turn.md`.

**Zmiana:**
1. **Serwer:** `TOP = 5` w `packages/server/src/stats/rankings.ts` dla czterech kafelków: najlepsza średnia lega, najwyższe zakończenie, najkrótszy leg, najwyższa tura. Remisy dalej dzielą miejsce, więc wpisów może być więcej niż 5 (wszyscy z miejscem ≤ 5).
2. **Front:** `RankingBoard` pokazuje wszystkie wpisy z odpowiedzi. Przewijanie w kafelku zostaje jak dziś (tylko od `xl`); poniżej `xl` kafelek rośnie do 5 wierszy. Wyróżnienie lidera (pierwsze miejsce) zostaje bez zmian, bez osobnego wyróżnienia podium. Komunikat „za mało graczy” dalej przy mniej niż 3 wpisach.
3. **Stabilność:** na monitorze (`xl`) ekran statystyk mieści się w oknie jak dziś, a 5 i więcej wpisów przewija się w kafelku; na telefonie i tablecie kafelki nie wychodzą poza szerokość ekranu.

**Testy:** serwer (5 wpisów przy 6 i więcej graczach, remis na 5. miejscu daje więcej niż 5 wpisów, mniej graczy niż 5); front (kafelek z 5 wpisami, komunikat przy 2 wpisach i brak komunikatu przy 3-4).

**Poza zakresem:** top 10, przełącznik liczby miejsc, wyróżnienie podium, zmiany w liście średnich po lewej, zmiana `design/stats-highest-turn.md` (plan w tym pliku jest wiążący dla P42).
