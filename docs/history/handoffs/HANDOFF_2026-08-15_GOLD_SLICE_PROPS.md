# Numberdroid — Übergabe 2026-08-15
## Gold Slice: von akzeptierten Walls/Doors zu Family / Ordinary Props

**Datum:** 2026-08-15  
**Repository:** `KlausUllrich/numberdroid`  
**Status dieses Dokuments:** ausführlicher Task-/Milestone-Snapshot für die nächste Session; **kein Ersatz für aktuelle binding Repository-Contracts**  
**Baseline `main` bei Erstellung:** `e913fe331ebc3028d9c3abe94855d3c4779e7117`  
**Baseline CI:** GitHub Actions Run `31882609726` erfolgreich; Build + Pages Deployment erfolgreich  
**Live Preview:** `https://klausullrich.github.io/numberdroid/?floor=transfer-hall`  
**Primäre empfangende Rolle:** **Artist / Technical Artist**  
**Sekundäre Trigger-Rollen:** Engineering, Game Design, Narrative/World — **nur wenn die unten definierten Trigger eintreten**  
**Nächster Hauptblock:** **TS-01 Family / Ordinary Props**  

---

# 0. Wie diese Übergabe zu benutzen ist

Diese Übergabe ist absichtlich lang und präzise, weil sich Numberdroid inzwischen von einem Prototypen zu einem Repository mit mehreren klaren Domains, Produktionsmethoden, Tooling, Recipes und akzeptierten Art-Baselines entwickelt hat.

Trotzdem gilt:

> **Diese Übergabe ist Task-Kontext, nicht höchste Autorität.**

Der nächste Agent darf nicht einfach nur dieses Dokument lesen und loslegen.

## Pflichtstart der nächsten Session

1. Aktuellen `main`-HEAD über GitHub prüfen.
2. Letzten relevanten GitHub-Actions-Lauf prüfen.
3. `AGENTS.md` vollständig lesen.
4. `REPOSITORY_STRUCTURE.md` vollständig lesen.
5. `docs/agents/ROLE_ENTRYPOINTS.md` vollständig lesen.
6. `docs/agents/REPOSITORY_WORKFLOW.md` vollständig lesen.
7. `docs/README.md` als aktuellen Dokumentationsindex lesen.
8. Danach den unten definierten **Artist/Props-Lesepfad** lesen.
9. Tatsächlichen aktuellen Code/Map/Runtime-Asset-Kontext inspizieren.
10. Erst dann diese Übergabe als Milestone-/Entscheidungskontext verwenden.

Wenn aktuelle binding Files oder aktueller Code diesem Handoff widersprechen, gewinnt die **neuere aktuelle Repository-Quelle**. Konflikt offen benennen; nicht stillschweigend raten.

---

# 1. Warum wir genau jetzt übergeben

Der Übergabezeitpunkt ist bewusst gewählt. Ein großer zusammenhängender Produktionsabschnitt ist abgeschlossen:

- Repository-Informationsarchitektur wurde bereinigt.
- `AGENTS.md` / Dokumentstruktur wurden stabilisiert.
- Art-Produktion wurde in **Methoden**, **Tools** und **Recipes** getrennt.
- Ein wiederverwendbares **Art Production Toolkit** wurde etabliert.
- M4 Procedural 2D Compositor wurde nicht nur theoretisch, sondern in zwei unterschiedlichen Produktionskategorien live bewiesen.
- PICO ist akzeptiert.
- Floor ist akzeptierter Baseline-Stand.
- Walls sind LIVE_ACCEPTED.
- Doors sind LIVE_ACCEPTED.
- Die letzten Door-Probleme — Überzeichnen der Wand, Geschwindigkeit, Soft Close, Status-Text, Key-Variante — sind gelöst und akzeptiert.

Der nächste Block, **Family / Ordinary Props**, ist qualitativ ein anderer Problemtyp. Er wird voraussichtlich stärker von **M1 Direct Generative Source**, sauberer Alpha-/Freistell-Pipeline, Crop/Scale/Packing und Map-Context-QA geprägt sein als von der bisherigen wall-/door-lastigen M4-Arbeit.

Genau deshalb ist ein frischer Artist-/Technical-Artist-Kontext jetzt sinnvoll.

---

# 2. Rollenmodell ab dieser Übergabe

Das Repository führt ab diesem Milestone einen role-aware Einstieg ein.

## Grundprinzip

```text
UNIVERSAL BOOTSTRAP
→ PRIMARY ROLE BUNDLE
→ ACTUAL CODE / RECIPE / RUNTIME CONTEXT
→ HANDOFF TASK SNAPSHOT
→ ADDITIONAL DOMAIN ONLY WHEN A TRIGGER FIRES
```

Der nächste Agent ist primär **Artist / Technical Artist**.

Er soll **nicht** automatisch die komplette Story, alle 25 Campaign Beats, sämtliche Learning-Profile und alle Duel-Regeln laden.

Das würde Kontext verbrauchen und alte/irrelevante Details gegen die konkrete Prop-Aufgabe konkurrieren lassen.

## Aber: kein isolierter Tunnelblick

Sobald der Artist eine Entscheidung trifft, die eine andere Domain besitzt, wird der entsprechende Trigger aktiviert.

Beispiele:

- „Wir machen einen generischen, leicht schief stehenden Stoffbeutel.“ → **kein Story-Trigger nötig**.
- „Auf der Kinderzeichnung sieht man, wie der Vater beim letzten gemeinsamen Ausflug X tut.“ → **Story-Trigger zwingend**.
- „Diese Tasse kann aufgenommen werden und gibt Meta-Energie.“ → **Game-Design + Engineering Trigger**.
- „Wir ändern für den Tisch die Kollisionsgeometrie.“ → **Engineering + ggf. Game Design Trigger**.
- „Wir brauchen ein generisches Background-Removal-Tool für alle Props.“ → **Technical Artist / Toolkit Trigger**.

Siehe binding Router:

`docs/agents/ROLE_ENTRYPOINTS.md`

---

# 3. Artist / Props — verpflichtender Lesepfad

Nach dem Universal Bootstrap soll der nächste Agent für den Props-Block mindestens diese Files vollständig lesen:

## Cross-method Artist-Regeln

1. `docs/art/production/ARTIST_AGENT_WORKFLOW.md`
2. `docs/art/production/ART_ASSET_VALIDATION_RULES.md`
3. `docs/art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`

## Art Direction / Transfer Hall

4. `docs/art/direction/ART_DIRECTION_TRANSFER_SHIP.md`
5. `docs/art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
6. `docs/art/transfer-hall/TRANSFER_HALL_LAYER_RULES.md`
7. `art-source/recipes/transfer-hall/INDEX.md`
8. `art-source/recipes/transfer-hall/family-props/recipe.md`

Wichtig: ältere „was als Nächstes kommt“-Abschnitte innerhalb großer Art-Dokumente können aus ihrer Entstehungszeit stammen. **Aktueller Category-Status kommt aus dem Recipe-Index, dem aktuellen Development Plan und den jeweiligen LIVE_ACCEPTED Recipes/Contracts.**

## Methoden

9. `docs/art-production-methods/README.md`
10. `docs/art-production-methods/METHOD_SELECTION_GATE.md`
11. mindestens `docs/art-production-methods/01-direct-generative-source/README.md`

Weitere Methoden nur dann vollständig, wenn der Method-Gate sie tatsächlich benötigt:

- M2 bei deterministic silhouette + material edit;
- M3 bei kontrolliertem Layer-/Retouch-Bedarf;
- M4 bei echter deterministischer Objektgeometrie/Topologie.

## Toolkit

12. `docs/art-production-toolkit/README.md`
13. `docs/art-production-toolkit/CAPABILITY_INDEX.md`
14. `docs/art-production-toolkit/tools/freistellen.md`
15. `docs/art-production-toolkit/tools/qa-validation.md`

Wenn neues Toolkit-Code geschrieben wird, zusätzlich `scripts/art/toolkit/` komplett in den relevanten Modulen inspizieren.

## Tatsächlicher Runtime-Kontext

16. `src/game/maps/transferHall.ts`
17. tatsächliche Runtime-Verwendung von `public/assets/deck/transfer-hall-props.png`
18. Layer-/Tile-Renderer soweit für Integration nötig
19. bestehende Tests, die Transfer-Hall Layer/Map/GIDs absichern

---

# 4. Was der Props-Artist zunächst NICHT vollständig lesen muss

Nicht automatisch erforderlich:

- die komplette 25-Beat Campaign Story;
- alle Learning Profiles;
- sämtliche Hub/Menu-Systeme;
- alle Duel-Mathematik-Regeln;
- alte Handoffs;
- alte Art-Pipeline-Experimente;
- alle M2/M3/M4 Research-Ordner;
- alle anderen Levels B2/C3;
- alle Robot-Body-Dokumente.

Diese Bereiche werden über Trigger aktiviert.

---

# 5. STORY-Trigger für Props

## Kein Story-Trigger nötig für

- generischen Tisch / Waiting Module;
- generische Tassen;
- leicht asymmetrischen Beutel;
- Pflanze;
- neutrales persönliches Stoff-/Keramik-/Plastikobjekt;
- abstrakte, nicht kanonisch lesbare Kinderzeichnung;
- generische persönliche Farb-/Abnutzungsspuren.

Der aktuelle Art-Direction-Contract liefert dafür bereits die relevante narrative Funktion:

> PRIMUS gibt allem einen Platz; Familienleben hinterlässt bedeutungsvolle Spuren, die keinen optimierten Zweck brauchen.

## STORY-Trigger zwingend bei

- konkretem Inhalt einer Kinderzeichnung;
- benanntem Keepsake;
- Objekt, das Mutter/Vater/Kind explizit gehört;
- sichtbarer Botschaft/Text/Foto;
- Darstellung eines vergangenen kanonischen Ereignisses;
- Prop, das den emotionalen Ablauf des Transfer-Beats verändert;
- neuer visueller Aussage über PRIMUS/Kayo/Eltern, die über die bestehende Art Direction hinausgeht.

Dann zuerst mindestens lesen:

`docs/story/STORY_WORLD_FOUNDATION.md`

Bei Beat-/Reihenfolgebezug zusätzlich:

`docs/story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md`

Nicht erst nach der Bildgenerierung feststellen, dass das Modell Story-Kanon erfunden hat.

---

# 6. GAME-DESIGN-Trigger für Props

Game Design wird erforderlich, sobald ein Objekt nicht nur visuelle Umweltgeschichte ist.

Trigger:

- Pickup;
- Ressourcengeber;
- Interaktion;
- Deck-Action;
- Scan-Objekt;
- Key/Access-System;
- taktische Deckung/blockierende Funktion;
- bewusste Traversal-/Puzzle-Funktion;
- Objekt verändert Objective/Progression;
- visuelles Signal muss einen neuen Gameplay-State ausdrücken.

Dann die relevanten Game-Design-Files plus die passenden durable rules lesen.

Für den ersten Family-Props-Pass ist **keine neue Gameplay-Funktion vorgesehen**.

Die Props sollen zunächst visuell/storyweltlich funktionieren und bestehende Collision/Layer-Verträge respektieren.

---

# 7. ENGINEERING-Trigger für Props

Engineering wird erforderlich, wenn eine der folgenden Maßnahmen geplant ist:

- Änderung von `src/`;
- Änderung von GID-Reihenfolge;
- Änderung der Transfer-Hall-Map-Platzierung;
- Änderung von Layer Ownership;
- Änderung von Collision Rects;
- Änderung von Runtime Asset Paths;
- neue Materialization-/Packing-Scripts;
- neuer generischer Toolkit-Code;
- neues Rendering-Verhalten;
- neue Runtime-Animation;
- Atlas-Dimension/Spaltenzahl wird geändert;
- bestehende GIDs werden umgeordnet.

Dann vor der Entscheidung mindestens lesen:

- `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
- relevante `docs/architecture/` Files
- tatsächlichen aktuellen Code/Test-Kontext

Für Props gilt besonders:

> **Map/Game Logic nicht ändern, nur um ungeeignetes Art zu retten.**

---

# 8. Repository-/Transport-Regel — hart

Remote GitHub-Arbeit erfolgt über den verbundenen GitHub-Connector.

Nicht als Fallback verwenden:

- `git clone` im Container;
- `git fetch/pull` im Container;
- `curl`/`wget` gegen GitHub;
- Container-Network-Tests zur Entscheidung, ob GitHub verfügbar ist.

Lokaler Container/Python darf für **offline Verarbeitung, Analyse oder deterministische Asset-Berechnung** verwendet werden.

Repository Read/Write/PR/Actions bleibt GitHub-Connector-Arbeit.

Diese Regel ist binding in:

`docs/agents/REPOSITORY_WORKFLOW.md`

---

# 9. Aktueller Repository-Stand bei Übergabe

Baseline vor dem Handoff-Dokumentations-PR:

```text
main = e913fe331ebc3028d9c3abe94855d3c4779e7117
```

Dieser Commit ist der Merge von PR #40 „Document live acceptance of TS-01 Doors“.

GitHub Actions:

```text
Run: 31882609726
Build: success
Tests: success
Art Toolkit self-test: success
Pages artifact: success
Deploy Pages: success
```

Der nächste Agent muss trotzdem den **neuen aktuellen main-HEAD** prüfen, weil diese Übergabe selbst danach gemerged wird.

---

# 10. Wichtige jüngere Repository-Milestones

Nicht alle PR-Nummern müssen auswendig gelernt werden; diese Liste erklärt nur, wie der aktuelle Zustand entstand.

## Repository / Produktionssystem

- **#32** — Repository-Struktur neu geordnet; Root/Docs/History/Methods sauberer getrennt.
- **#33** — Wall-Acceptance in neue Struktur übertragen.
- **#34** — Art Production Toolkit eingeführt.
- **#35** — technische Art-Source-Altlasten bereinigt; PICO-Source recipe-local; alte Wall-Transportwege entfernt.

## Walls / Doors

- **#30** — produktiver procedural Wall compositor; live breakthrough.
- **#40** und vorherige Acceptance-Doku — aktueller akzeptierter Wall-/Door-Stand ist inzwischen in Recipes/Method-Doku kanonisch.
- **#36** — erster M4/Toolkit Door-Gold-Pass.
- **#37** — Door QA: dunkler, langsamer, Status-Text weg, Key-Variante.
- **#38** — exaktes Aperture-Clipping; Türblätter verschwinden geometrisch in Wandtaschen.
- **#39** — 650-ms Soft Close ohne Overshoot.
- **#40** — Doors LIVE_ACCEPTED/frozen dokumentiert.

Wichtiger als PR-Historie sind die heutigen binding Files.

---

# 11. Gold-Slice Status — akzeptiert/frozen

## PICO — LIVE_ACCEPTED

- acht authored directions;
- horizontales Directional Sheet;
- accepted source recipe-local;
- Player presentation wird semantisch grün gelesen;
- Charaktere sind die bewusste Perspektiv-Ausnahme: front/profile/back/diagonal Views statt rein top-down Objektansicht.

Nicht neu designen, nur weil Props daneben neu werden.

## Floor — ACCEPTED BASELINE

- 64×64 Runtime Tile;
- warm off-white/ceramic civilian surface;
- Boden bleibt ruhig und darf nicht durch Prop-Assets „mitkopiert“ werden.

Nicht erneut einen Floor-Art-Pass starten.

## Walls / Architecture — LIVE_ACCEPTED

Aktueller Vertrag:

```text
runtime tile       64×64
visible wall fascia 30 px
collision core      10 px
semantic active tiles 13
reserved transparent cells 3
```

M4 Procedural 2D Compositor.

Ergebnis der etablierten semantic seam QA:

```text
semantic connector edges: 26
SAME-TYPE mean diff:       0.000
DIFF-TYPE mean diff:      80.213
ratio:                    infinity
```

Wandmasse wurde live akzeptiert als:

- passend;
- homogen;
- weniger wichtig/fokal als vorher;
- ohne sichtbare Struktur-/Connectorfehler.

**Freeze:** Props dürfen nicht zum Anlass werden, Walls neu zu stylen.

## Doors — LIVE_ACCEPTED

Aktueller Vertrag:

```text
Transfer-Hall door object: 64 × 128 px
moving leaf thickness:      5 px
opening:                     520 ms
closing:                     650 ms soft close
wall fascia:                 30 px
wall collision core:         10 px
```

Weitere akzeptierte Punkte:

- Door Leaf ist dunkler als Wall und als eigenes Mechanikelement lesbar.
- Moving leaves werden auf exakte Door-Aperture geclippt.
- Sie verschwinden vollständig beim Einfahren in die Wand.
- Keine langen Guide Rails.
- Keine sichtbaren Texte `ZUTEILUNG`, `OPEN/OFFEN` an der TS-01 Door.
- Keyed door: neutrales Graphite + schmaler semantischer Farbmarker.
- aktuelle unterstützte semantische Key-Farben umfassen Blue/Red/Green/Amber-Yellow-Command/Violet-Purple.
- kein pauschales „gesperrt = ganze Tür rot“.

**Freeze:** nicht aus Props-Gründen anfassen.

---

# 12. Warum M4 jetzt als echte Methode gilt

M4 ist nicht mehr „der Wall-Hack“.

Wir haben zwei unterschiedliche Produktionsbeweise:

1. **Walls** — modulare statische Topologie/Connectoren/materialisierte Geometrie.
2. **Doors** — feste Geometrie + generisches Toolkit + Runtime-Motion + explizite Clipping-Topologie.

Der wichtige wiederverwendbare Gedanke:

```text
GEOMETRY / TOPOLOGY / VISIBILITY
= deterministic authority

MATERIAL / VISUAL SURFACE
= independent visual authority

RUNTIME STATE / MOTION
= separate runtime authority
```

Für Props ist M4 **nicht automatisch** die richtige Wahl. Gerade das ist der nächste Test unserer Methodenarchitektur: nicht jede erfolgreiche Methode wird überall angewandt.

---

# 13. Art Production Toolkit — aktueller Stand

Canonical docs:

- `docs/art-production-toolkit/README.md`
- `docs/art-production-toolkit/CAPABILITY_INDEX.md`

Runnable code:

`scripts/art/toolkit/`

## PROVEN

Aktuell als wiederverwendbar/proven dokumentiert:

- Binary geometry masks;
- exposed-vs-connector edge classification;
- interior distance field;
- masked material compositor;
- semantic connector canonicalization;
- connector seam metric;
- exact RGBA PNG encoding.

## PLANNED — nicht so tun, als gäbe es diese Tools schon

- Alpha/background removal / **Freistellen**;
- seamless/periodic texture construction;
- seamless validation;
- generic atlas packing/frame extraction;
- generic downscale/resample normalization;
- alpha halo/stray-pixel QA;
- palette/semantic-color QA.

Die Props sind ein sehr guter Kandidat, **Freistellen erstmals produktiv zu beweisen** — aber nur, wenn der Source-Workflow tatsächlich ein generisches Tool braucht.

Nicht „Tool bauen, weil es auf der Roadmap steht“.

---

# 14. Die wichtige Tool-/Methoden-Trennung

```text
METHOD
= wann/warum + welche Stufe besitzt welche Autorität

TOOL
= wiederverwendbare konkrete Operation

RECIPE
= asset-spezifischer Herstellungsvertrag
```

Beispiele:

- M1 kann ein Prop visuell erfinden.
- Freistellen kann anschließend als Tool Alpha herstellen/aufräumen.
- Packing kann später als Tool exakte Runtime-Zellen erzeugen.
- Recipe legt fest, welches Objekt, welche Größe, welche GID, welcher Crop, welches QA gilt.

Kein neues „M5 Background Removal“, nur weil Freistellen implementiert wird.

---

# 15. Externe/Claude-/ComfyUI-Learnings, die erhalten bleiben

Die frühere externe Claude-/lokale ComfyUI-Evaluation wurde bewusst in Research-Doku überführt.

Relevant weiter:

- Geometrie und Material nicht blind in dieselbe Generationsautorität legen.
- Semantic Connector Canonicalization ist als deterministic post-process wertvoll.
- Match-Metriken brauchen bei modularen Seams eine Negative Control.
- getesteter IP-Adapter-Style-Transfer übertrug auch Layout und brach Struktur.
- getesteter lokaler Qwen-Image-Edit-Pfad ignorierte den Edit Target.
- ein flacher Guide als gleichzeitig Structure- und Img2img-Quelle blieb zu flach.

Diese negativen Ergebnisse sind **kein ewiges Verbot** neuer Modelle, aber nicht ohne materiell neuen Ansatz wiederholen.

Für Props ist vor allem relevant:

> Generatives Modell darf die expressive Form besitzen, wenn keine exakte modulare Geometrie verlangt wird. Produktion/Alpha/Packing/QA bleiben trotzdem separate kontrollierte Schritte.

---

# 16. Image-Generation-Regeln — extrem wichtig

## Ein Produktionspass = ein Generate-Call

Wenn ChatGPT Image Generation verwendet wird:

1. exakt sagen, **welches eine Asset / welcher eine Micro-Set-Source** jetzt erzeugt wird;
2. ein Generate/Edit Call;
3. danach Stop;
4. nächster User-Turn = QA/Entscheidung.

Keine stillen Retry-Loops.

## QA ist hard NO-GENERATION

Wenn der User sagt:

- QA;
- prüfen;
- check;
- „wie sieht das aus?“;
- „kontrolliere das Bild“;

wird **kein neues Bild erzeugt**.

Bestehendes Bild prüfen, PASS/FAIL mit konkreten Gründen, Stop.

## Keine Moodboards als Produktionsasset

Für Props besonders gefährlich:

Der Generator darf nicht aus „Family Props“ automatisch eine Design-Präsentation mit 12 Gegenständen, Labels, Palette, Raumhintergrund und hübschem Board machen.

Produktionsprompt muss sagen, was sichtbar sein soll — nicht die Task Card in Pixel verwandeln.

## Keine ganze Kategorie in einem ungeprüften Pass

Nicht gleichzeitig:

- Tisch;
- Transfer cradle;
- PRIMUS console;
- Kayo platform;
- Robot lineup;
- plant;
- cups;
- door;

in ein einziges „Asset Sheet“ kippen.

Props: ein Objekt oder **ein bewusst definierter Micro-Set**.

---

# 17. Transfer-Ship Art Direction — für Props relevanter Kern

Die Welt ist **civilian machine society**, keine Warship.

## Gesamtlook

- hell/warm-off-white ceramic;
- dark graphite/mineral structural recesses;
- restrained teal/cyan semantic system signal;
- warm amber Core/Transfer focus;
- clean, maintained, desirable;
- große ruhige Flächen;
- sichtbare Funktion statt random sci-fi noise.

Vermeiden:

- dark-metal + cyan-neon als generische Hauptsprache;
- Hazard Stripes überall;
- random exposed pipes;
- ubiquitous hexagons;
- arbiträre 45° Panel-Orgie;
- übermäßig viele vents/bolts;
- militärischer Warship-Look.

## Family / biological trace

Kontrast ist **nicht Holz/Natur gegen Technik**.

Family presence entsteht durch Dinge, die keinen optimierten Zweck brauchen:

- leicht falsch abgestellter Beutel;
- Stoff;
- Kinderzeichnung;
- repariertes/personalisiertes Objekt;
- ungleiche Trinkgefäße;
- Keepsake;
- kleine Asymmetrie;
- lokale persönliche Farbakzente.

Ziel:

> Menschlich/persönlich, aber weiterhin plausibel in dieser hochentwickelten Maschinenwelt.

Nicht rustikal. Nicht „Wohnzimmer auf Raumschiff“. Nicht visuell laut.

---

# 18. Environment-Perspektive — binding

Environment:

- strict orthographic top-down;
- keine perspektivischen Seitenansichten;
- keine fake-isometric extrusions;
- keine sichtbaren vertikalen Möbel-Seiten, die nur aus einer Blickrichtung funktionieren;
- Kontakt-Schatten nur klein/lokal unter dem Prop.

Character sprites sind die Ausnahme. Family Props sind **keine Charaktere**.

---

# 19. Layer-Vertrag für Props

Transfer Hall Layer Order:

```text
Ground
FloorFX
Architecture
WallProps
FloorProps
Characters
LightOverlay
UI / Overlay FX
```

## WallProps

- upper-wall-mounted equipment / displays;
- transparent background;
- darf als Wandobjekt passend in den Raum überlappen;
- nicht in Architecture verschieben, solange es kein strukturelles Bauteil ist.

## FloorProps

- freistehende Objekte;
- transparent background;
- kein baked floor;
- lokaler Contact Shadow nur bewusst.

## FloorFX

Nur floor-projected non-light effect/mark/shadow, wenn bewusst separat modelliert.

## LightOverlay

Raumlicht wird nicht in Prop-Pixel gebacken.

---

# 20. Aktuelle Transfer-Hall-Map — exakter Prop-Kontext

Canonical Map:

`src/game/maps/transferHall.ts`

Runtime Tile:

```text
TILE = 64
map = 20 columns × 12 rows
```

Prop tileset:

```text
firstgid = 129
asset    = /assets/deck/transfer-hall-props.png
tile     = 64×64
columns  = 4
tilecount= 32
```

Wichtig:

> Bestehende GIDs nicht still umordnen.

---

# 21. Aktuelle Prop-GID-Verwendung in TS-01

## WallProps

```text
block at col 3,row 1:  GIDs 129,130  (2×1)
block at col14,row 1:  GIDs 131,132  (2×1)
block at col16,row 1:  GIDs 133,134  (2×1)
```

Aus aktuellem Map-/Collision-Kontext ist der erste Block der **Family Display / personal wall trace**-Bereich.

Die späteren Blöcke gehören zur Machine/PRIMUS/Body-Slot-Seite und sind **nicht** der erste Family-Props-Micro-Set.

## FloorProps

```text
col 2,row 4: GIDs 135–140, 3×2 block
col 8,row 4: GIDs 141–149, 3×3 block
col 9,row 7: GIDs 150–153, 2×2 block
col14,row 6: GIDs 154–157, 2×2 block
```

Der erste 3×2-Block ist der **Family Table / waiting/personal setpiece**-Bereich.

Die späteren Blocks gehören Transfer/hero/machine-side Funktionen und sind nicht automatisch ordinary props.

## Family FloorFX

Parallel liegt im Family-Bereich:

```text
col2,row4: FloorFX GIDs 106–111, 3×2
```

Wichtig:

> Das neue Family Prop darf nicht diese FloorFX-/Floor-Information in sein eigenes PNG backen.

---

# 22. Aktuelle Collision-Footprints im Family-Bereich

Aus `src/game/maps/transferHall.ts`:

## Family table solid

```text
x = 2.52 tiles
y = 4.58 tiles
w = 1.96 tiles
h = 0.82 tiles
```

Das ist **nicht** identisch mit dem vollständigen 3×2 visuellen Atlas-Footprint.

Daraus folgt:

> Visual footprint und Collision footprint sind absichtlich getrennt.

Der Artist darf nicht automatisch aus allen sichtbaren Pixeln einen vollen 3×2 Blocker machen.

## Family display protrusion

```text
x = 3.25 tiles
y = 1.08 tiles
w = 1.50 tiles
h = 0.56 tiles
```

Auch hier: visueller WallProps-Block 2×1 vs. bewusster kleiner Collision/Protrusion-Footprint.

Collision nicht „korrigieren“, nur weil neue Art anders aussieht. Erst Design-/Engineering-Trigger aktivieren, falls Art und bestehender Footprint wirklich unvereinbar sind.

---

# 23. Placeholder ist NICHT Geometry Authority

`public/assets/deck/transfer-hall-props.png` ist aktueller Runtime-Placeholder/Bestand.

Der nächste Agent muss ihn **inspizieren**, weil GID-/Mapping-/Layout-Kontext wichtig ist.

Aber:

> Placeholder-Silhouette ist nicht automatisch die Soll-Geometrie für neue Props.

Das Family-Props Recipe sagt ausdrücklich, den Placeholder nicht als authoritative source geometry zu verwenden.

Zulässig:

- Runtime footprint/GID-Verwendung aus Map übernehmen;
- Funktion/Staging erkennen;
- bestehende Collision respektieren;
- neue bessere Form entwerfen.

Nicht zulässig:

- „Pixel nachzeichnen, weil sie schon da sind“ ohne Art-Direction-Grund.

---

# 24. Empfohlener erster Props-Produktionsblock

Nicht sofort alle 29 verbleibenden Prop-Zellen ersetzen.

Empfehlung:

## Micro-Set A — Family Table / Waiting Module

Zunächst tatsächliche Map/Placeholder/live room inspizieren und dann einen **kleinen zusammenhängenden Family-Micro-Set-Vorschlag** machen.

Sehr wahrscheinlicher Scope:

- 3×2 Family Table / Waiting Module als räumliche Basis;
- 1–3 persönliche, klar lesbare Spuren darin/auf ihm, z. B. mismatched cups + bag/fabric;
- optional der 2×1 Family Wall Display erst als zweiter Micro-Set, nicht zwingend im gleichen Generate-Call.

Warum zuerst table-side:

- größter sichtbarer Family-Kontrast;
- klarer vorhandener Runtime-Footprint;
- gute Probe für M1 source + Alpha + crop/packing;
- keine Story-Spezifik nötig, solange persönliche Details generisch bleiben;
- guter Live-Scale-Test gegen bereits akzeptierte Floor/Walls/Doors/PICO.

Aber: Der nächste Agent muss nach Live-/Placeholder-Inspection einen konkreten Task Card vorschlagen, bevor generiert wird.

---

# 25. Method-Hypothese für Family Props

Aktuelle beste Hypothese:

```text
Primary source:        M1 Direct Generative Source
Geometry authority:   model/artist for exposed prop silhouette
Placement authority:  deterministic runtime footprint / crop envelope
Alpha authority:      true source alpha OR explicit extraction/cleanup step
Packing authority:    deterministic
Runtime GID order:    existing map/recipe contract
QA:                   deterministic + visual + live
```

Warum M1:

- Family Props leben von kleinen Form-/Material-/Persönlichkeitsunterschieden;
- exakte modulare Connector-Topologie ist nicht das Problem;
- vollständige Silhouette ist sichtbar;
- generative Form-Erfindung ist hier eher Stärke als Risiko.

Warum nicht blind M4:

- M4 ist stark, wenn Geometrie/Topologie deterministisch besitzen soll;
- eine Tasse, Stofftasche oder Pflanze gewinnt nicht dadurch, dass wir ihre attraktive Silhouette in SVG vorkonstruieren;
- kein Methoden-Cargo-Cult.

Warum trotzdem deterministic processing:

- Runtime footprint;
- exact crop;
- alpha cleanup;
- downscale;
- atlas/GID packing;
- stray pixel/halo QA;
- reproducibility.

Method Gate muss vor Generation dokumentiert werden.

---

# 26. Family-Props Recipe wurde bewusst method-neutralisiert

Das aktuelle Recipe wurde vor dieser Übergabe angepasst.

Wichtiger Punkt:

Früher stand sinngemäß „für jedes Prop exact geometry.svg vor Generation“. Das passt nicht universell zu M1.

Jetzt gilt:

- deterministic footprint/placement guide ist erlaubt;
- visual silhouette kann Model-/Artist-authoritative sein;
- `geometry.svg` nur, wenn die gewählte Methode wirklich deterministic geometry braucht;
- kein Fake-SVG nur zum Erfüllen eines Templates.

Das entspricht dem Artist Workflow:

> `PLANNED` ist besser als falsche Autorität.

---

# 27. Freistellen / Alpha — wahrscheinlich wichtigster neuer Toolkit-Test

Canonical planned capability:

`docs/art-production-toolkit/tools/freistellen.md`

Status bei Übergabe:

**PLANNED — kein generisches production implementation.**

## Warum Props der richtige Test sein könnten

Family Props müssen:

- echten transparenten Hintergrund haben;
- kein Floor/Wall plate enthalten;
- dünne Features behalten;
- keinen hellen/dunklen Matte-Halo haben;
- ggf. lokalen Contact Shadow getrennt sauber besitzen;
- nach Downscale funktionieren.

## Aber Tool nicht erzwingen

Wenn Image Generation/Source bereits einen **wirklich sauberen transparenten Source** liefert, ist es eventuell effizienter, zunächst Crop/Scale/Packing zu beweisen und Freistellen erst beim ersten realen Problem zu implementieren.

Wenn Background Removal nötig wird, dann nicht schnell ein asset-spezifisches Wegwerfskript schreiben, sondern prüfen:

> Ist das eine wiederverwendbare Toolkit-Funktion?

Sehr wahrscheinlich ja.

---

# 28. Anforderungen an ein erstes Freistellen-Tool, falls gebaut

Bevor Capability von PLANNED → EXPERIMENTAL/PROVEN gehoben wird, mindestens prüfen:

- dünne Features abgeschnitten?
- Stoff-/Pflanzenränder erhalten?
- matte color halo?
- accidental background/floor retention?
- alpha noise außerhalb intended footprint?
- Contact Shadow getrennt/bewusst?
- Downscale behavior?
- echter Numberdroid production prop als Testfall?

Doku aktualisieren:

- `docs/art-production-toolkit/CAPABILITY_INDEX.md`
- `docs/art-production-toolkit/tools/freistellen.md`
- Code unter `scripts/art/toolkit/` wenn generisch
- Selftest/Regression soweit sinnvoll

Nicht PROVEN nennen nur weil ein Skript einmal läuft.

---

# 29. Transparent Background: Generationsstrategie

Bei M1-Props bevorzugt:

- einzelnes Objekt / bewusstes Micro-Set;
- true transparent background, wenn das Tool zuverlässig liefert;
- kein Floor;
- keine Raumwand;
- kein Presentation Board;
- keine Beschriftung;
- keine Palette daneben;
- kein Rahmen;
- genügend Sicherheitsabstand um Silhouette;
- strikt top-down.

Wenn der Generator trotz Prompt Floor/Backdrop erzeugt:

- QA FAIL;
- konkret benennen;
- nicht sofort still neu generieren;
- entscheiden, ob Prompt/Method oder Freistellen sinnvoller ist.

---

# 30. Contact Shadow Contract

Props dürfen lokalen Contact Shadow besitzen, aber nur wenn:

- klein;
- direkt am Objekt;
- keine globale Lichtquelle vorgaukelt;
- nicht über den vorgesehenen lokalen Envelope hinausläuft;
- nicht das Ground Tile ersetzt;
- nicht zu einer rechteckigen „Floor Plate“ wird.

Bei Alpha-/Freistellprozess muss bewusst entschieden werden:

```text
subject alpha
contact-shadow alpha
background alpha = 0
```

Nicht versehentlich Contact Shadow wegschneiden oder grauen Matte-Saum stehen lassen.

---

# 31. Runtime Packing / Atlas — Vorsicht

Aktuell existiert noch **kein generisches PROVEN atlas packing tool** im Toolkit.

Das Props-Tileset hat:

```text
64×64 cells
4 columns
32 cells
first GID 129
```

Für den ersten Micro-Set ist die risikoärmste Strategie:

- bestehende GID-Zellen 135–140 gezielt ersetzen;
- restliche Tiles unverändert lassen;
- keine GID-Reihenfolge ändern;
- kein „ich baue mal den ganzen Atlas neu“ ohne Not.

Wenn ein generischer Packing-Prozess entsteht, muss er bestehenden GID-Vertrag explizit erhalten.

---

# 32. Prop QA — Source

Vor Integration Source QA:

- nur angeforderter Prop/Micro-Set;
- strict top-down;
- keine Seiten-/Iso-Perspektive;
- keine Labels;
- kein Moodboard;
- kein baked floor/wall;
- Silhouette nicht abgeschnitten;
- Material zur Welt passend;
- Family warmth lokal, nicht kitschig/global;
- keine generischen sci-fi Neon-Ränder;
- keine Story-Kanon-Erfindung;
- plausible Lesbarkeit bei 64px-Zellen / tatsächlichem World Zoom.

FAIL heißt: nicht extrahieren/integrate, nur weil das Source hübsch ist.

---

# 33. Prop QA — Production File

Nach Extraction/Packing:

- exakte Asset-/Atlas-Dimension;
- exakte Zielzellen/GIDs;
- transparente Außenbereiche wirklich alpha 0;
- keine stray pixels;
- kein Matte-Halo;
- kein baked floor;
- keine Pixel bleeding in neighbor cells;
- Contact Shadow bleibt lokal;
- Downscale erhält Objektlesbarkeit;
- keine ungewollte Farbverschiebung;
- nicht versehentlich andere bestehende Prop-Zellen überschrieben.

Wenn Toolkit-Tool verwendet wird: dessen Selftest/Validator ebenfalls laufen lassen.

---

# 34. Prop QA — Map / Live Context

Unbedingt im tatsächlichen TS-01-Raum ansehen.

Fragen:

1. Liest sich das Objekt bei Gameplay Scale?
2. Wirkt Family-Zone persönlicher, ohne den Raum zu überladen?
3. Bleibt Transfer Cradle/CORE der Fokus?
4. Kämpft der Prop mit PICO?
5. Wirkt der Prop wie ein isoliertes Sprite auf einer Kachel oder sitzt er plausibel im Raum?
6. Stimmen WallProps/FloorProps Layer?
7. Wird bestehende Collision visuell plausibel unterstützt?
8. Gibt es Alpha-/Halo-Probleme auf dem warmen hellen Floor?
9. Funktioniert der Look neben den dunklen accepted Walls/Doors?
10. Bleibt die Welt civilian/maintained statt cluttered workshop?

Live acceptance durch Klaus bleibt Gate.

---

# 35. Was NICHT als Props-Fix gemacht werden darf

Nicht ohne expliziten Trigger/Entscheidung:

- Floor neu stylen;
- Walls neu stylen;
- Door animation ändern;
- PICO neu generieren;
- neue Runtime-Architektur;
- neue Map-Layer-Architektur;
- Collision pauschal an die neue Bildbox anpassen;
- Transfer hero asset nebenbei ersetzen;
- PRIMUS console nebenbei ersetzen;
- Utility robots neu designen;
- Story über Eltern erfinden;
- alle 32 Prop-Tiles auf einmal neugenerieren.

---

# 36. Bekannte gute Art-Hierarchie im Raum

Aktuell soll die visuelle Wichtigkeit grob so funktionieren:

```text
Transfer / CORE hero focus
        > PICO / wichtige Characters
        > semantisch wichtige Systeme
        > Family traces / ordinary props
        > Walls / architectural frame
        > Floor baseline
```

Walls wurden gerade deshalb dicker/homogener gemacht, damit sie **substanziell aber weniger fokal** wirken.

Family Props sollen Wärme/Story tragen, aber nicht wie Loot Icons oder „Hero Props“ leuchten.

---

# 37. Semantic Color — Props

Ownership-Farben für Robots bleiben:

- green Player;
- red hostile;
- blue NPC;
- orange Kayo;
- black/charcoal PRIMUS authority.

Family Props sollen diese Ownership-Codierung nicht zufällig nachahmen.

Warm personal accents:

- amber;
- subdued coral/terracotta;
- fabric variation;
- kleine individuelle Farben.

Nicht jede Tasse cyan machen, nur weil Sci-Fi.

---

# 38. Text in Props

Keine unlesbare pseudo-sci-fi Beschriftung nur für Detail.

Wenn ein Prop **echten Text** trägt, ist das schnell:

- Narrative-/World-Frage;
- Localization-/UI-Frage;
- Lesbarkeitsfrage.

Für den ersten Micro-Set bevorzugt **kein semantisch relevanter Text**.

Eine Kinderzeichnung darf bildlich/abstrakt sein, ohne Lore-Text.

---

# 39. Aktueller Family-Niche Kontext

Map Room:

```text
name: family-niche
label: FAMILIENBEREICH
subtitle: PERSÖNLICHE DINGE · KEIN ZUGEWIESENER ZWECK
```

Diese floating room labels sind derzeit Preview-/Debug-Anmerkungen, keine finale diegetische UI.

Props sollen deshalb nicht versuchen, diese erklärende Beschriftung visuell „nachzubauen“.

Die Props selbst sollen den Gegensatz zunehmend **zeigen statt erklären**.

---

# 40. Aktuelle Gold-Slice Reihenfolge nach dieser Übergabe

```text
PICO                  LIVE_ACCEPTED
Floor                 ACCEPTED BASELINE
Walls                 LIVE_ACCEPTED
Doors                 LIVE_ACCEPTED
Family/ordinary props NEXT
Transfer apparatus    AFTER PROPS
PRIMUS object         AFTER / WITH HERO PHASE
Other robots          LATER
```

Nach Family Props nicht automatisch „alle Props im ganzen Spiel“ produzieren.

TS-01 als Gold Slice bleibt der Fokus.

---

# 41. Empfohlener Ablauf der nächsten Session

## Phase A — Verifizieren

- main HEAD;
- Actions;
- Pages;
- Role bundle;
- current recipe/index;
- live TS-01.

Keine Änderungen.

## Phase B — Actual-context inspection

- `transfer-hall-props.png` visuell inspizieren;
- Map GIDs 129–157 zuordnen;
- Family 129–130 + 135–140 identifizieren;
- collision footprints prüfen;
- live Family Zone ansehen.

Keine Generation.

## Phase C — First Micro-Set Proposal

Dem User kurz präsentieren:

```text
CATEGORY
EXACT TARGET GIDs
RUNTIME FOOTPRINT
OBJECTS IN MICRO-SET
METHOD / AUTHORITY SPLIT
ALPHA PLAN
PACKING PLAN
QA PLAN
WHAT WILL NOT CHANGE
```

Empfehlung: Family Table/Waiting Micro-Set zuerst.

## Phase D — Recipe PREPARED/METHOD_SELECTED

Recipe aktualisieren, bevor Production Generate/Edit beginnt.

## Phase E — Source Generation

Ein Call.

Dann Stop.

## Phase F — QA

Nächster User-Turn: bestehendes Bild prüfen.

Kein Generate bei „QA“.

## Phase G — Production Extraction

Nur nach Source PASS.

Alpha/Crop/Scale/Packing deterministisch.

Wenn ein neuer reusable Tool-Bedarf entsteht: Toolkit sauber erweitern.

## Phase H — Integrate

Nur begrenzte Ziel-GIDs ersetzen.

Map-/Collision-/Layer-Verträge erhalten.

## Phase I — CI + Live QA

- Toolkit tests;
- game tests;
- build;
- relevante art validation;
- Pages;
- user visual QA.

## Phase J — Acceptance

Nach User-Akzeptanz:

- recipe LIVE_ACCEPTED oder Micro-Set accepted;
- index/update current plan if category truly complete;
- freeze accepted micro-set;
- nächsten Props-/Hero-Block entscheiden.

---

# 42. Was der nächste Agent in seiner ERSTEN Antwort tun soll

Nach Lesen/Inspection **nicht** direkt generieren.

Erste Antwort an Klaus soll enthalten:

1. kurze Bestätigung des aktuellen accepted Baseline;
2. was die vorhandenen Family-GIDs/Footprints tatsächlich darstellen;
3. vorgeschlagener erster Family-Micro-Set;
4. Method-/Authority-Split;
5. ob Freistellen-Tool im ersten Pass wirklich gebraucht wird oder noch nicht;
6. konkrete Dateien/GIDs, die der erste Pass ändern würde;
7. konkrete Dinge, die nicht angefasst werden.

Dann auf Freigabe für den ersten Production Source Pass warten, sofern Klaus nicht im Startprompt ausdrücklich direkte Produktion autorisiert.

---

# 43. Definition of Done — erster Family-Micro-Set

Ein erster Micro-Set ist erst fertig, wenn:

- Task Card/Recipe sauber;
- Method selected;
- Source intern QA-passed;
- final Runtime Asset/Atlas exakt;
- Alpha sauber;
- keine Floorplate;
- GID order stabil;
- Map layer korrekt;
- Collision nicht unbeabsichtigt geändert;
- Tests/build grün;
- live deployed;
- Klaus visuell akzeptiert;
- Recipe aktualisiert;
- wiederverwendbare Tool-Learnings dokumentiert.

---

# 44. Definition of Done — Family/ordinary Props Kategorie

Nicht bereits nach einer Tasse „Kategorie fertig“ nennen.

Kategorie kann als Gold-Slice accepted gelten, wenn der Family-Bereich mit einer bewusst kleinen, wiederverwendbaren Prop-Sprache funktioniert und die Placeholder-Wirkung im relevanten Family-Bereich beseitigt ist.

Voraussichtlich gehören dazu mindestens:

- Family Table / Waiting Module;
- persönliche Kleinteile (z. B. cups/bag/fabric);
- mindestens ein persönlicher Wall Trace / Display / Drawing/Keepsake-Element, sofern nach Art-Direction-QA sinnvoll;
- konsistente Alpha/Scale/Materialsprache;
- Live-Hierarchie passt.

Exakte Menge ist **Art-Director-Entscheidung**, nicht durch diese Übergabe vorab eingefroren.

---

# 45. Offene Entscheidungen und Owner

## Artist / Art Director

- exakter erster Micro-Set;
- Formensprache der Family Table;
- Anzahl sichtbarer persönlicher Kleinteile;
- wie warm/personal vs. clean das Set liest;
- ob Wall Display direkt im ersten oder zweiten Pass folgt.

Klaus ist der Art Director / Live Acceptance Gate.

## Technical Artist

- ob ein reusable Freistellen-Tool schon im ersten Pass nötig ist;
- wie Crop/Alpha/Packing reproduzierbar umgesetzt wird;
- welche Tool-Capability-Statusänderung gerechtfertigt ist.

## Narrative — nur bei Trigger

- konkreter Inhalt von Drawing/Keepsake;
- spezifische Familienzuordnung/Kanon.

## Game Design — nur bei Trigger

- neue Interaktion/Funktion;
- neue Collision-/Traversal-Funktion, sofern tatsächlich Designänderung.

## Engineering — nur bei Trigger

- Runtime-/Map-/Layer-/Asset-loader changes;
- generisches Build-/Toolkit-Integration.

---

# 46. Bekannte technische Schuld — NICHT nächster Task

Es gibt noch einzelne legacy/source-like Robot-SVGs unter `public/assets/robots/`, deren Reference-Audit beim Repository-Cleanup nicht sicher abgeschlossen werden konnte.

Sie sind **nicht** Teil des Family-Props-Blocks.

Bei späteren Robot-Rebuilds können sie sauber behandelt werden.

Nicht den Props-Pass in ein weiteres Repository-Cleanup verwandeln.

---

# 47. Warum wir alte Handoffs nicht als Startpunkt verwenden

Unter `docs/history/handoffs/` liegen ältere Dateien wie:

- `HANDOFF_2026-08-12.md`;
- `HANDOFF_2026-08-13_GOLD_SLICE.md`;
- `CODEX_HANDOFF.md`;
- `NEXT_AGENT_PROMPT.md`.

Sie enthalten wertvolle historische Entscheidungen, aber auch damalige Status-/Pfadangaben.

Der neue Agent soll sie **nicht** komplett lesen, um „sicherzugehen“.

Nur wenn ein aktueller Contract auf eine historische Begründung verweist oder eine konkrete Frage nicht anders geklärt werden kann.

---

# 48. Wichtige UX-/Kommunikationsregel mit Klaus

Bei Art-Arbeit:

- kurze, konkrete Entscheidungen;
- nicht lange Grundlagen neu debattieren, wenn Contract klar ist;
- vor Generation sagen, was genau generiert wird;
- nach QA konkret PASS/FAIL;
- nicht „still“ mehrere Varianten erzeugen;
- wenn etwas live gut ist, akzeptierten Stand dokumentieren/frieren;
- wenn Klaus einen konkreten Fehler nennt, bounded fix statt neue Stilrunde.

Die Walls/Doors wurden genau dadurch stabil, dass Probleme schrittweise und live geprüft wurden.

---

# 49. Lessons aus Walls/Doors, die für Props methodisch relevant sind

## Nicht relevant übernehmen

Props brauchen keine Semantic Connector Canonicalization nur weil Walls sie brauchten.

Props brauchen nicht zwingend M4.

Props brauchen keine 30px/10px Geometrie-Logik.

## Relevant übernehmen

- Authority Split explizit machen.
- Source ≠ Runtime Asset.
- Produktion reproduzierbar machen.
- QA vor Integration.
- Live acceptance ist eigener Zustand.
- accepted baseline nicht nebenbei destabilisieren.
- wiederverwendbare Operationen in Toolkit statt ad-hoc per Asset, wenn sie wirklich wiederverwendbar sind.

---

# 50. Möglicher Idealpfad für Props

Wenn alles gut läuft:

```text
Family Table Task Card
→ M1 isolated top-down source on transparent bg
→ source QA PASS
→ no generic Freistellen needed (best case)
→ deterministic crop/downscale/pack into GIDs 135–140
→ production alpha QA
→ live map QA
→ acceptance
```

Oder, falls Alpha problematisch:

```text
M1 source with separable background
→ source QA PASS
→ implement minimal reusable Freistellen capability
→ regression/halo QA
→ crop/downscale/pack
→ live QA
→ promote tool status only with evidence
```

Beide Pfade sind zulässig.

---

# 51. Möglicher falscher Pfad — vermeiden

```text
„Family Props“ prompt
→ Generator macht 20-asset mood board mit labels und floor
→ agent extrahiert trotzdem irgendwas
→ baut ganzen prop atlas neu
→ GIDs ändern sich
→ collision wird passend gemacht
→ room sieht anders aus
→ walls/doors werden mit angepasst
```

Das wäre genau das Gegenteil der etablierten Produktionsdisziplin.

---

# 52. Current live reference

Live URL:

`https://klausullrich.github.io/numberdroid/?floor=transfer-hall`

Vor dem ersten Props-Vorschlag unbedingt aufrufen/prüfen.

Der Live-Raum ist die eigentliche Qualitätsreferenz für:

- Scale;
- hierarchy;
- floor contrast;
- wall/door contrast;
- PICO prominence;
- family-zone footprint.

Nicht nur Atlas isoliert beurteilen.

---

# 53. Empfohlener Startprompt für die neue Session

Der folgende Prompt kann nach Merge dieser Übergabe in eine neue Session gegeben werden:

```text
Arbeite am GitHub-Repository KlausUllrich/numberdroid.

main ist kanonisch. Beginne NICHT mit Bildgenerierung oder Codeänderungen.

1. Prüfe aktuellen main-HEAD und den neuesten relevanten GitHub-Actions-/Pages-Status.
2. Lies vollständig:
   - AGENTS.md
   - REPOSITORY_STRUCTURE.md
   - docs/agents/ROLE_ENTRYPOINTS.md
   - docs/agents/REPOSITORY_WORKFLOW.md
   - docs/README.md
3. Folge danach dem Artist/Technical-Artist-Lesepfad aus ROLE_ENTRYPOINTS.md für den nächsten Gold-Slice-Block „Family / Ordinary Props“.
4. Lies anschließend diese Übergabe vollständig:
   - docs/history/handoffs/HANDOFF_2026-08-15_GOLD_SLICE_PROPS.md
5. Inspiziere den tatsächlichen aktuellen Runtime-Kontext, insbesondere:
   - art-source/recipes/transfer-hall/family-props/recipe.md
   - art-source/recipes/transfer-hall/INDEX.md
   - src/game/maps/transferHall.ts
   - public/assets/deck/transfer-hall-props.png
   - Live Preview ?floor=transfer-hall

Fasse danach präzise zusammen:
- was akzeptiert/frozen ist;
- welche Family-Prop-GIDs/Footprints aktuell relevant sind;
- welchen ersten Micro-Set du vorschlägst;
- welchen Method-/Authority-Split du dafür wählst;
- ob im ersten Pass wirklich ein Freistellen-Toolkit-Tool benötigt wird;
- welche Dateien/GIDs du im ersten Block ändern würdest und welche explizit nicht.

Noch keine Bildgenerierung. Erst den ersten bounded Production Block vorschlagen.
```

---

# 54. Übergabe in eine andere Rolle während des Props-Blocks

Wenn der Artist während der Arbeit feststellt, dass ein anderer Role Owner gebraucht wird, nicht die komplette Session wegwerfen.

## Artist → Narrative

Übergabe-Frage klein halten:

- welches konkrete Prop;
- welche sichtbare narrative Aussage offen ist;
- was Art Direction bereits vorgibt;
- welche 2–3 Entscheidungen benötigt werden.

Nach Narrative-Entscheid zurück zum Artist und durable Art-/Recipe-Contract aktualisieren.

## Artist → Game Designer

Nur wenn Funktion/Interaction/Collision als Designfrage offen ist.

Genau angeben:

- aktueller Visual Footprint;
- aktueller Collision Footprint;
- gewünschte Funktion;
- was unverändert bleiben soll.

## Artist → Engineer / Technical Artist

Bei Tool-/Packing-/Alpha-/Renderer-Thema:

- Source/target dimensions;
- exact GIDs;
- alpha contract;
- expected deterministic output;
- regression criteria.

Keine ganze Story mitsenden.

---

# 55. Schlusszustand dieser Übergabe

Der vorherige Produktionsabschnitt ist abgeschlossen.

```text
FOUNDATION       CLOSED / STABLE
REPOSITORY       RESTRUCTURED
ART METHODS      ESTABLISHED
ART TOOLKIT      ESTABLISHED (partial capabilities)
PICO             LIVE_ACCEPTED
FLOOR            ACCEPTED BASELINE
WALLS            LIVE_ACCEPTED
DOORS            LIVE_ACCEPTED
FAMILY PROPS     NEXT / PLANNED
```

Die nächste Session soll nicht beweisen, dass sie alles neu versteht, indem sie Foundations neu baut.

Sie soll auf dem akzeptierten Raum aufbauen und **zum ersten Mal unsere neue role-aware, method-aware, toolkit-aware Produktionsarchitektur auf expressive gewöhnliche Props anwenden**.

Das ist der nächste Lernschritt.
