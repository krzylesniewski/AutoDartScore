# RWD: ekrany na telefon, tablet i monitor

Zastępuje `plan-wdrozenia-p15-p17.md`. Niezależne zadania: P15, P16 i P17 (zrobione), potem P19 (statystyki) i P20 (uzupełnienie widoku końca meczu). Każde dotyczy jednego ekranu i ma własne pliki, więc mogą iść równolegle, w dowolnej kolejności.

- Makiety: `design/mockups/RWD/` (wersja tablet 1180×820). **To wskazówka układu, a nie lista funkcji.** Element makiety, którego aplikacja dziś nie ma, nie jest wdrażany. Jedyny wyjątek to przyciski „Rewanż” i „Nowy mecz” w P17.
- Kolory, fonty i promienie tylko z tokenów `design/theme.css`, bez kolorów wpisanych na sztywno. Liczby i imiona na makietach są przykładowe.
- Bez shadcn/ui i bez nowych zależności. Container queries są wbudowane w Tailwind v4 (`@container`, `@sm:`, `@md:` i podobne).
- Bez zmian w `packages/schema`, `packages/server`, `packages/engine` i `packages/audio`. Logika gry zostaje w silniku i API, a komponenty tylko pokazują stan.

## Wspólne zasady (każde zadanie stosuje je u siebie)

### Klasy szerokości
Domyślne breakpointy Tailwinda, bez własnych:

| Klasa | Szerokość | Układ |
|---|---|---|
| telefon | < 640 px (bez prefiksu) | jedna kolumna, przyklejone przyciski akcji na dole |
| pośredni | 640-1023 px (`sm:`) | jedna kolumna jak na telefonie, większe odstępy (brak makiet, m.in. tablet w pionie) |
| tablet | 1024-1279 px (`lg:`) | układ z makiet `design/mockups/RWD/` (wzorzec 1180×820) |
| monitor | ≥ 1280 px (`xl:`) | układ jak dziś (makiety motywu A 1440×810), bez pogorszenia |

Każde zadanie sprawdza swój ekran na czterech szerokościach: 390×844, 768×1024, 1180×820, 1440×810.

### Zasady
1. Komponent używany w kolumnach o różnej szerokości (wiersz paska wyników, tabela statystyk) dobiera układ przez container queries, a nie przez szerokość ekranu.
2. Brak poziomego przewijania strony na każdej z czterech szerokości. Szerokie elementy (tabela) przewijają się w swoim kontenerze albo zmieniają układ.
3. Cele dotykowe ≥ 44 px wszędzie, ≥ 56 px na klawiaturze wpisu na tablecie.
4. Duże liczby (wynik, suma tury, wynik meczu) skalowane przez `clamp()` w klasach komponentu. Istniejących tokenów rozmiarów w `design/theme.css` nie zmieniamy.
5. Każda istniejąca funkcja ekranu zostaje dostępna na każdej szerokości. Można ją przenieść (np. do dolnego paska), ale nie usunąć.
6. Kolor nie niesie znaczenia sam (ikona i tekst jak dziś), teksty po polsku w `i18n/pl.ts`.
7. Istniejące testy przechodzą. Jeśli zmieniają się role albo etykiety, testy dostosowujemy bez zmiany ich znaczenia. Nowe testy w Vitest + Testing Library (jsdom): obecność elementów, klasy układu i zachowanie. Testów w przeglądarce (Playwright) w tej rundzie nie dodajemy, bo zmieniłyby CI i wszystkie trzy zadania by od nich zależały.

### Podział plików (żeby zadania się nie blokowały)
| Plik | Właściciel |
|---|---|
| `src/theme.css` (globalne style: `100dvh`, `env(safe-area-inset-*)`) | P15 |
| `index.html` (`viewport-fit=cover`) | P15 |
| `HomeScreen`, `AppNav`, `NewGameForm`, `GameSetupSummary`, `UnfinishedGames`, `StartBar` | P15 |
| `GameScreen` (poza jednym warunkiem z P17), `MatchHeader`, `Scoreboard`, `TurnPanel`, `Keypad`, `MatchStatsPanel`, `EventBanner` | P16 |
| nowy `MatchEndView` (i jego testy), warunek w `GameScreen`, który go pokazuje, nowe funkcje w `api/client.ts` (tylko dopisane) | P17 |
| `StatsScreen`, `RankingBoard`, `PlayerProfile`, `HeadToHeadPanel`, `FormChart`, `MatchHistoryList` | P19 |
| `MatchEndView` (i jego testy) | P20 |
| `i18n/pl.ts` | wszyscy, tylko dopisywanie nowych kluczy, bez zmiany istniejących |

Zadanie nie zmienia plików innego właściciela. P15-P17 nie obejmowały ekranów statystyk i historii (`StatsScreen`, `HistoryScreen`). Statystyki robi P19. `HistoryScreen` zostaje poza zakresem, ale używa `MatchHistoryList` z P19, więc P19 nie może go zepsuć. `AppNav` należy do P15 (zrobione) i P19 go nie zmienia.

---

## P15: ekran startowy A2 na wszystkich szerokościach

**Cel:** istniejący ekran „Nowa gra” w układzie A2 (P14) działa na telefonie i tablecie. Zostaje jeden ekran, bez kreatora w krokach. Z makiety `Kreator krok 3 - ustawienia.html` bierzemy tylko układ sekcji ustawień i karty podsumowania.

**Tablet (1024-1279 px):**
- Dwie kolumny: formularz po lewej, prawa kolumna 340 px (`GameSetupSummary` i `UnfinishedGames`), jak prawa karta z makiety kreatora.
- Grupy ustawień (punkty startowe, liczba legów, tryb treningu) jako przełączniki segmentowe o wysokości 60 px, z nazwą grupy i jednozdaniowym opisem nad nimi (opisy z makiety: „301, 501 lub 701”, „ile legów do wygranej”). Pokazujemy tylko grupy, które już są. Bez „Zasady wyjścia” i „Wejścia do gry”.
- Dolny pasek ze Startem jak w A2, z przyciskiem „Start gry” o wysokości 68 px.

**Monitor (≥ 1280 px):** bez zmian względem A2 (prawa kolumna 440 px).

**Telefon i pośredni:**
- `AppNav`: linki mieszczą się bez poziomego przewijania (np. same ikony z `aria-label` albo zwijane menu). Stan kamery i głosu zostaje widoczny.
- Jedna kolumna: typ gry (kafle jeden pod drugim albo w rzędzie, jeśli się mieszczą), gracze (siatka 2 kolumn), ustawienia, podsumowanie, gry do dokończenia.
- Dolny pasek przyklejony nad `safe-area-inset-bottom`, przycisk „Start gry” na całą szerokość.
- Okna dialogowe (nowy gracz, porzucenie, koniec treningu) mieszczą się na 390 px.

**Globalnie (tylko P15):** `html, body, #root` z wysokością `100dvh` zamiast `100%`, marginesy `env(safe-area-inset-*)` dla przyklejonych pasków, `viewport-fit=cover` w meta viewport.

**Kryteria akceptacji:**
- [ ] Na 1180×820 układ odpowiada makiecie kreatora (karta ustawień po lewej, podsumowanie z dużym Startem po prawej), bez elementów spoza zakresu.
- [ ] Na 1440×810 ekran wygląda jak po P14.
- [ ] Na 390×844 i 768×1024 jedna kolumna, brak poziomego przewijania, Start zawsze widoczny.
- [ ] Wszystkie dotychczasowe akcje działają jak dziś: typ, gracze, punkty, legi, tryb treningu, nowy gracz, start, dokończenie, porzucenie, koniec treningu.
- [ ] `game/game-setup.ts` i `api/**` bez zmian.
- [ ] `pnpm test`, `pnpm typecheck` i `pnpm lint` przechodzą.

**Poza zakresem:** kreator w krokach, Straight-out, zasada wejścia jako wybór, zapamiętywanie ostatnich ustawień, ekrany statystyk i historii.

---

## P16: ekran gry (wpis ręczny) na wszystkich szerokościach

**Cel:** ekran gry w toku (`GameScreen`, gdy mecz nie jest zakończony) działa na telefonie i tablecie. Wzorzec tabletu: `Gra - wpis reczny.html`.

**Tablet (1024-1279 px):**
- Lewa kolumna 340 px: etykieta „Kolejka rzutów” i wiersze `Scoreboard` w **układzie piętrowym** (duży pozostały wynik u góry, pod nim awatar, imię, etykieta „Rzuca”/„Następny” i kropki legów). Rzucający ma ramkę `--color-accent` i strzałkę jak dziś. Wiersz wybiera układ przez container query (wąska kolumna: piętrowy, szeroka: jak dziś). `MatchStatsPanel` zostaje pod kolejką.
- Prawa kolumna: nagłówek tury, trzy sloty rzutek (wysokość 112 px), w rzędzie suma tury i zamknięcie, pod nimi klawiatura.
- `Keypad`: przełącznik mnożnika o wysokości 58 px, pola 1-20 w siatce 10 × 2 (kafelki 78 px), rząd specjalny z dzisiejszymi przyciskami: 25/Bull (jeden przycisk zależny od mnożnika, jak dziś) i Pudło. „Cofnij” zostaje tam, gdzie jest dziś (`TurnPanel`). Osobnych przycisków „Bull 50” i „Outer 25” ani podświetlenia pola z podpowiedzi zamknięcia na klawiaturze (makieta: przerywana ramka przy 12) nie dodajemy, bo to nowe zachowanie. Podpowiedź zamknięcia zostaje w `TurnPanel` (`suggestCheckout`).
- `MatchHeader` z obecną treścią (tryb, legi, kamera, głos, efekty, Porzuć/Wznów/Zakończ trening) w jednym pasku.

**Monitor (≥ 1280 px):** jak dziś (lewa kolumna `--scoreboard-width`).

**Telefon i pośredni:**
- `MatchHeader` kompaktowy: tytuł i menu z akcjami (głos, efekty, Porzuć, Wznów, Zakończ trening). Żadna akcja nie znika.
- Kolejka rzutów jako wiersze ok. 64 px (wynik obok imienia, bez nachodzenia na siebie), potem sloty (ok. 78 px), jedna karta z sumą i zamknięciem, klawiatura 5 × 4 (kafelki ≥ 56 px), rząd specjalny ≥ 54 px. Klawiatura bez przewijania na 390×844, jeśli się zmieści. Jeśli nie, przewija się treść nad nią, a klawiatura zostaje na dole.
- Komunikaty (brak połączenia, błąd, gra porzucona, trening zakończony) i `EventBanner` widoczne nad klawiaturą.

**Zachowanie:** bez zmian. Te same wywołania (`sendHit`, `sendUndo`, `sendAbandon`, `sendResume`, `sendEndPractice`), ta sama blokada klawiatury, te same okna dialogowe, zabawa (3-4 graczy) i trening działają w nowym układzie.

**Kryteria akceptacji:**
- [ ] Na 1180×820 układ odpowiada makiecie (kolumna 340 px z piętrowymi wierszami, sloty, suma i zamknięcie w rzędzie, klawiatura 10 × 2).
- [ ] Na 1440×810 ekran wygląda jak dziś, także przy 4 graczach.
- [ ] W wierszu paska wyników przy kolumnie 340 px wynik nie nachodzi na imię ani awatar (test sprawdza, że wąski kontener daje układ piętrowy).
- [ ] Na 390×844 klawiatura ma kafelki ≥ 56 px i nie ma poziomego przewijania.
- [ ] Wszystkie akcje z `MatchHeader` są dostępne na każdej szerokości.
- [ ] `api/**`, `game/checkout.ts` i logika `useMatch` bez zmian.
- [ ] `pnpm test`, `pnpm typecheck` i `pnpm lint` przechodzą.

**Poza zakresem:** widok zakończonego meczu 1v1 (P17), nowe przyciski klawiatury (osobne Bull 50 i Outer 25, Cofnij w klawiaturze), podświetlenie zamknięcia na klawiaturze, zmiana logiki mnożnika, widok TV/nakładka.

---

## P17: koniec meczu 1v1 z Rewanżem i Nowym meczem

**Cel:** zakończony mecz 1v1 dostaje własny widok według `Koniec meczu 1v1.html` na wszystkich szerokościach, z nowymi przyciskami „Rewanż” i „Nowy mecz”. Zakończona zabawa i trening zostają jak dziś (`MatchSummaryPanel` w ekranie gry).

**Podpięcie:** nowy komponent `components/MatchEndView.tsx`. `GameScreen` pokazuje go zamiast zwykłego układu, gdy `state.type === 'match' && state.finished`. To jeden warunek po hookach i przed głównym `return`, reszty `GameScreen` P17 nie zmienia. Dane z istniejących `useMatch` i `useMatchSummary`.

**Tablet i monitor (≥ 1024 px):**
- Górny pasek: „Zamknij” (powrót na `#/`), tytuł „Podsumowanie” oraz przełączniki głosu i efektów, jeśli są dziś w nagłówku gry.
- Siatka `1fr / 470px`, odstęp `--space-page`.
- Lewa kolumna: karta zwycięzcy z ramką `--color-accent` (ikona pucharu, „Mecz zakończony”, „{imię} wygrywa”, awatary i wynik w legach np. „2 : 1”, linia z ustawieniami „501 · Double-out · Best of 3”), pod nią karty legów (numer, zwycięzca, liczba rzutek) z `summary.legs`. Bez czasu trwania meczu, bo API go nie podaje.
- Prawa kolumna: tabela porównania z dzisiejszymi wierszami `MatchSummaryPanel` (średnia, first 9, 180, 140+, 100+, 60+, najwyższe zamknięcie, % doubli, najlepszy leg, wygrane legi) i nagłówkiem z awatarami.
- Dolny pasek: po lewej „Zapisz i wyjdź” (powrót na `#/`) i „Cofnij” (cofa ostatnią rzutkę jak dziś `TurnPanel`, żeby dało się poprawić źle wpisaną zwycięską rzutkę), po prawej „Nowy mecz” i „Rewanż” (główny, 60 px).
- Zapis gościa (`SaveGuest`) zostaje dostępny.

**Telefon i pośredni:** jedna kolumna: karta zwycięzcy (wynik mniejszy przez `clamp()`), karty legów w rzędzie albo jedna pod drugą, tabela (wiersze ok. 38 px, bez poziomego przewijania strony), przyklejony dolny pasek z „Nowy mecz” i „Rewanż”. „Zapisz i wyjdź” i „Cofnij” w pasku albo nad nim.

**Akcje:**
- **Rewanż:** `createMatch({ type: 'match', playerIds: [ci sami gracze w tej samej kolejności], startingScore, bestOf })`, gdzie `bestOf = 2 × legsToWin − 1`. Kto zaczyna, losuje serwer jak przy każdym nowym meczu. Po sukcesie przejście do `#/matches/{nowe id}`. W trakcie przycisk jest zablokowany (bez podwójnego meczu), błąd pokazany przy przyciskach, a użytkownik zostaje na ekranie.
- **Nowy mecz:** przejście na `#/` (ekran startowy).
- **Zamknij, Zapisz i wyjdź:** przejście na `#/` (mecz jest już zapisany).
- **Cofnij:** to samo co dziś `sendUndo`. Po cofnięciu mecz nie jest zakończony, więc wraca zwykły ekran gry.
- Stany: ładowanie podsumowania (dzisiejszy tekst ładowania), błąd podsumowania (dzisiejszy komunikat).

**Kryteria akceptacji:**
- [ ] Na 1180×820 układ odpowiada makiecie (bez czasu trwania).
- [ ] Na 390×844 jedna kolumna, brak poziomego przewijania, Rewanż i Nowy mecz zawsze widoczne.
- [ ] Rewanż tworzy mecz z tymi samymi graczami, punktami i liczbą legów (test z atrapą API, także blokada podwójnego kliknięcia i błąd).
- [ ] Cofnij z widoku końca meczu wraca do gry (test).
- [ ] Zakończona zabawa i zakończony trening wyglądają jak dziś.
- [ ] `pnpm test`, `pnpm typecheck` i `pnpm lint` przechodzą.

**Poza zakresem:** czas trwania meczu, rewanż z zamianą rozpoczynającego, rewanż dla zabawy i treningu, nowy widok podsumowania zabawy.

---

## P19: statystyki na wszystkich szerokościach

**Cel:** oba widoki zakładki statystyk działają na telefonie i tablecie: ranking (`#/stats`) i karta gracza (`#/stats/:playerId`). Makiet RWD dla statystyk nie ma. Wzorcem monitora jest `design/mockups/theme-a-stats.html` (+ `.png`), a układ na mniejsze szerokości wynika z zasad wspólnych powyżej. Nic nie dochodzi i nic nie znika.

**Ranking (`StatsScreen`, `RankingBoard`):**
- **Monitor (≥ 1280 px):** bez zmian.
- **Tablet (1024-1279 px):** dwie kolumny jak dziś (ranking i kafle 2 × 2), ale bez ucinania treści przy 820 px wysokości. Jeśli całość się nie mieści, przewija się `main` (bez `overflow-hidden` poniżej `xl`), a kafle i lista rankingu nie są przycinane.
- **Telefon i pośredni (< 1024 px):** jedna kolumna: tytuł z podtytułem, filtr typu gier, ranking, kafle (jedna kolumna poniżej 640 px, 2 × 2 od 640 px). Mniejszy padding strony (np. `px-4`, od `sm:` większy) i tytuł skalowany przez `clamp()` zamiast stałych 56 px. Filtr zawija się w kilka rzędów bez poziomego przewijania.
- Wiersz rankingu (pozycja, awatar, imię, wartość) przez container query: w wąskim kontenerze długie imię się skraca albo łamie, a wartość zostaje widoczna i nie nachodzi na imię.

**Karta gracza (`StatsScreen` w widoku gracza, `PlayerProfile`, `HeadToHeadPanel`, `FormChart`, `MatchHistoryList`):**
- **Monitor:** bez zmian (kolumna `max-w-4xl`).
- **Tablet:** jak monitor, z odstępami dopasowanymi do szerokości.
- **Telefon i pośredni:** jedna kolumna z mniejszym paddingiem. Lista graczy zawija się w rzędy przycisków ≥ 44 px. Statystyki gracza, head-to-head i historia gier mieszczą się bez poziomego przewijania strony: tabele i listy zmieniają układ przez container queries (np. wiersz historii w dwóch liniach) albo przewijają się w swoim kontenerze. `FormChart` skaluje się do szerokości kontenera, a etykiety osi pozostają czytelne.
- Akcje profilu („Edytuj profil”, „Archiwizuj”, „Przywróć”) i ich okna dialogowe mieszczą się na 390 px.

**Ekran historii (`#/history`):** poza zakresem, ale korzysta z `MatchHistoryList`. Zmiany w tym komponencie nie mogą zepsuć historii: ta sama treść wierszy i ten sam link „Szczegóły”, a na monitorze ten sam wygląd.

**Kryteria akceptacji:**
- [ ] Na 1440×810 ranking i karta gracza wyglądają jak dziś.
- [ ] Na 1180×820 ranking ma dwie kolumny i nic nie jest ucięte (da się przewinąć do ostatniego kafla).
- [ ] Na 390×844 i 768×1024 oba widoki mają jedną kolumnę i brak poziomego przewijania, a wszystkie filtry, przyciski i linki są dostępne.
- [ ] Ekran historii na 1440×810 wygląda i działa jak dziś.
- [ ] `api/**`, `game/**` i dane ze statystyk bez zmian.
- [ ] Istniejące testy `StatsScreen` i `HistoryScreen` przechodzą bez zmiany znaczenia. Nowe testy sprawdzają klasy układu: jedna kolumna bez prefiksu, `@container` w wierszu rankingu, brak `overflow-hidden` poniżej `xl`.
- [ ] `pnpm test`, `pnpm typecheck` i `pnpm lint` przechodzą.

**Poza zakresem:** nowe statystyki, kafle i filtry, zmiany w API, ekran historii (poza tym, że nie może się zepsuć), `AppNav`.

---

## P20: widok końca meczu, przywrócenie danych legów i dostępność

**Cel:** widok końca meczu 1v1 (`MatchEndView`, P17) pokazuje wszystko, co przed P17 pokazywało podsumowanie meczu. Karty legów zgubiły dwie informacje. Bez zmian w układzie i bez nowych funkcji.

**Zmiany (tylko `components/MatchEndView.tsx`, jego testy i nowe klucze w `i18n/pl.ts`):**
1. **Zamknięcie w karcie lega:** obok zwycięzcy i liczby rzutek pokazujemy zamknięcie z `leg.checkout` (np. „zamknięcie 121”), tak jak dawne `pl.legResult`.
2. **Średnie w legu:** pod tą linią średnie obu graczy w tym legu z `leg.averages` (np. „Marek 74,2 · Ola 58,0”), przygaszonym tekstem i w formacie `formatAverage`, jak dawna lista legów w `MatchSummaryPanel`.
3. **Błąd Rewanżu:** komunikat o nieudanym utworzeniu meczu (`pl.rematchFailed`) dostaje `role="alert"`, żeby czytnik ekranu go ogłosił.
4. Karty legów nadal mieszczą się na każdej szerokości: na telefonie dłuższy tekst łamie się w karcie, bez poziomego przewijania.

**Kryteria akceptacji:**
- [ ] Test: karta lega pokazuje zwycięzcę, liczbę rzutek, zamknięcie i średnie obu graczy z danych podsumowania.
- [ ] Test: po nieudanym Rewanżu komunikat ma `role="alert"`.
- [ ] `MatchSummaryPanel`, `GameScreen` i `api/**` bez zmian.
- [ ] `pnpm test`, `pnpm typecheck` i `pnpm lint` przechodzą.

**Poza zakresem:** usuwanie nieosiągalnych gałęzi 1v1 w `MatchSummaryPanel` (osobne sprzątanie), czas trwania meczu, zmiany w API.
