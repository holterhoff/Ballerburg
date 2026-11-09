# Burgfehde

Ein Burgen-Artilleriespiel für den Browser, gebaut mit React und Vite, mit einer Oberfläche im Stil eines Desktops der 1980er Jahre.

## Herkunft und Lizenz

Die **Spiellogik** ist eine Portierung von **Ballerburg** nach JavaScript:

- Ballerburg © 1987, 1989 Eckhard Kruse
- Ballerburg SDL © 2010, 2015 Thomas Huth (https://baller.tuxfamily.org/), veröffentlicht unter der GNU GPL v3

Burgfehde ist ein davon abgeleitetes Werk und steht deshalb ebenfalls unter der **GNU General Public License, Version 3 oder später** (siehe [LICENSE](LICENSE)). Das heißt: Wer Burgfehde weitergibt oder veröffentlicht, muss den Quellcode unter derselben Lizenz zugänglich machen und diese Hinweise erhalten.

Eigene Arbeiten von Burgfehde: Grafik, Burgen, Figuren- und Computernamen, Texte, Oberfläche, Ton sowie die als „Erweiterung“ markierten Spielregeln (zusätzliche Bergformen, nachrutschende Hänge, abstürzende Burgteile). Die Original-Burgen, die Musik und der Name „Ballerburg“ werden nicht verwendet.

### Änderungen gegenüber dem Original

- Neu geschrieben in JavaScript (2026). Jede portierte Funktion nennt im Code ihr C-Gegenstück (`ein_zug`, `rechnen`, `schuss`, `comp`, `koenig`, `markt`, `bild` …).
- Eigene Burgen im selben Datenprinzip (Breite, Kanonenplätze, Thron, Windfahne, Kammern, Startwerte), aber mit eigenen Formen.
- Eigene Sprite-Grafik und Farben. Treffer werden über die Rechtecke dieser Sprites geprüft statt über die Original-Bildpunkte.
- Lagerkapazitäten stehen als Zahlenwerte je Burg in den Daten und werden nicht aus der Kammergröße berechnet.
- Erweiterungen (abschaltbar, im Menü „Modus → Optionen“): weitere Bergformen, Erdrutsch, Einsturz.

## Spielprinzip (wie im Original)

- Die linke Burg beginnt. Pro Zug gibt es **einen Schuss**. Wer nicht schießen will, klickt auf **Fertig**.
- **Geschütz anklicken**: Winkel 0–180° (über 90° nach hinten) und Pulver 5–20 einstellen. Die Kugel fliegt mit `0,4 + 0,25 × Pulver` Bildpunkten pro Schritt, die Schwerkraft beträgt 0,02 und der Wind zieht die Kugel mit.
- **Lagerkammer anklicken**: Steuern in Zweierschritten und Markt (Anbauen, Förderturm, Geschütz, Windfahne, Pulver, Kugeln).
- **König anklicken**: eine Audienz, höchstens einmal pro Zug.
- **Einschlag**: Die Kugel bohrt vier kleine Krater. Getroffene Kammern kosten bis zu 200 Gold, das ganze Pulver oder 2 Kugeln, und Einschläge in einer Burg kosten Einwohner.
- **Ende**: Der König wird getroffen, das Volk stirbt aus, der König kapituliert in aussichtsloser Lage oder das Rundenlimit ist erreicht.
- Sieben Computerstrategien mit Stärke 1 bis 4. Über „Modus“ lässt sich jederzeit umschalten.

## Lokal starten

```bash
npm install
npm run dev
```

## Veröffentlichen (Vercel)

`vercel.json` ist vorhanden. Wegen der GPL muss der Quellcode öffentlich zugänglich sein, zum Beispiel als öffentliches GitHub-Repository, das auf Vercel importiert wird. Im Spiel verweist „Burgfehde → Über Burgfehde …“ auf Lizenz und Quellcode.

## Aufbau

```
src/game/engine.js     Spiellogik (Portierung, kommentiert mit den Original-Funktionsnamen)
src/game/castles.js    Burgdaten im Datenprinzip von BALLER.DAT, eigene Entwürfe
src/game/terrain.js    Berg nach bild() plus Erweiterungsformen
src/game/render.js     Grafik
src/components/        Menüleiste, Dialoge, Spielfeld
```
