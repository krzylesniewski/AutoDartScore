# Makiety etapu 3 „Scena” (zaakceptowane 2026-11-10)

Źródła makiet z kanwy https://claude.ai/artifact/Uw59Q2VKaZLe1R3CWH4Haq (strona „Etap 3: Scena”). Każdy plik `.dc.html` to jeden ekran: układ i wartości są w atrybutach `style` (kolory, promienie, cienie, rozmiary), a dane przykładowe w skrypcie `renderVals()` na końcu pliku. Plików nie da się otworzyć wprost w przeglądarce (ładują `support.js` kanwy), więc czytaj je jako źródło. Wartości są z design systemu w `design/scena/` (README, `tokens.json`, `components/bundle.css`).

| Plik | Ekran | Rozmiar |
|---|---|---|
| `E3Gra1v1.dc.html` | gra 1v1: pasek progresu, zbite punkty, historia tur i statystyki lega w lewej kolumnie, skróty klawiszowe | 1600×900 |
| `E3GraZabawa.dc.html` | gra, zabawa 4 graczy, zakończony gracz z odznaką miejsca | 1600×900 |
| `E3GraWeryfikacja.dc.html` | gra z rzutką `pending` z kamery (z gałęzi `feat/camera`) i bustem w historii | 1600×900 |
| `E3GraTV.dc.html` | widok TV: **odłożony, poza etapem 3** | 1600×900 |
| `E3GraTelefon.dc.html` | telefon, gra; historia tur pod przyciskiem „Tury” | 390×844 |
| `E3NowaGra.dc.html`, `E3NowaGraTelefon.dc.html` | nowa gra (kreator, gry do dokończenia) | 1600×900, 390×844 |
| `E3Podsumowanie1v1.dc.html`, `E3PodsumowanieTelefon.dc.html` | koniec meczu 1v1: czas gry, czas legów, wykres zejścia | 1600×900, 390×844 |
| `E3PodsumowanieZabawa.dc.html` | koniec zabawy: ranking miejsc | 1600×900 |
| `E3Historia.dc.html` | historia gier | 1600×900 |
| `E3Statystyki.dc.html` | statystyki: podium średniej, tablice rekordów | 1600×900 |
| `E3Profil.dc.html` | karta gracza: forma, bilans 1v1 | 1600×900 |
| `E3FreeRun.dc.html`, `E3Solo501.dc.html`, `E3Koncowki.dc.html` | trening | 1600×900 |
| `E3Ustawienia.dc.html`, `E3Logowanie.dc.html` | ustawienia, logowanie | 1600×900 |
| `E3DialogNowyGracz.dc.html`, `E3DialogPorzucenie.dc.html` | dialogi | 1600×900 |

Zmiany po przeglądzie aplikacji (2026-11-10, wygrywają z makietami): tło sceny bez pierścieni tarczy; karta zamknięcia od `lg` na dole prawej kolumny, pod klawiaturą.

Czego makiety nie zmieniają (wiąże `design/plan-etap3.md`): logiki wykresów z P56 (w makietach podział tury na rzutki jest przykładowy), skrótów klawiszowych, zasad RWD z `design/rwd.md` (klawiatura nie skacze), tekstów z `i18n/pl.ts` tam, gdzie istnieją. Liczby w makietach są przykładowe; w aplikacji wszystko pochodzi ze snapshotu i statystyk serwera.

Podglądy komponentów w `design/scena/components/*/preview.html` odwołują się do ikon przez adresy `/_blob/…` artefaktu design systemu; w repo ikony są w `design/scena/assets/Icons/*.svg` (to te same ikony co w `packages/web/src/components/icons.tsx`).
