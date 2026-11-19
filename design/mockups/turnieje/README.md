# Makiety etapu 5: turnieje (projekt z 2026-11-16)

Źródła makiet z kanwy https://claude.ai/artifact/Uw59Q2VKaZLe1R3CWH4Haq (strona „Etap 5: Turnieje (projekt)”). Każdy plik `.dc.html` to jeden ekran: układ i wartości są w atrybutach `style`, a dane przykładowe w skrypcie `renderVals()` na końcu pliku. Plików nie da się otworzyć bezpośrednio w przeglądarce (potrzebują środowiska kanwy); czyta się je jak źródło.

| Plik | Ekran | Rozmiar | PR |
|---|---|---|---|
| `T5Decyzje.dc.html` | plansza z decyzjami (stan 16.11.2026); wiążący jest `design/plan-etap5.md` | 1600×1200 | - |
| `T5Kreator.dc.html` | kreator turnieju: nazwa, format, gracze, zasady, mecze dodatkowe, długość meczów, plan turnieju | 1600×900 | T8 |
| `T5Turniej.dc.html` | ekran turnieju, faza grupowa w toku: tabela krzyżowa, następny mecz, kolejka | 1600×900 | T9, T14 |
| `T5Drabinka.dc.html` | ekran turnieju, play-off: drabinka, mecze dodatkowe, trwający mecz, klasyfikacja końcowa | 1600×900 | T10, T14 |
| `T5Statystyki.dc.html` | statystyki całego turnieju: podium, rekordy, tabela graczy | 1600×900 | T14 |
| `T5Mecz.dc.html` | mecz po ID: statystyki i przebieg lega | 1600×900 | T15 |
| `T5Publiczny.dc.html` | publiczny link na telefonie | 390×844 | T17 |
| `T5TV.dc.html` | widok TV na żywo | 1600×900 | T18 |

Makiety wiążą układ, hierarchię i treść pól. Nie wiążą: liczb (są przykładowe), kolorów wpisanych w plikach (w aplikacji kolory, cienie i promienie pochodzą z `design/theme.css`, komponenty z `design/scena/`), kodu QR (w makiecie jest atrapą) ani zasad RWD z `design/rwd.md`. Tam, gdzie makieta i `design/plan-etap5.md` mówią co innego, wygrywa plan.
