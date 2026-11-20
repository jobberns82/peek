# Wijzigingen

## 1.0.0 (2026-11-20)

Eerste versie van Peek.

- Scant het LAN (automatisch gevonden subnet, anders 192.168.2.0/24) en toont per apparaat IP, MAC, naam en fabrikant.
- Alleen kijken: Peek stelt niets in op het netwerk, wekt niets en scant geen poorten.
- Eigen namen, notitie en icoon per apparaat, bewaard op MAC-adres (blijft staan als het IP verandert).
- Fabrikant via de IEEE-lijst (lokaal opgezocht, maandelijks ververst) en anders geraden op de naam in het netwerk (DNS, mDNS, NetBIOS). Privé-MAC-adressen worden herkend.
- Online en offline met "laatst gezien", markering van nieuwe apparaten, zoeken, filteren en sorteren.
- Automatisch scannen met instelbare frequentie, knop "Nu scannen", CSV-export.
- Inloggen met gebruikersnaam en wachtwoord uit de compose. Licht en donker thema.
