# Ballerburg

Das Burgen-Artilleriespiel von Eckhard Kruse als Neufassung für den Browser, gebaut mit React und Vite, mit einer Oberfläche im Stil eines Desktops der 1980er Jahre.

## Herkunft und Lizenz

Die **Spiellogik** ist eine Portierung von **Ballerburg** nach JavaScript:

- Ballerburg © 1987, 1989 Eckhard Kruse
- Ballerburg SDL © 2010, 2015 Thomas Huth (https://baller.tuxfamily.org/), veröffentlicht unter der GNU GPL v3

Diese Fassung ist ein davon abgeleitetes Werk und steht deshalb ebenfalls unter der **GNU General Public License, Version 3 oder später** (siehe [LICENSE](LICENSE)). Das heißt: Wer sie weitergibt oder veröffentlicht, muss den Quellcode unter derselben Lizenz zugänglich machen und diese Hinweise erhalten.

Eigene Arbeiten dieser Fassung: Grafik, Burgen, Figuren- und Computernamen, Texte, Oberfläche, Ton sowie die als „Erweiterung“ markierten Spielregeln (zusätzliche Bergformen, nachrutschende Hänge, abstürzende Burgteile). Den Namen „Ballerburg“ und das Spiel nutzen wir mit Erlaubnis von Eckhard Kruse (Mail vom 10.11.2026); er ist als Erfinder des Spiels genannt.

### Änderungen gegenüber dem Original

- Neu geschrieben in JavaScript (2026). Jede portierte Funktion nennt im Code ihr C-Gegenstück (`ein_zug`, `rechnen`, `schuss`, `comp`, `koenig`, `markt`, `bild` …).
- Eigene Burgen im selben Datenprinzip (Breite, Kanonenplätze, Thron, Windfahne, Kammern, Startwerte), aber mit eigenen Formen.
- Eigene Sprite-Grafik und Farben. Treffer werden über die Rechtecke dieser Sprites geprüft statt über die Original-Bildpunkte.
- Erweiterungen (abschaltbar, im Menü „Modus → Optionen“): weitere Bergformen, Erdrutsch, Einsturz.
- Geschütze laufen heiß (von Anfang an eingeschaltet, abschaltbar unter „Modus → Optionen“): Nach dem 1., 2. und 3. Schuss in Folge glüht das Rohr gelb, orange und rot blinkend, im Spielfeld wie in der 3D-Ansicht des Zieldialogs. Der 4. Schuss in Folge sprengt das Geschütz; es muss neu gekauft werden. Eine Runde ohne Schuss kühlt es ganz ab. Der Computer feuert nie mit einem rot glühenden Geschütz.
- Der Räuber (von Anfang an eingeschaltet, abschaltbar unter „Modus → Optionen“): Ab der zweiten Runde schleicht ein vermummter Räuber durchs Tal. Nach jedem Zug läuft er 22 bis 55 Bildpunkte auf die Burg zu, die er sich zufällig ausgesucht hat, und ändert ab und zu seine Meinung. An der Burgmauer stiehlt er 15 bis 30 % des Goldes (höchstens 250 Taler) und zieht sich dann zwei Züge zur Mitte zurück. Eine Kugel, die ihn trifft, bringt dem Schützen die ganze Beute plus 50 Taler. Nach 4 bis 8 Zügen kommt der nächste. Die Figur (vier Laufbilder, `public/sprites/raeuber.png`) wurde mit Higgsfield erzeugt.
- Weitere eigene Regeln: Der klassische Berg wird zufällig 1- bis 1,8-mal so hoch gestreckt. Fördertürme graben sich eine Stufe in den Hang und halten zwei Treffer aus (der erste bricht das Rad). Anbauen setzt 8x4-Steine, die auf Mauer oder Boden fallen, und ist im Testmodus kostenlos (`freeBuilding`).

## Spielprinzip (wie im Original)

- Die linke Burg beginnt. Pro Zug gibt es **einen Schuss**. Wer nicht schießen will, klickt auf **Fertig**.
- **Geschütz anklicken**: Winkel 0–180° (über 90° nach hinten) und Pulver 5–20 einstellen. Die Kugel fliegt mit `0,4 + 0,25 × Pulver` Bildpunkten pro Schritt, die Schwerkraft beträgt 0,02 und der Wind zieht die Kugel mit.
- **Lagerkammer anklicken**: Steuern in Zweierschritten und Markt (Anbauen, Förderturm, Geschütz, Windfahne, Pulver, Kugeln).
- **König anklicken**: eine Audienz, höchstens einmal pro Zug.
- **Einschlag**: Die Kugel bohrt vier kleine Krater. Getroffene Kammern kosten bis zu 200 Gold, das ganze Pulver oder 2 Kugeln, und Einschläge in einer Burg kosten Einwohner. Eine getroffene Kammer explodiert sichtbar: Münzen, Fassdauben oder Kugeln fliegen heraus.
- **Ende**: Der König wird getroffen, das Volk stirbt aus, der König kapituliert in aussichtsloser Lage oder das Rundenlimit ist erreicht.
- Sieben Computerstrategien mit Stärke 1 bis 4. Über „Modus“ lässt sich jederzeit umschalten.

## Burgen und Lager

Wie im Original bestimmt die Größe der Lagerkammern, wie viel eine Burg speichern kann (1 Sack = 150 Gold, 1 Fass = 30 Pulver, 1 Kugel je 6x6-Feld). Die Kammern zeigen ihren Inhalt und werden mit jedem Schuss leerer.

Es gibt 20 Burgen. Sie sind per Turnier ausbalanciert: Jede Burg spielte gegen jede andere auf beiden Seiten, Computer gegen Computer mit gleicher Stärke. Bei 3040 Partien lagen alle zwischen 44 und 58 % Siegquote. Burgen mit vielen Geschützen oder großen Lagern starten dafür mit weniger Gold, Volk oder Pulver.

| Burg | Gold | Pulver | Kugeln | Geschütze | Charakter |
|---|---|---|---|---|---|
| Falkenstein | 900 | 180 | 8 | 3 | ausgewogen, Bergfried mit Geschütz |
| Bollwerk | 450 | 180 | 12 | 4 | breiter Wall, wenig Gold |
| Hochwacht | 600 | 120 | 9 | 2 | Hochturm schießt über jeden Berg |
| Stufenburg | 300 | 240 | 12 | 5 | Terrassen, Turm mit Geschütz |
| Zwillingsburg | 600 | 120 | 8 | 3 | zwei Spitztürme |
| Schatzburg | 1500 | 180 | 6 | 2 | reich, wenige Geschütze |
| Kanonenfeste | 900 | 180 | 16 | 7 | langer Wall voller Geschütze |
| Kolossburg | 1800 | 240 | 21 | 8 | das Maximum an Geschützen und Lager |
| Felsennest | 900 | 120 | 12 | 4 | mächtiger Wohnturm |
| Speicherburg | 2700 | 450 | 20 | 2 | riesiges Lagerhaus |
| Bastei | 900 | 180 | 16 | 6 | flach und breit |
| Abtei | 900 | 180 | 12 | 2 | viel Volk, Glockenturm |
| Pulverturm | 600 | 720 | 8 | 3 | Turm voller Pulver |
| Gießerei | 900 | 180 | 36 | 5 | riesiges Kugellager |
| Grenzfort | 600 | 120 | 10 | 4 | klein und wehrhaft |
| Adlerhorst | 900 | 180 | 6 | 3 | schlanker Turm, 120 hoch |
| Ringburg | 900 | 120 | 14 | 7 | vier Türme rundum |
| Zitadelle | 900 | 180 | 8 | 5 | Bastionen zum Berg hin |
| Turmstadt | 900 | 180 | 12 | 5 | drei Türme verschiedener Höhe |
| Doppelwall | 900 | 180 | 16 | 4 | Vormauer hinter einem Graben |

## Grafik und Tageszeiten

- Alle Räume (Kammern, Thronhalle) haben eine Rückwand aus dunklerem Mauerwerk mit Holzboden und Fackellicht, die Pulverkammer ein rötliches Warnlicht.
- Vier Tageszeiten: Morgen, Tag, Abend, Nacht oder Zufall je Partie. Umschalten im Menü „Modus“ oder unter „Optionen“; Himmel, Sonne oder Mond, Wolken oder Sterne und das Licht auf den Burgen ändern sich.

## 3D-Geschütz

Der Zieldialog zeigt das Geschütz als 3D-Modell (three.js, wird erst beim Öffnen nachgeladen). Das Rohr folgt dem Winkel, das Pulverfass wächst mit der Ladung. Ohne WebGL erscheint eine 2D-Zeichnung.

Das Geschütz ist eine Piratenkanone: ein gusseisernes Rohr auf einer hölzernen Schiffslafette. Beide Teile wurden mit Higgsfield (Meshy, Bild zu 3D) erzeugt und liegen als GLB in `public/models/`, die Texturen sind auf 512 px verkleinert. Rohr und Lafette sind getrennte Modelle, damit sich das Rohr um die Schildzapfen neigen kann. Bis die Modelle geladen sind oder wenn sie fehlen, zeigt der Dialog das einfache Geschütz aus Grundkörpern.

## Lokal starten

```bash
npm install
npm run dev
```

## Veröffentlichen (Vercel)

`vercel.json` ist vorhanden. Wegen der GPL muss der Quellcode öffentlich zugänglich sein, zum Beispiel als öffentliches GitHub-Repository, das auf Vercel importiert wird. Im Spiel verweist „Ballerburg → Über Ballerburg …“ auf Lizenz und Quellcode.

## Aufbau

```
src/game/engine.js     Spiellogik (Portierung, kommentiert mit den Original-Funktionsnamen)
src/game/castles.js    Burgdaten im Datenprinzip von BALLER.DAT, eigene Entwürfe
src/game/terrain.js    Berg nach bild() plus Erweiterungsformen
src/game/render.js     Grafik
src/components/        Menüleiste, Dialoge, Spielfeld
```
