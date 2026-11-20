# Peek: werkafspraken

- Eigenaar: Job. Altijd Nederlands. Rustig, één kleine genummerde stap tegelijk bij handelingen op de server; wacht op "done"/"check".
- Job werkt zelf niet in deze repository: Claude doet alle wijzigingen, commits en versies.
- Nooit wachtwoorden, tokens of gebruikersdata in de repository. In `deploy/docker-compose.yml` staan alleen voorbeeldwaarden.
- Zichtbare wijzigingen eerst met een screenshot laten zien (licht en donker), pas na akkoord pushen.

## Wat het is

Netwerkscanner voor het thuisnetwerk. Toont IP, MAC, naam en fabrikant per apparaat; eigen namen blijven bewaard (op MAC). Leisteengrijs met saliegroen (geen teal, dat is Snatch). Logo: RJ45-stekker met groen oog.

## Harde regels

- Alleen kijken. Nooit iets op het netwerk instellen, apparaten wekken of poorten scannen.
- Node zonder extra pakketten. Geen npm-afhankelijkheden toevoegen.
- Draait met `network_mode: host` (anders geen MAC-adressen). Geen extra rechten nodig.
- Poort 6001. Niet 6000: browsers blokkeren die poort (ERR_UNSAFE_PORT).
- Alles wat uit het netwerk komt (apparaatnamen) is onbetrouwbaar: alleen met `textContent` tonen, nooit als HTML. CSP staat geen inline script of stijl toe.
- Alle API-routes achter de login (behalve `/api/login`, `/api/logout`, `/healthz`).

## Structuur

- `app/server.js`: webserver en API. `app/lib/`: `netutil` (subnet, ARP), `scanner`, `names` (DNS, mDNS, NetBIOS, raden op naam), `oui` (fabrikantenlijst), `store`, `auth`, `demo`.
- `app/public/`: `index.html`, `peek.css`, `peek.js`, iconen.
- `app/test/peek.test.js`: tests (`node --test app/test/peek.test.js`).
- `logo/`: logo's (peek.svg voor donker, peek-licht.svg voor licht, PNG 512 en iPhone-icoon).
- `deploy/docker-compose.yml`, `Dockerfile`, `VERSIE`.

## Image en versies

- GitHub Actions test, bouwt en publiceert naar `ghcr.io/jobberns82/peek` (`latest` en versie) bij elke push naar main en elke 1e van de maand, en maakt de release `vX.Y.Z` met de tekst uit CHANGELOG.md. Na een push de run controleren (`gh run list`).
- Na elke wijziging: versie ophogen in `VERSIE`, `package.json`, `app/server.js` (VERSION) en `app/public/index.html` (ook `?v=` bij css en js), sectie `## X.Y.Z (datum)` bovenaan CHANGELOG.md, testen, commit + push.
- Bijwerken op de server: Dockhand › Check for updates.
- Op de server: app en container `peek`, map `/DATA/AppData/peek/data`, poort 6001, adres peek.jobbes.nl.

## Screenshots maken

Demo-modus met verzonnen apparaten: `PEEK_DEMO=1 DATA_DIR=/tmp/peek PORT=6001 node app/server.js` (gebruiker `demo`, wachtwoord `demo`), daarna met Chrome/Playwright foto's in licht en donker, desktop en telefoon.
