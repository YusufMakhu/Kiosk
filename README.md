# 🏪 Klassenkiosk

Eine einfache Kasse für den Schulkiosk – gemacht für Schülerinnen und Schüler
mit Förderbedarf im Bereich Lernen und geistige Entwicklung.

Basiert auf dem [Klassenkiosk von BPS Wuppertal](https://bps-wuppertal.github.io/Kiosk/)
(Herr El Makhoukhi) und wurde für eine intuitive Bedienung überarbeitet.

**Starten:** `index.html` im Browser öffnen (am besten auf einem Tablet im Querformat).
Es wird nichts installiert, alle Daten bleiben auf dem Gerät.

## Verkaufen in 3 Schritten

Oben zeigt eine Schrittleiste immer, wo man gerade ist:

| Schritt | Was der Schüler macht |
|---|---|
| **1 🛒 Aussuchen** | Auf die Produktbilder tippen. Die Zahl zeigt, wie oft. Mit dem roten **−** wieder wegnehmen. Rechts (bzw. unten) steht der Korb mit dem Gesamtpreis. |
| **2 💶 Bezahlen** | Auf die **Münzen und Scheine** tippen, die der Kunde gibt. Die App zeigt „Es fehlen noch …“ oder „✓ Genug Geld!“. Kein Eintippen von Kommazahlen nötig. |
| **3 🪙 Rückgeld** | Die App zeigt das Rückgeld als **Bilder der Münzen/Scheine**. Jedes gegebene Stück antippen → ✓. Dazu der Rechenweg: *bekommen − Preis = Rückgeld*. |

Danach gibt es ein Lob 🎉 und der nächste Kunde ist dran.

## Hilfen für Schüler

- **Vorlesen** (🔊): Produkte, Preise, Anweisungen und Rückgeld werden auf Deutsch vorgelesen.
- **Große Tasten**, klare Farben, gut lesbare Schrift (Atkinson Hyperlegible), einfache Sprache.
- **Echte Größenverhältnisse** der Euro-Münzen – das hilft beim Wiedererkennen in der Kasse.
- **Große Ja/Nein-Fragen** statt kleiner Browser-Dialoge, z. B. „Alles aus dem Korb nehmen?“.
- **Keine Fehlbuchungen**: Ein Verkauf wird erst gespeichert, wenn der Schüler auf „Fertig“ tippt.
- **Lehrerbereich mit PIN** (Standard: `1234`) – Schüler sehen nur den Verkauf.

## Lehrerbereich (🔒 oben rechts)

- **Übersicht**: Einnahmen heute, Verkäufe, Diagramm (7/30 Tage), beliebteste Produkte.
- **Verlauf**: alle Verkäufe mit bekommenem Geld und Rückgeld; falsche Verkäufe löschen.
- **Produkte**: hinzufügen, bearbeiten, Reihenfolge ändern, ausblenden (z. B. ausverkauft), löschen. Preis in Euro eingeben (z. B. `0,50`).
- **Einkauf**: Einkaufsliste zusammenklicken, kopieren oder drucken.
- **Einstellungen**:
  - Vorlesen, Töne, Rückgeld als Bilder, Rechenweg, Preis als Münzen, 1-/2-Cent-Münzen, 50-€-Schein, Lob
  - Bezahlen mit **Geldbildern** oder **Zahlenfeld** (für fortgeschrittene Schüler)
  - Textgröße (A / A+ / A++), Farben (Hell / Dunkel / Kontrast), Vorlese-Tempo
  - PIN ändern oder abschalten
  - Sicherung speichern/laden, Standard-Produkte, Verlauf löschen

Daten aus der alten Version (Produkte, Verlauf, Einkaufsliste) werden automatisch übernommen.

## Dateien

```
index.html               Seite
assets/css/kiosk.css     Aussehen
assets/js/kiosk.js       Logik
assets/images/products/  Produktbilder (verkleinert, zusammen ca. 400 KB)
```
