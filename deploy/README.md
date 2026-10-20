# Wdrożenie na VPS (Mikr.us)

Ten katalog uruchamia aplikację jako usługę systemd na małym serwerze z Ubuntu 24.04. Ta sama usługa podaje front i API pod jednym adresem.

- `autoscore.service`: usługa systemd, działa jako użytkownik `autoscore` i wstaje ponownie po awarii.
- `autoscore.env.example`: wzór pliku ze zmiennymi serwera.
- `deploy.sh`: wdraża jeden commit z `main`, buduje front, robi kopię bazy, sprawdza `/health` i wycofuje zmianę, gdy coś pójdzie nie tak.
- `backup.sh`: codzienna kopia bazy, zostaje 14 najnowszych.
- `pull-backup.sh`: kopiuje najnowszą kopię z serwera na Maca.
- `migrate-db.sh`: jednorazowe przeniesienie lokalnej bazy na serwer. `test-migrate-db.sh` sprawdza go na bazach tymczasowych.

W przykładach `<host>` to adres serwera, `<port>` to port SSH, a `<admin>` to root albo użytkownik z `sudo` bez hasła.

## Instalacja na serwerze

Node 24 musi leżeć w `/usr/bin` albo `/usr/local/bin`, bo tylko tam systemd szuka polecenia `node`. Zainstaluj go na przykład z NodeSource, nie przez nvm. Potrzebne są też pnpm 12.10.1 (globalnie), `sqlite3`, `git` i `curl`.

```sh
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs sqlite3 git curl
sudo npm install -g pnpm@12.10.1
```

Sprawdź, że sesja SSH bez powłoki interaktywnej widzi oba polecenia. Wynik to dwie ścieżki:

```sh
ssh -p <port> <admin>@<host> 'command -v node pnpm'
```

## Użytkownik i katalogi

```sh
sudo adduser --disabled-password --gecos '' autoscore
sudo usermod -aG systemd-journal autoscore
sudo -u autoscore git clone https://github.com/<owner>/<repo>.git /home/autoscore/app
sudo -u autoscore mkdir -p /home/autoscore/data /home/autoscore/backups/daily /home/autoscore/backups/deploy /home/autoscore/logs
```

Grupa `systemd-journal` pozwala `deploy.sh` czytać log usługi bez sudo. Baza leży w `/home/autoscore/data`, poza katalogiem z kodem, więc `git checkout` jej nie dotyka.

## Subdomena

Darmowa subdomena Mikr.us dla portu 3000 nie wymaga ustawień w panelu, dlatego zostaw `PORT=3000`. Adres aplikacji, czyli frontu i API, ma postać `https://<serwer>-3000.mikrus.cloud`. HTTPS i proxy zapewnia Cloudflare, a aplikacja nasłuchuje po HTTP na IPv6 (`HOST=::`).

## Plik env i usługa

```sh
sudo install -d -m 755 /etc/autoscore
sudo install -m 640 -o root -g autoscore /home/autoscore/app/deploy/autoscore.env.example /etc/autoscore/autoscore.env
sudoedit /etc/autoscore/autoscore.env
```

Wpisz hasło, sekret i adres aplikacji w `AUTOSCORE_PUBLIC_URL`. `AUTOSCORE_CORS_ORIGIN` zostaw pustą, bo front i API działają pod jednym adresem. Znaczenie zmiennych `AUTOSCORE_*` opisuje [README serwera](../packages/server/README.md), a `PORT`, `HOST` i `DATABASE_PATH` [README w katalogu głównym](../README.md).

Instalacja usługi i pierwszy start:

```sh
sudo cp /home/autoscore/app/deploy/autoscore.service /etc/systemd/system/autoscore.service
sudo systemctl daemon-reload
sudo -u autoscore bash -c 'cd /home/autoscore/app && CI=true pnpm install --frozen-lockfile'
sudo -u autoscore bash -c 'cd /home/autoscore/app && VITE_API_URL=https://<serwer>-3000.mikrus.cloud VITE_BASE=/ NODE_OPTIONS=--max-old-space-size=512 pnpm --filter @autoscore/web build'
sudo systemctl enable --now autoscore
curl -s 'http://[::1]:3000/health'
journalctl -u autoscore -f
```

Build frontu przed startem jest potrzebny, bo serwer z ustawioną `AUTOSCORE_WEB_DIR` nie wstaje bez `index.html`. W `VITE_API_URL` wpisz ten sam adres co w `AUTOSCORE_PUBLIC_URL`. `/health` odpowiada `{"status":"ok"}`, a `https://<serwer>-3000.mikrus.cloud/` pokazuje ekran logowania. Po zmianie pliku env uruchom `sudo systemctl restart autoscore`. Po zmianie `autoscore.service` w repo skopiuj plik ponownie i wykonaj `sudo systemctl daemon-reload`.

## Sudo dla `autoscore`

`deploy.sh` zatrzymuje i uruchamia usługę przez `sudo -n`. Otwórz regułę przez `sudo visudo -f /etc/sudoers.d/autoscore` i wpisz jedną linię:

```
autoscore ALL=(root) NOPASSWD: /usr/bin/systemctl start autoscore, /usr/bin/systemctl stop autoscore, /usr/bin/systemctl restart autoscore
```

Reguła pozwala dokładnie na te trzy polecenia. Sprawdzenie: `sudo -u autoscore sudo -n systemctl restart autoscore`.

## Cron

Codzienna kopia o 3:15 czasu serwera. Wpisz linię przez `sudo -u autoscore crontab -e`:

```
15 3 * * * /home/autoscore/app/deploy/backup.sh >> /home/autoscore/logs/backup.log 2>&1
```

Kopie trafiają do `/home/autoscore/backups/daily`. Każda przechodzi `PRAGMA integrity_check`, a zostaje 14 najnowszych. Najnowszą kopię pobierzesz na Maca jako root albo użytkownik z grupy `autoscore`, bo katalog domowy `autoscore` jest zamknięty dla innych. Klucz wdrożeniowy tu nie zadziała.

```sh
deploy/pull-backup.sh --ssh <użytkownik>@<host> --port <port> --local-dir <katalog-na-kopie>
```

## Klucz wdrożeniowy

Na Macu wygeneruj osobny klucz tylko do wdrożeń:

```sh
ssh-keygen -t ed25519 -N '' -C autoscore-deploy -f autoscore-deploy
```

Na serwerze dopisz klucz publiczny do `/home/autoscore/.ssh/authorized_keys` (katalog `700`, plik `600`, właściciel `autoscore`) w jednej linii:

```
command="/home/autoscore/app/deploy/deploy.sh",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA… autoscore-deploy
```

Ten klucz uruchamia tylko `deploy.sh`. Tekst polecenia z `ssh -p <port> autoscore@<host> <sha>` trafia do skryptu w `SSH_ORIGINAL_COMMAND`, a skrypt przyjmuje wyłącznie pełny SHA.

W GitHubie potrzebne są:

- sekret `MIKRUS_SSH_KEY`: klucz prywatny `autoscore-deploy`,
- sekret `MIKRUS_KNOWN_HOSTS`: wynik `ssh-keyscan -p <port> <host>`,
- zmienna `MIKRUS_HOST`: `<host>`,
- zmienna `MIKRUS_SSH_PORT`: `<port>`.

## Przeniesienie bazy

1. Wdróż na serwer ten sam commit z `main`, na którym działa lokalny serwer (`git rev-parse HEAD`). `migrate-db.sh` odmawia, gdy baza na serwerze nie zna którejś migracji z lokalnej bazy.
2. Zatrzymaj lokalny serwer, żeby po kopii nie przybyły nowe rzutki.
3. Przenieś bazę jako `<admin>`. Klucz wdrożeniowy tu nie zadziała, bo uruchamia tylko `deploy.sh`.

```sh
deploy/migrate-db.sh packages/server/autoscore.sqlite --ssh <admin>@<host> --port <port> --remote-db /home/autoscore/data/autoscore.sqlite
```

Skrypt robi kopię przez `sqlite3 .backup`, sprawdza `integrity_check` i liczy wiersze w `players`, `matches`, `throws` i `match_events` lokalnie i po wysłaniu na serwer. Różnica przerywa pracę przed zatrzymaniem usługi. Baza na serwerze z wierszami w tych tabelach wymaga `--force`. Istniejąca baza trafia przed nadpisaniem do `<baza>.before-migrate-<czas UTC>`. Na koniec skrypt uruchamia usługę i czeka do 30 s na `/health`.

Próbę bez serwera zrobisz w trybie lokalnym: `deploy/migrate-db.sh --local packages/server/autoscore.sqlite /tmp/proba.sqlite`.

Od tej chwili źródłem prawdy jest baza na serwerze. Lokalna baza zostaje jako archiwum.

## Test WebSocketa

Zapisz jako `ws-test.mjs` i uruchom przez `AUTOSCORE_PASSWORD='…' node ws-test.mjs <id-gry>`. Node 24 ma globalny `WebSocket`.

```js
const api = 'https://<serwer>-3000.mikrus.cloud';
const response = await fetch(`${api}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: process.env.AUTOSCORE_PASSWORD }),
});
const { token } = await response.json();
const socket = new WebSocket(`${api.replace('https://', 'wss://')}/matches/${process.argv[2]}/live`);
socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'auth', token })));
socket.addEventListener('message', (event) => console.log(event.data));
socket.addEventListener('close', (event) => console.log('close', event.code, event.reason));
```

Pierwsza wiadomość to `state_updated`. Kod 4401 oznacza zły token, a 4404 nieznaną grę.

## Przywracanie z kopii

```sh
ts=$(date -u +%Y%m%dT%H%M%SZ)
sudo systemctl stop autoscore
sudo -u autoscore mv /home/autoscore/data/autoscore.sqlite "/home/autoscore/data/autoscore.sqlite.old-$ts"
sudo -u autoscore rm -f /home/autoscore/data/autoscore.sqlite-journal
sudo -u autoscore cp /home/autoscore/backups/daily/autoscore-<czas>.sqlite /home/autoscore/data/autoscore.sqlite
sudo systemctl start autoscore
curl -s 'http://[::1]:3000/health'
```

Kopie sprzed wdrożeń leżą w `/home/autoscore/backups/deploy` z krótkim SHA poprzedniego commitu w nazwie. Kopia z nowszymi migracjami nie wystartuje na starszym kodzie.

## Ręczne wdrożenie i rollback

```sh
sudo -u autoscore /home/autoscore/app/deploy/deploy.sh <sha>
```

`<sha>` to pełny SHA commitu z `origin/main`. Skrypt odrzuca brudny katalog z kodem i drugi równoległy deploy. Potem przełącza kod, instaluje zależności, buduje front (gdy `AUTOSCORE_WEB_DIR` jest ustawiona), zatrzymuje usługę, kopiuje bazę do `backups/deploy` (zostaje 14 najnowszych), uruchamia usługę i czeka do 30 s na `/health`. Błąd na którymkolwiek z tych kroków, także nieudany build frontu, przywraca poprzedni commit, a gdy kopia powstała, także bazę. Rollback buduje front poprzedniego commitu, a nieudany build w rollbacku kończy się kodem 3. Bazę po nieudanym wdrożeniu skrypt odkłada jako `<baza>.failed-<czas UTC>`. Log trafia do `/home/autoscore/logs/deploy.log`.

Rollback to wdrożenie starszego SHA z `main`. Gdy nowszy commit dodał migrację, starszy kod nie wystartuje na nowszej bazie i `deploy.sh` wróci do nowszego commitu. Wtedy najpierw zatrzymaj usługę i przywróć kopię z `backups/deploy` sprzed wdrożenia nowszego commitu (jak w sekcji wyżej), a potem wdróż starszy SHA. Rzutki zapisane od tamtego wdrożenia zostają tylko w odłożonym pliku.

## Przełączenie działającego serwera na front z serwera

Wdrożenie, które przynosi tę zmianę, wykonuje jeszcze stary `deploy.sh`. Skrypt jest już wczytany, gdy `git checkout` go podmienia, więc tym razem front się nie zbuduje. Kolejność:

1. Wdróż ten commit z pustą albo nieobecną `AUTOSCORE_WEB_DIR` w pliku env.
2. Dopisz do pliku env `AUTOSCORE_WEB_DIR` i `AUTOSCORE_PUBLIC_URL`, a `AUTOSCORE_CORS_ORIGIN` ustaw na pustą wartość.
3. Uruchom raz ręcznie `deploy.sh <ten sam sha>`. Ten przebieg buduje front i restartuje usługę.

`AUTOSCORE_WEB_DIR` ustawiona przed krokiem 1 zatrzymuje start nowego serwera (brak `index.html`) i uruchamia rollback.

## Kody wyjścia `deploy.sh`

| Kod | Znaczenie |
|---|---|
| 0 | Wdrożone, `/health` odpowiada 200. |
| 1 | Odrzucone albo błąd przed jakąkolwiek zmianą: zły SHA, commit spoza `origin/main`, brudny katalog, trwający deploy, brak albo zły `AUTOSCORE_PUBLIC_URL` przy ustawionej `AUTOSCORE_WEB_DIR`. |
| 2 | Wdrożenie nie wyszło, rollback się udał. |
| 3 | Rollback też nie wyszedł. Usługa może nie działać. |

Przy kodach 2 i 3 skrypt wypisuje ostatnie 50 linii `journalctl -u autoscore`.
