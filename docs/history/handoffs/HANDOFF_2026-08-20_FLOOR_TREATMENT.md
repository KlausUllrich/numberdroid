# Numberdroid — Übergabe 2026-08-20
## TS-01 Gold Slice: Floor Treatment nach PRIMUS v2 LIVE_ACCEPTED

**Datum:** 2026-08-20  
**Repository:** `KlausUllrich/numberdroid`  
**Status dieses Dokuments:** aktueller Task-/Milestone-Snapshot für die nächste Session; **kein Ersatz für binding Repository-Contracts**  
**Funktionaler Baseline-Merge:** PR #132, `main` = `21577cf37d2f85e0f23a152b1080b48f4504c0d2` bei Beginn dieser Dokumentationsübergabe  
**PR #132 CI:** Build/Test/Browser-QA erfolgreich, Actions Run `32401588262`  
**Live Preview:** `https://klausullrich.github.io/numberdroid/?floor=ts01-generated`  
**Primäre Rolle:** Artist / Technical Artist mit Level-Generation-Kontext  
**Nächster Floor-Block:** **Family Child**, danach **Family Hygiene**, jeweils **ein Raum nach dem anderen**  

---

# 0. Pflichtstart der nächsten Session

Diese Übergabe ist Kontext, nicht höchste Autorität. Der nächste Agent muss vor Änderungen:

1. aktuellen `main`-HEAD prüfen;
2. neuesten relevanten GitHub-Actions-Lauf prüfen;
3. `AGENTS.md` vollständig lesen;
4. `REPOSITORY_STRUCTURE.md` vollständig lesen;
5. `docs/agents/ROLE_ENTRYPOINTS.md` vollständig lesen;
6. `docs/agents/REPOSITORY_WORKFLOW.md` vollständig lesen;
7. `docs/README.md` als aktuellen Dokumentationsindex lesen;
8. danach mindestens diese aktuellen Floor-/Artist-Dokumente vollständig lesen:
   - `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
   - `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`
   - `art-source/recipes/transfer-hall/floor-treatment/recipe.md`
   - `docs/art/production/ARTIST_AGENT_WORKFLOW.md`
   - `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`
   - `docs/art/direction/ART_DIRECTION_TRANSFER_SHIP.md`
   - `docs/art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
   - `docs/art/transfer-hall/TRANSFER_HALL_LAYER_RULES.md`
9. tatsächlichen Code und die Runtime-Assets des betroffenen Raums inspizieren;
10. erst dann diese Übergabe als Milestone-/Entscheidungskontext verwenden.

Wenn ein aktueller binding Contract oder aktueller Code diesem Handoff widerspricht, gewinnt die neuere Repository-Quelle. Konflikt offen benennen; nicht stillschweigend raten.

---

# 1. Warum jetzt übergeben wird

Ein längerer Floor-/Art-Produktionsblock ist an einem sinnvollen Schnittpunkt abgeschlossen.

In dieser Session wurden nacheinander und mit Live-QA stabilisiert:

- PICO 8-direction physical grounding aus der vorherigen Phase;
- Family Living Floor v1;
- Transfer Room Floor + Hero Anchoring v1;
- Main Hall Floor v1;
- semantische Tile-Metadaten / Connector-Logik für Main Hall;
- PRIMUS Floor v2 mit systematischen 2×2-Macro-Surfaces;
- verbindliche Multi-Cell-Fit-Regeln, damit keine halben Makro-Kacheln an Wänden entstehen.

Der letzte Screenshot wurde vom Art Director explizit mit **PASS** bewertet. Damit ist PRIMUS Floor v2 **LIVE_ACCEPTED** und kein offenes Candidate-Artwork mehr.

Der nächste sinnvolle Raum ist **Family Child**. Danach folgt **Family Hygiene**. Beide sollen nicht in einem gemeinsamen Atlas-/Integrationsblock zusammengeworfen werden.

---

# 2. Aktueller Floor-Status

```text
Family Living   LIVE_ACCEPTED v1
Family Child    OPEN / NEXT
Family Hygiene  OPEN / AFTER CHILD
Main Hall       LIVE_ACCEPTED v1
Transfer Room   LIVE_ACCEPTED v1 + Hero anchor
PRIMUS          LIVE_ACCEPTED v2
```

Damit ist B1 Room Identity aktuell **4 / 6 akzeptiert**.

Weitere noch offene Floor-/Environment-Systeme:

```text
B2 wall AO              OPEN
B3 usage/wear FloorFX   OPEN
B4 Transfer anchor      DONE / LIVE_ACCEPTED
B5 Flow floor relation  PARTIAL / OPEN
```

Akzeptierte Floor-Baselines nicht ohne konkreten Live-Defekt wieder öffnen.

---

# 3. PRIMUS Floor v2 — final akzeptierter Zustand

## Raumgeometrie

PRIMUS ist absichtlich auf **10×8 Tiles** festgelegt.

Grund:

```text
room size          10 × 8
calm perimeter      1 tile auf allen vier Seiten
usable macro domain 8 × 6
macro span           2 × 2
macro origin         room + (1,1)
macro count          4 × 3 = 12 vollständige Makros
```

Die Raumverbreiterung von 9 auf 10 Tiles war eine bewusste visuelle/layout-semantische Korrektur. Sie ist nicht als Architektur-Migration zu interpretieren.

Code-Autorität:

- `src/levelgen/specs/ts01.ts`
- `src/levelgen/primusFloorPresentation.ts`
- `src/levelgen/primusFloorTileMetadata.ts`
- `src/levelgen/primusFloorPresentation.test.ts`
- Geometry-/Topology-Regressions in `src/levelgen/geometry.test.ts` und `src/levelgen/topologySolver.test.ts`

## Akzeptiertes visuelles Verhalten

- direkt an allen PRIMUS-Wänden: ruhige graue, linienfreie Perimeter-Tiles;
- im Inneren: ausschließlich vollständige 2×2-Macro-Surfaces;
- keine halben oder geclippten Makros;
- echter West-Threshold nur an der tatsächlichen Hall-Verbindung;
- Service-Approach nur an echten `primus-service-bank`-Approach-Cells;
- keine erfundenen `WORK SLOT`-/Nummerntexte;
- keine zufällige Conduit-/Connector-Topologie;
- Material wirkt kühl, systematisch und kompetent, nicht villain-black;
- offene Mitte bleibt für Roboter/Patrouille lesbar.

---

# 4. Der wichtigste neue Produktionsfehler, der nicht wiederholt werden darf

Der problematische Zwischenstand war technisch scheinbar korrekt, aber visuell falsch:

1. 2×2-Makros wurden am Raumursprung gesetzt.
2. Danach wurde ein 1-Tile-Wandrand darübergelegt.
3. Dadurch blieben an den Wänden optisch halbe Makroplatten übrig.

Das ist nun ausdrücklich verboten.

Binding Contract:

`docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

Allgemeine Regel:

```text
usableW = roomW - leftBand - rightBand
usableH = roomH - topBand - bottomBand
originX = roomX + leftBand
originY = roomY + topBand
```

Für wiederholte Multi-Cell-Surfaces mit Span `mw × mh` muss gelten:

```text
usableW % mw === 0
usableH % mh === 0
```

Wenn nicht:

1. Raumgeometrie bewusst auf einen gültigen Wert ändern;
2. falls fachlich zulässig einen flexiblen strukturellen Rand ändern;
3. oder ein bewusstes echtes Rest-/Terminalelement authoren.

Nicht zulässig:

- Makro unter Wandband legen und teilweise verstecken;
- 2×2 implizit zu 2×1/1×1 clippen;
- CSS/overflow als Layout-Reparatur benutzen;
- zufällige Fragmente in Restspalten/-zeilen einsetzen;
- FloorFX als Geometrie-Flickwerk verwenden.

---

# 5. Main Hall — weitere binding Learnings

Main Hall ist weiterhin der Referenzfall für semantische Route-/Connector-Tiles.

Wichtig:

> **Room Access ist nicht automatisch Route Topology.**

Akzeptiert:

- ein ruhiger longitudinaler Hall-Spine;
- Family/Transfer/PRIMUS-Zugänge sind Thresholds;
- Raumzugänge erzeugen keine künstlichen T-Junctions;
- Terminal-Tiles nur an echten visuellen/topologischen Enden;
- line-bearing Varianten nur austauschen, wenn Continuity-Metadaten die Anschlusskompatibilität garantieren;
- generierte Pixel sind Material-/Appearance-Quelle, nicht Topologie-Autorität.

Referenz:

- `src/levelgen/mainHallFloorTileMetadata.ts`
- `src/levelgen/mainHallFloorVisualPolicy.ts`
- `src/levelgen/mainHallFloorPresentation.ts`
- `src/levelgen/mainHallFloorPresentation.test.ts`
- `scripts/materialize-main-hall-floor.mjs`

---

# 6. Generation vs. M4 vs. Metadata — verbindliche Autoritätstrennung

Die Session hat mehrfach gezeigt, dass diese Trennung zwingend ist:

```text
IMAGE GENERATION
→ Materialästhetik / Oberflächenvorschlag / visuelle Sprache

M4 / DETERMINISTIC PRODUCTION
→ exakte Geometrie, Masken, Composition, Crop, Connectoren, Multi-Cell-Zusammenbau

METADATA
→ Bedeutung, Rotation, Connector-Familie, wallSafe/runtimeEligible, spanTiles, Placement-Tags

LEVEL / ROOM GEOMETRY
→ echter Raum, Apertures, Structural Bands, nutzbarer Tiling-Domain
```

Nicht wiederholen:

- M4 als Ersatz für Materialkunst verwenden und dadurch sterile Debug-SVGs bauen;
- generierte Speziallinien als exakte Connector-Topologie behandeln;
- ästhetische Kacheln zuerst erzeugen und erst danach ihre Semantik erfinden;
- ein Placement-/Fit-Problem mit weiterer Bildgeneration lösen.

---

# 7. Image-generation / QA Turn Contract

Für Artist-Arbeit gelten die aktuellen Repository-Contracts.

Insbesondere:

- enthält die User-Nachricht `QA`, dann **nur inspizieren**, keine Bildgeneration;
- bei Prop-Arbeit autorisiert nur die standalone Nachricht `generieren` genau einen Image-Generation-Call;
- bei Floor-Arbeit ebenfalls niemals aus einem QA-Kommentar heraus automatisch neu generieren;
- nach einer Bildgeneration nicht im selben Turn heimlich extrahieren, integrieren oder einen zweiten Kandidaten erzeugen;
- Runtime-Placement-/Scale-/Fit-Probleme zuerst deterministisch lösen, nicht automatisch rerollen.

Siehe:

- `docs/art/production/ARTIST_AGENT_WORKFLOW.md`
- `docs/art/production/HARD_GENERATION_COMMAND_GATE.md`
- `docs/art/production/IMAGE_GENERATION_TURN_CONTRACT.md`

---

# 8. Nächster konkreter Floor-Block — Family Child

Nicht sofort Bildgeneration starten.

Zuerst aktuellen Child-Raum in LevelSpec/Runtime inspizieren und einen kleinen Tile-/Surface-Contract definieren.

Ziel aus dem aktuellen Floor Recipe:

> ein echtes Kinderzimmer innerhalb derselben Transfer-Ship-Familie; verwandt mit Family Living, aber etwas weicher/persönlicher/human-scaled, ohne generische bunte Kids-Decals.

Aktuelle Leitplanken:

- Family Living bleibt als akzeptierte verwandte Materialfamilie erhalten;
- Child darf etwas wärmer/weicher oder kleinteiliger wirken;
- Nutzungsspuren nur soweit sie Ground-Identität sind; systematischer Wear-Pass B3 kommt später;
- keine saturierten Spielzeug-Symbole/Decals als billige Raumidentität;
- keine Story-spezifischen Kinderzeichnungen oder Kanon-Aussagen ohne Narrative Trigger;
- wenn Multi-Cell-/directional Tiles entstehen, `FLOOR_TILE_METADATA_CONTRACT.md` sofort aktivieren;
- wenn der Raum mit wenigen ruhigen Base-Varianten funktioniert, keine unnötige Connector-Komplexität erfinden.

Arbeitsweise: **Child komplett bis Live-QA bringen, dann erst Hygiene beginnen.**

---

# 9. Danach — Family Hygiene

Ziel:

- funktional anders als Living/Child;
- etwas kühler/kompakter;
- plausibler Non-Slip-/Hygiene-Read;
- sauberer, aber nicht sterile hospital-white;
- sehr subtile Reinigungs-/Wasservariation erlaubt;
- weiter eindeutig dieselbe Transfer-Ship-Materialfamilie.

Auch Hygiene separat produzieren und live abnehmen.

---

# 10. Danach offene Gold-Slice-Blöcke

Nach Child + Hygiene bleiben im Floor-/Environment-Milestone:

1. **B2 Wall AO** — aus echter Architektur/Shared Wall Graph, apertures sauber, FloorFX;
2. **B3 Usage/Wear** — tatsächliche Aktivitäts-/Traffic-Zonen statt globalem Grunge;
3. **B5 Flow floor relationship** — finaler Scale/Collision/Shadow + statischer deterministischer Bus;
4. **PRIMUS hero/system wall object** — über dem akzeptierten PRIMUS-Boden;
5. nützliche domestic replacements;
6. vollständige Desktop-/Phone-Gold-Slice-Cohesion-QA.

Erst danach Transfer-Choreography/Animation-Polish als nächster großer Block.

---

# 11. Was ausdrücklich NICHT wieder geöffnet werden soll

Ohne konkreten neuen Defekt nicht anfassen:

- PICO akzeptierte Source/Turnaround;
- PICO Grounding Profile/Manual Calibration;
- Family Living Floor v1;
- Main Hall Floor v1;
- Transfer Room Floor/Hero Anchor v1;
- PRIMUS Floor v2;
- Walls;
- Doors;
- Transfer Apparatus/Core static baseline;
- große Runtime-/Framework-Architektur.

Ein neuer Raum darf vorhandene akzeptierte Systeme verwenden, aber nicht als Vorwand dienen, sie neu zu bauen.

---

# 12. Git-/QA-Disziplin

Vor Merge:

- relevante Tests ergänzen/aktualisieren;
- `npm test` grün;
- `npm run build` grün;
- relevante Browser-QA grün;
- bei Geometrieänderungen alle bewusst betroffenen Geometry-/Topology-Erwartungen aktualisieren;
- keine alten Erwartungen nur deshalb ändern, weil ein Test unbequem ist — Änderung muss fachlich beabsichtigt sein.

Nach Merge:

- Pages-Deployment abwarten;
- Live-URL mit Cache-Buster verwenden, wenn ein alter Stand vermutet wird;
- erst deployed live als Art Director bewerten;
- **merged/CI green ≠ LIVE_ACCEPTED**.

---

# 13. Kurzprompt für den nächsten Agenten

Du arbeitest am Repository `KlausUllrich/numberdroid` und setzt den TS-01 Gold-Slice-Art/Floor-Pass fort.

1. Prüfe zuerst aktuellen `main`-HEAD und letzten Actions-/Pages-Status.
2. Lies `AGENTS.md`, `REPOSITORY_STRUCTURE.md`, `docs/agents/ROLE_ENTRYPOINTS.md`, `docs/agents/REPOSITORY_WORKFLOW.md` und `docs/README.md`.
3. Lies danach vollständig:
   - `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
   - `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`
   - `art-source/recipes/transfer-hall/floor-treatment/recipe.md`
   - `docs/art/production/ARTIST_AGENT_WORKFLOW.md`
   - `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`
   - relevante Transfer-Ship Art-Direction/Layer-Regeln.
4. Akzeptierter Stand: Family Living, Main Hall, Transfer Room und PRIMUS Floor sind LIVE_ACCEPTED. PRIMUS ist 10×8 mit 1-Tile-Perimeter und 8×6 exakt durch 2×2-Makros teilbarem Innenbereich. Keine halben Multi-Cell-Tiles zulassen.
5. Nächster Raum ist **Family Child**. Bearbeite Räume einzeln; Hygiene erst nach Child-Live-QA.
6. Inspiziere zunächst den echten Child-Raum/Code und definiere den minimal nötigen Floor-/Tile-Contract. Keine unnötige Topologie erfinden.
7. Wenn ein modularer/directional/multi-cell Atlas nötig ist, `FLOOR_TILE_METADATA_CONTRACT.md` vor Generierung anwenden. Structural Bands vor Placement vom Tiling-Domain abziehen; Multi-Cell-Domain muss exakt teilbar sein.
8. Bei `QA` niemals Bildgeneration. Runtime-Placement-/Fit-Probleme deterministisch lösen, nicht rerollen.
9. Ändere keine akzeptierten Baselines ohne konkreten Defekt.
10. Nach Implementierung Tests/Build/Browser-QA ausführen, mergen, Deployment prüfen und erst dann um visuelles Live-QA bitten.

---

# 14. Referenz-URLs / aktueller Stand

Repository:

`https://github.com/KlausUllrich/numberdroid`

Live generated TS-01:

`https://klausullrich.github.io/numberdroid/?floor=ts01-generated`

PRIMUS exact-fit functional merge:

PR #132 — `21577cf37d2f85e0f23a152b1080b48f4504c0d2`

Wichtig: Beim Start der nächsten Session **nicht** davon ausgehen, dass dieser SHA noch `main` ist. Immer aktuellen `main` erneut prüfen.
