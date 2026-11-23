# Wijzigingen

## 1.2.3 (2026-11-23)

- Het loginvenster is op alle apps even groot, met logo en naam in het venster en de versie eronder.

## 1.2.2 (2026-11-23)

- Het loginvenster is groter en staat iets boven het midden van het scherm. Logo en naam staan naast elkaar bovenin en de versie staat eronder.

## 1.2.1 (2026-11-21)

- Fix: een regel opengeklapt kon niet meer dichtgeklikt worden (door de klasse van de nieuwe open-knop). Inklappen werkt weer voor alle apparaten, op desktop en telefoon. Inklappen wacht ook niet meer op een invoerveld.

## 1.2.0 (2026-11-21)

- Open-knop: bij online apparaten die meestal een webpagina hebben (router, printer, camera, server, hubs, klimaat- en smarthome-apparaten) staat een klein icoontje achter het IP-adres. In het detailvenster van elk online apparaat staat de knop Open webpagina (http://<ip>, nieuw tabblad). Peek scant hiervoor geen poorten.

## 1.1.1 (2026-11-20)

- Nieuw logo: stekker met een symmetrisch oog dat over de linkerwand valt (wit met zwarte pupil in donker, zwart met witte pupil in licht). Logo's zonder achtergrond als PNG in de map logo.
- Nieuwe iconen voor klimaat en smarthome: thermostaat, airco, verwarming, ventilatie, luchtreiniger, sensor, slimme stekker, lamp, slot, deurbel, stofzuiger, rolluik, hub, rookmelder, zonnepanelen en laadpaal. Peek kiest ze automatisch op de apparaatnaam.
- Apple-touch-icon vernieuwd en een web-app-manifest toegevoegd (Peek als app op het beginscherm).

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
