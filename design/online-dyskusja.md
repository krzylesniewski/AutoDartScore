# Wersja online: notatki z dyskusji (2026-10-20)

Status: **wybrany wariant: front i API na Mikr.us, pod jednym adresem** (decyzja 2026-10-20; najpierw wybrano front na GitHub Pages, tego samego dnia zmienione, patrz `design/plan-online.md`). Bez własnej domeny (decyzja 2026-10-20), więc logowanie przez token w nagłówku. Plan PR-ów: `design/plan-online.md`.

## Cel

- Cała aplikacja dostępna online, żeby do grania nie był potrzebny komputer autora.
- Mecze dalej odbywają się twarzą w twarz, przy jednej tarczy. Bez gry na odległość i bez kont graczy.
- Budżet: jak najmniej, około 100 zł rocznie.

**Skutek dla zasad projektu:** bez internetu nie da się grać. To zmienia zasadę local-first z `CLAUDE.md` i przesuwa część etapu 5 przed kamerę (etapy 2-4). Przy planowaniu trzeba to zapisać jako decyzję w `CLAUDE.md` i `auto-score-dart-pomysly.md`.

## Pierwszy wybór (zmieniony 2026-10-20): front na GitHub Pages, API na Mikr.us

Zastąpiony wariantem „wszystko na Mikr.us pod jednym adresem”: jedno wdrożenie z jednym rollbackiem, front i API zawsze w tej samej wersji, bez CORS i bez ustawień Pages. Szczegóły w `design/plan-online.md` (P27, P30).

**API (Fastify + SQLite + WebSocket) na VPS Mikr.us 2.1:**
- Około 75 zł/rok, 1 GB RAM, 10 GB dysku, serwer w Polsce (krótkie opóźnienia). Ceny z serwisów porównawczych, przed zakupem sprawdzić na mikr.us.
- Obecny serwer działa tam bez zmian w architekturze: proces Node, plik SQLite, WebSocket, kolejka zapisów w pamięci.

**Front na GitHub Pages:**
- Darmowe, bo repo jest publiczne. Routing przez `#/`, więc odświeżanie podstron działa bez dodatkowej konfiguracji.
- Wdrożenie przez GitHub Actions po każdym merge'u, bez limitu wdrożeń. Front z nagraniami waży ok. 6 MB i idzie z CDN GitHuba, więc nie obciąża VPS.

## Co trzeba dorobić (szkic PR-ów)

1. **Adres API z konfiguracji:** `VITE_API_URL` zamiast względnego `/api` (`packages/web/src/api/client.ts`) i zamiast `location.host` w adresie WebSocketa (`packages/web/src/api/use-match.ts`).
2. **CORS w Fastify** tylko dla adresu frontu, plus sprawdzanie nagłówka `Origin` przy WebSockecie.
3. **HTTPS i `wss` na VPS** (wymagane, bo strona z Pages działa po HTTPS).
4. **Zabezpieczenie dostępu:** jedno wspólne hasło do całej aplikacji (nie konta graczy, profile zostają bez haseł). Front i API są na różnych domenach, a Safari blokuje ciasteczka między witrynami, więc po zalogowaniu token w `localStorage`, wysyłany w nagłówku `Authorization`, a dla WebSocketa w pierwszej wiadomości.
5. **Kopie zapasowe:** codzienna kopia pliku SQLite poza serwer, np. do darmowej Cloudflare R2.
6. **Wdrożenia:** front przez GitHub Actions na Pages, API skryptem albo GitHub Action na VPS.
7. **Kamera (później):** detekcja dalej działa lokalnie przy tarczy i wysyła zdarzenia do API w chmurze. Potrzebny osobny token dla `vision`.

**Opcja na później:** własna domena z poddomenami (`app.…` na Pages i `api.…` na VPS) to jedna witryna, więc logowanie mogłoby iść przez ciasteczko zamiast tokena. Domena `.pl` kosztuje kilkadziesiąt złotych rocznie, a odnowienie bywa droższe niż pierwszy rok.

## Odrzucone warianty

| Wariant | Dlaczego nie |
|---|---|
| Front na GitHub Pages, API na Mikr.us (pierwszy wybór) | Działa (repo publiczne, routing `#/`), ale to dwa adresy i dwa wdrożenia, które mogą się na chwilę rozjechać, do tego CORS, zmienne i ustawienia Pages. Zmienione na wszystko na Mikr.usie, gdy okazało się, że darmowa subdomena mikrus.cloud z Cloudflare wystarcza. |
| Fly.io | Około $2 miesięcznie za maszynę plus dysk na bazę, w praktyce ok. 100-120 zł/rok. Na granicy budżetu. |
| Render, Supabase i inne darmowe warstwy | Usypiają aplikację albo nie mają trwałego dysku. Supabase wymaga przepisania bazy na Postgres. |
| Front na Netlify Free | 300 kredytów, a wdrożenie produkcyjne kosztuje 15, więc ok. 20 wdrożeń. W ostatnim tygodniu na `main` trafiło 71 commitów. Przekierowanie `/api/*` przez Netlify dałoby REST pod jednym adresem, ale dokumentacja nic nie mówi o WebSocketach przez nie, a żądania mają limit 26 s. |
| Współdzielona baza Mikr.us (MySQL, PostgreSQL 12, MongoDB) | Wystarczyłaby rozmiarem (zalecane do 200 MB na bazę), ale niczego nie daje: plik SQLite na dysku VPS jest prostszy, szybszy i już działa. PostgreSQL 12 nie ma już wsparcia, kopie zapasowe są po naszej stronie, brak gwarancji dostępności, a przejście wymaga drugiego dialektu w Kysely i nowych migracji. Ma sens dopiero przy wielu instancjach API. [Wiki Mikr.us](https://wiki.mikr.us/wspoldzielone_bazy_danych/) |
| API na Netlify (funkcje bezserwerowe) | Brak stałego procesu: nie ma WebSocketa, plik SQLite znika (dysk tymczasowy), kolejka zapisów w pamięci nie działa. Wymagałoby zewnętrznego Postgresa, usługi czasu rzeczywistego (Ably, Pusher) i przepisania warstwy `store`. Dużo pracy dla oszczędności ok. 75 zł rocznie. |

## Źródła

- [Mikr.us VPS od 35 zł/rok (HostGrade)](https://hostgrade.pl/hosting/mikrus/)
- [Mikrus 2.1, 75 zł/rok (HostGrade)](https://hostgrade.pl/hosting/mikrus/mikrus-2-1/)
- [Fly.io Resource Pricing](https://fly.io/docs/about/pricing/)
- [Netlify Pricing](https://www.netlify.com/pricing/)
- [Netlify: rewrites and proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)
