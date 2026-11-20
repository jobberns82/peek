# Peek

Een kleine netwerkscanner voor thuis. Peek laat zien welke apparaten er op je LAN zitten, met IP-adres, MAC-adres, naam en fabrikant. Je kunt apparaten een eigen naam geven die bewaard blijft.

Peek kijkt alleen. Het stelt niets in op je netwerk, wekt geen apparaten en scant geen poorten.

## Hoe het werkt

1. Peek stuurt naar elk adres in het subnet één klein UDP-pakketje, waardoor het besturingssysteem zelf via ARP uitzoekt wie er is.
2. Daarna leest Peek de ARP-tabel uit: dat levert IP en MAC op. Dit kost geen extra rechten.
3. Per apparaat vraagt Peek de naam via DNS (router), mDNS en NetBIOS.
4. De fabrikant komt uit de IEEE-lijst, lokaal opgezocht op de eerste 6 tot 9 tekens van het MAC-adres. Lukt dat niet, dan raadt Peek op de naam (bijvoorbeeld "iPhone" wordt Apple).
5. Telefoons gebruiken vaak een willekeurig MAC-adres (privacyfunctie). Peek herkent die en toont "Privé-adres".

Een scan duurt ongeveer 12 seconden. Verdwenen apparaten staan pas offline na twee gemiste scans, zodat slapende telefoons niet steeds heen en weer springen.

## Installeren

Gebruik `deploy/docker-compose.yml`. Vul zelf een gebruikersnaam en wachtwoord in. Poort 6000 staat bewust niet als standaard: browsers blokkeren die poort (X11), daarom is het 6001.

`network_mode: host` is verplicht, anders ziet Peek alleen het interne Docker-netwerk.

| Variabele | Betekenis | Standaard |
| --- | --- | --- |
| `PEEK_USER` | gebruikersnaam (verplicht) | |
| `PEEK_PASSWORD` | wachtwoord (verplicht, minimaal 8 tekens) | |
| `PORT` | poort van de webinterface | 6001 |
| `PEEK_SUBNET` | subnet, bijvoorbeeld `192.168.2.0/24` | automatisch, anders 192.168.2.0/24 |
| `PEEK_INTERVAL` | minuten tussen scans, 0 = alleen handmatig | 5 |
| `DATA_DIR` | map voor opslag | `/data` |

Scanfrequentie en subnet kun je ook in de app aanpassen (tandwiel).

## Gegevens

In `/data` staan `peek.json` (namen, notities, laatst gezien), `oui.json` (fabrikantenlijst) en `secret` (sleutel voor de sessiecookie). Er gaan geen MAC-adressen of apparaatgegevens het internet op; alleen de fabrikantenlijst wordt bij IEEE opgehaald.

## Beveiliging

- Alles achter een login; foute pogingen worden afgeremd.
- Sessiecookie is HttpOnly en SameSite, en Secure achter https.
- Namen uit het netwerk worden nooit als HTML getoond.
- Strikte Content-Security-Policy.
- Zet Peek achter https (bijvoorbeeld Nginx Proxy Manager of Cloudflare) als je hem buiten je netwerk bereikbaar maakt.

## Ontwikkelen

```
node --test app/test/peek.test.js     # tests
PEEK_DEMO=1 DATA_DIR=/tmp/peek node app/server.js   # demo met verzonnen apparaten (gebruiker demo, wachtwoord demo)
```

Node zonder extra pakketten. Zie `CLAUDE.md` voor de werkafspraken.
