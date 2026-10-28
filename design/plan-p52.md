# P52: wyłączanie komentarzy do tury za zero w ustawieniach

Zmiana wymagań autora z 2026-10-28 (`feedback-graczy.md`), decyzje z tego samego dnia. Wspólne zasady z `design/rwd.md` obowiązują dalej. Kolory tylko z `design/theme.css`, teksty po polsku w `i18n/pl.ts` (front) i `packages/audio/src/pl.ts` (audio), kolor nigdy sam nie niesie znaczenia.

## P52: przełącznik „Komentarze do zera” na ekranie Ustawienia (audio, web)

**Zgłoszenie:** „Komunikaty przy wynikach 0 z trzech lotek w każdym trybie gry powinny mieć opcję wyłączenia ich w settingsach”.

**Dziś:** po turze za 0 punktów (nie przy buście) `announcementFor` w `packages/audio/src/announcement.ts` dokleja po sumie losowo `events/zero_1.mp3` albo `events/zero_2.mp3` (P51, PR #59), we wszystkich typach gier, w których czytana jest suma tury. Nie ma przełącznika: komentarz da się uciszyć tylko wyłączając cały głos. Ekran „Ustawienia” (`packages/web/src/screens/SettingsScreen.tsx`) ma w sekcji dźwięku `VoiceToggle` i `EffectsToggle`; ich stan jest w localStorage per urządzenie (`autoscore.voice`, `autoscore.effects` w `packages/web/src/audio/use-announcer.ts`, brak wpisu oznacza włączone).

**Decyzje 2026-10-28:**
- komentarze do zera są **domyślnie wyłączone**: brak wpisu w localStorage (albo niedostępny localStorage) oznacza wyłączone, inaczej niż przy głosie i efektach;
- przy wyłączonym głosie przełącznik jest **nieaktywny** (widoczny, `disabled`, z zachowanym zapisanym wyborem); po włączeniu głosu wraca do zapisanego stanu;
- ustawienie działa we wszystkich typach gier, per urządzenie, bez zapisu na serwerze.

**Zmiana:**
1. **Audio:** `announcementFor` (i announcer, który go woła) dostaje opcję włączającą komentarz do zera; bez niej komentarza nie ma. Suma tury (także „zero”), zwycięzca, game shot, bust i osiągnięcia bez zmian, kolejność części bez zmian. Nagrania `zero_*` mogą zostać w `EVENT_CLIPS`.
2. **Web, stan:** nowy klucz localStorage (np. `autoscore.zeroComments`, wartości `on`/`off` jak pozostałe) z funkcjami odczytu i zapisu obok głosu i efektów w `use-announcer.ts`, z domyślną wartością „wyłączone”. Announcer na ekranie gry bierze aktualny stan przy każdym komunikacie (zmiana w Ustawieniach działa bez przeładowania strony przy następnym komunikacie).
3. **Web, ekran Ustawienia:** trzeci przełącznik w sekcji dźwięku, obok głosu i efektów, w tym samym stylu (np. komponent `ZeroCommentsToggle` albo wspólny komponent przełącznika, jeśli upraszcza kod). Etykieta np. „Komentarze do zera”, stan pokazany tekstem i ikoną, nie tylko kolorem. Przy wyłączonym głosie `disabled` z czytelnym wyglądem nieaktywnego elementu. Bez zmiany układu przy 375×812.

**Testy:**
- audio: suma 0 bez komentarza domyślnie; z włączoną opcją suma i komentarz; bust za 0 bez komentarza w obu ustawieniach; osiągnięcia czytane niezależnie od opcji;
- web: domyślnie wyłączone przy pustym localStorage; przełączenie zapisuje `on`/`off`; przełącznik nieaktywny przy wyłączonym głosie i aktywny po włączeniu, z zachowanym wyborem; announcer na ekranie gry respektuje zapisany wybór;
- zrzuty ekranu „Ustawień” (głos włączony i wyłączony) przy 375×812, 768×1024 i 1920×1080 w opisie PR-a.

**Poza zakresem:** przełącznik na ekranie gry i w pasku nawigacji, osobne wyłączanie osiągnięć, nowe nagrania, komentarze do innych wyników niż 0, zapis ustawienia na serwerze lub w profilu gracza.
