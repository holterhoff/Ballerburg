# Burgfehde

Ein Artillerie-Duell zweier Burgen im Browser, gebaut mit React und Vite. Zwei Burgen stehen sich links und rechts eines Berges gegenüber. Wer den gegnerischen König trifft oder den Gegner zur Kapitulation zwingt, gewinnt.

Burgfehde ist ein eigenständiges Spiel im Geist der Burgen-Artilleriespiele der 1980er Jahre. Grafik, Burgen, Figuren und Texte sind eigene Entwürfe.

## Spielprinzip

- **Zielen**: Winkel (0–90°) und Pulvermenge (1–30) einstellen. Jede Kanone schießt einmal pro Zug.
- **Wind**: ändert sich jeden Zug und lenkt die Kugel ab. Die genaue Stärke zeigt nur eine intakte Windfahne.
- **Burg**: König, Kanonen, Pulverlager, Kugellager, Geldsäcke. Treffer auf Lager vernichten die Vorräte, Geldsäcke kosten Gold. Was den Halt verliert, stürzt ab.
- **Schatzkammer**: Steuern einstellen (mehr Gold, aber das Volk wandert ab), Steine zum Ausbessern, Kanonen, Pulver, Kugeln, Windfahne und Fördertürme kaufen.
- **Ende**: König getroffen, Volk ausgewandert oder Kapitulation, wenn keine Kanone, Kugel oder Pulver mehr bezahlbar ist.
- **Modi**: Mensch gegen Mensch (abwechselnd am selben Gerät), Mensch gegen Computer oder Computer gegen Computer. Es gibt vier Computergegner in steigender Stärke.

Tastatur: `↑`/`↓` Winkel (`Shift` ±10), `←`/`→` Pulver, `Leertaste` Feuer, `Tab` nächste Kanone, `M` Schatzkammer, `E` Zug beenden, `Esc` Platzieren abbrechen.

## Lokal starten

```bash
npm install
npm run dev
```

Danach http://localhost:5173 öffnen.

## Auf Vercel veröffentlichen

Das Projekt ist ein statischer Vite-Build (`dist/`), `vercel.json` ist bereits vorhanden.

**Variante A – über GitHub (empfohlen):** Repository auf GitHub pushen, auf vercel.com „Add New → Project“ wählen und das Repo importieren. Vercel erkennt Vite automatisch. Jeder Push veröffentlicht dann neu.

**Variante B – per CLI:**

```bash
npx vercel        # einmalig anmelden und Projekt verknüpfen (Vorschau-Deployment)
npx vercel --prod # Produktions-Deployment
```

## Aufbau

```
src/
  game/        Spiel-Engine ohne React: Physik, Wirtschaft, Computergegner, Renderer, Ton
  components/  Spielfeld (Canvas), Startbildschirm, Schatzkammer, Regeln, Ehrentafel
  App.jsx      Spielablauf und Bedienung
```
