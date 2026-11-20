# Wijzigingen

## 1.1.0 (2026-11-20)

- Opmaak zoals MyPad: logo en titel linksboven, knoppen rechtsboven, inlogscherm in dezelfde stijl.
- Dag/nacht-schakelaar (Auto, zon, maan) rechtsonder, zelfde uiterlijk als MyPad.
- Fabrikantlogo's per apparaat. Peek haalt ze op uit de open Simple Icons-set (via jsDelivr), bewaart ze in /data/logos en toont anders een letter-badge. Alleen de merknaam gaat naar buiten, nooit MAC-adressen of apparaatnamen. Uit te zetten in de instellingen of met PEEK_LOGOS=0.
- Sorteren op naam, IP-adres, MAC, fabrikant en laatst gezien: klik op een kolomkop (of kies in de lijst op de telefoon). De keuze blijft bewaard.
- Online-bolletjes iets feller groen.

## 1.0.0 (2026-11-20)

Eerste versie van Peek.

- Scant het LAN (automatisch gevonden subnet, anders 192.168.2.0/24) en toont per apparaat IP, MAC, naam en fabrikant.
- Alleen kijken: Peek stelt niets in op het netwerk, wekt niets en scant geen poorten.
- Eigen namen, notitie en icoon per apparaat, bewaard op MAC-adres (blijft staan als het IP verandert).
- Fabrikant via de IEEE-lijst (lokaal opgezocht, maandelijks ververst) en anders geraden op de naam in het netwerk (DNS, mDNS, NetBIOS). Privé-MAC-adressen worden herkend.
- Online en offline met "laatst gezien", markering van nieuwe apparaten, zoeken, filteren en sorteren.
- Automatisch scannen met instelbare frequentie, knop "Nu scannen", CSV-export.
- Inloggen met gebruikersnaam en wachtwoord uit de compose. Licht en donker thema.
