# P31-P32: stała klawiatura, domyślnie 301 i best of 1

Dwa niezależne zadania z feedbacku graczy (`feedback-graczy.md`, decyzja 2026-10-20). Mogą iść równolegle: P31 dotyczy układu ekranu gry, P32 domyślnych ustawień nowej gry. Wspólne zasady z `design/rwd.md` obowiązują dalej.

## P31: klawiatura nie skacze na ekranie gry

**Problem (feedback):** „klawiatura na widoku gry skacze, nie da się wygodnie z niej korzystać”. Urządzenie i moment nie są znane, więc poprawka ma usunąć każdą zmianę położenia klawiatury w trakcie gry, na każdej szerokości.

**Przyczyny w kodzie (`packages/web/src/screens/GameScreen.tsx`):**
1. **Telefon i tablet poniżej `lg`:** dok z klawiaturą jest `sticky bottom-0` w kolumnie `main`. Gdy treść nad nim jest niższa niż ekran, dok stoi zaraz pod treścią, a nie na dole ekranu, więc każda zmiana wysokości nad nim (suma tury, panel zamknięcia, pasek wyników) go przesuwa.
2. **`EventBanner` (bust, wygrana) jest w doku pod klawiaturą.** Gdy się pojawia, dok rośnie i klawiatura podjeżdża; gdy znika, wraca.
3. **Od `lg`:** dok ma `display: contents`, a klawiatura stoi w prawej kolumnie pod `TurnPanel`. Panel zamknięcia (`TurnPanel` zwraca `null`, gdy nie ma podpowiedzi) i komunikaty (`Notice`, `lg:order-first`) zmieniają wysokość nad klawiaturą.

**Zmiana (tylko układ, bez zmian w logice wpisu i w danych):**
1. **Klawiatura przypięta do dołu ekranu poniżej `lg`:** dok zawsze na dole widocznego obszaru (np. `main` jako kolumna z przewijaną treścią i dokiem poza nią albo `mt-auto`), niezależnie od wysokości treści nad nim. Przewijanie paska wyników nie przesuwa klawiatury.
2. **Baner bez wpływu na układ:** `EventBanner` jako nakładka (pozycja absolutna nad klawiaturą lub nad panelem tury), która nie zmienia wysokości żadnego bloku. Baner nie zasłania przycisków klawiatury ani „Cofnij”.
3. **Stała wysokość nad klawiaturą od `lg`:** miejsce na panel zamknięcia zarezerwowane także wtedy, gdy podpowiedzi nie ma (pusty blok tej samej wysokości, bez treści dla czytnika ekranu), a komunikaty nie przesuwają klawiatury (nakładka albo stałe miejsce).
4. Pozostałe zmiany w trakcie gry (rotacja kolejki w pasku wyników, suma tury, sloty rzutek) też nie mogą przesuwać klawiatury.
5. Koniec gry może zmienić układ (klawiatura znika, pojawia się podsumowanie), bo wtedy wpis się kończy.

**Kryteria akceptacji:** w headless Chromium, przy 375×812, 390×844, 768×1024, 1280×800 i 1920×1080, położenie i rozmiar klawiatury (`getBoundingClientRect` kontenera klawiatury) są identyczne (±1 px) w każdym z tych stanów jednej gry: przed pierwszą rzutką, po 1 i 2 rzutkach, po zakończonej turze, przy pokazanym banerze bust i po jego zniknięciu, przy pojawieniu się i zniknięciu panelu zamknięcia, po zmianie gracza. Brak poziomego przewijania strony. Wyniki pomiarów w opisie PR-a.

**Testy:** testy komponentu sprawdzające, że baner i panel zamknięcia nie zmieniają struktury doku (np. baner poza przepływem, placeholder zamknięcia), oraz istniejące testy ekranu gry bez zmian w oczekiwaniach.

**Poza zakresem:** zmiana wyglądu klawiatury, nowe funkcje, zmiany w serwerze.

## P32: domyślnie 301 i best of 1

**Feedback:** „default na start nowej gry daj 301 i best of 1”.

**Zmiana:**
1. **Kreator:** `INITIAL_SETUP` w `packages/web/src/game/game-setup.ts`: `startingScore: 301`, `bestOf: 1`. Dotyczy meczu 1v1 i zabawy (zabawa używa tych samych punktów startowych). Solo 501 zostaje 501.
2. **API:** domyślne wartości w `CreateMatchRequest` (`packages/schema/src/match-api.ts`): `startingScore` 301 dla `match` i `casual`, `bestOf` 1 dla `match`. Gry zapisane wcześniej się nie zmieniają (wartości są zapisane w bazie).
3. **Dokumentacja:** `README.md` (sekcja „Rodzaje gry” i „Zasady gry”), `packages/schema/README.md` i `packages/web/README.md`, jeśli wymieniają domyślne wartości.
4. Wybór 501, 701 oraz best of 3 i 5 zostaje bez zmian, tylko domyślne zaznaczenie jest inne.

**Testy:** domyślne wartości w schemacie (żądanie bez `startingScore` i `bestOf`), początkowy stan kreatora (zaznaczone 301 i best of 1), istniejące testy z jawnymi wartościami bez zmian.

**Poza zakresem:** zapamiętywanie ostatnich ustawień, zmiany w silniku, `CLAUDE.md` (decyzję dopisuje autor).
