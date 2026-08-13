# Numberdroid — Art Asset Validation Rules

Status: **binding production QA rules for generated/authored visual assets**  
Applies to: all Numberdroid gameplay art unless a more specific document explicitly overrides a rule.  
Companion documents: `ART_PRODUCTION_RULES_TRANSFER_SHIP.md`, `ART_DIRECTION_TRANSFER_SHIP.md`, `TRANSFER_HALL_LAYER_RULES.md`.

These rules exist because a visually attractive generated image is not automatically a usable game asset. Every image must be inspected after creation and rejected before integration if it violates the intended asset category, perspective, palette, grid, transparency or runtime contract.

## 1. One production category per generation

Do not ask an image generator to solve several unrelated production categories in one image.

Default sequence for a visual slice:

1. character turnaround;
2. floor tiles;
3. walls / architecture;
4. doors;
5. hero setpiece;
6. PRIMUS / dedicated system object;
7. props;
8. FloorFX / decals;
9. lighting or transient effects, if needed.

A generation intended for production must contain **only the requested category**. Do not add attractive bonus content.

Examples:

- a Floor sheet contains floors only;
- a Wall sheet contains architecture only;
- a Props sheet contains isolated props only;
- a PICO sheet contains PICO only;
- a Transfer apparatus sheet contains the Transfer apparatus only.

Hero assets and ordinary modular tiles must not share a production sheet unless the runtime explicitly requires that atlas layout.

## 2. Mandatory post-generation inspection

**Every generated image must be visually inspected before any crop, conversion, GitHub upload or runtime integration.**

The agent must open the actual generated image and inspect it at useful scale. File existence, PNG format, dimensions or an image-generation success response are not sufficient validation.

If the image cannot be directly viewed in the active session, place it temporarily in an accessible location such as a repository `tmp/` branch/path, inspect the actual rendered image, then remove the temporary artifact after validation.

Do not tell the user an asset is usable until this inspection has happened.

### Mandatory inspection questions

For every generated image answer internally:

- Is this actually the requested asset category and nothing else?
- Is the perspective correct?
- Does it match the current Numberdroid visual language and palette?
- Is the image composition suitable for deterministic extraction into production cells/sprites?
- Are all required variants present?
- Are unnecessary near-duplicate variants present?
- Are any objects clipped, touching cell boundaries unintentionally, or overlapping neighbours?
- Is any background, floor, wall, lighting or shadow baked into an asset that should be transparent?
- Are hero assets accidentally mixed into modular sheets?
- Is text baked into art where runtime text/signage should be used instead?
- Does the image still read correctly at actual gameplay scale?

If any answer fails, **reject or regenerate before integration**. Do not try to justify a clearly unsuitable image because it is attractive.

## 3. Production extraction is a separate step

Generated images are source art, not automatically production atlases.

Before integration:

- crop deliberately;
- remove backgrounds where required;
- create real alpha transparency where required;
- normalize exact dimensions;
- place content on the runtime's exact grid;
- preserve safe padding inside sprite cells;
- verify cell order;
- verify no neighbouring image content bleeds into a cell;
- inspect the resulting production file again after processing.

A production PNG must be checked **after** extraction as well as before extraction.

## 4. Floor tile rules

Floor is its own production category.

### Geometry

- strict orthographic top-down;
- every production floor tile is exactly **64 × 64 px**;
- all cells in a sheet are the same size;
- use the established four-column Transfer Ship atlas layout unless deliberately changed in the production rules;
- tile edges must join cleanly with neighbouring copies where intended;
- no perspective, bevel perspective or visible vertical faces;
- no hero machinery embedded into an ordinary floor tile sheet.

### Visual language

Transfer Ship base floor should primarily read as:

- civilian, maintained, desirable technology;
- warm off-white / ceramic grey large surfaces;
- restrained graphite seams or recesses;
- subtle material variation and wear;
- sparse teal system accents;
- CORE amber only where semantically justified.

Avoid as default floor language:

- dark military steel everywhere;
- excessive blue neon;
- ubiquitous hazard stripes;
- strong orange/yellow industrial striping on ordinary circulation floor;
- generic spaceship grates repeated everywhere;
- noisy panelization in every tile;
- giant numbers or warning graphics without authored purpose.

### Variant economy

Every tile variant needs a distinct gameplay, layout or material purpose.

Reject redundant variants that differ only trivially, for example several tiles whose only difference is an almost identical small yellow corner mark.

Prefer a small, coherent set such as:

- calm base tile;
- subtle alternate base tile;
- seam / service variant;
- SLOT registration variant;
- functional hatch/recess;
- specifically required transition/decal variant.

Do not create visual variety merely to fill an atlas.

## 5. Architecture / wall rules

Walls are not floor tiles with a wall picture baked across the cell.

For the Transfer Hall foundation:

- architecture remains strict top-down;
- visible wall geometry must respect the accepted thin-wall system;
- current Transfer Hall wall band is **10 px**;
- corners, T-junctions, caps and pockets must join as manufactured continuous pieces;
- transparent space outside the wall geometry must remain transparent when the runtime expects semantic wall markers;
- do not replace the accepted collision/layer system with full-cell wall slabs;
- cyan/teal accents must not create accidental seams at joints.

Inspect corners and T-junctions at 100% and enlarged scale for one-pixel seams.

## 6. Door rules

Doors are a separate production concern from walls when moving geometry is involved.

For the Transfer Hall:

- moving leaves remain **5 px** against the accepted 10 px wall architecture;
- leaves must retract fully into wall pockets;
- open state must read as a clean aperture;
- no residual guide lines should remain visible across the opening unless intentionally part of the final design;
- door art must not cover collision/opening inconsistently;
- no perspective door front or isometric extrusion.

Validate both fully closed and fully open states after integration.

## 7. Prop rules

Props must be isolated objects.

- transparent background;
- no baked floor tile;
- no baked wall section;
- strict orthographic top-down for environment props;
- no 3/4 furniture or side-view cabinets;
- contact shadow may exist only directly under the object and must not imply a fixed global light direction incompatible with scene lighting;
- prop silhouette must remain readable at gameplay scale;
- separate props need enough transparent padding to extract cleanly;
- no overlap between neighbouring source objects.

If removing the prop would also remove visible floor or wall, the prop asset is invalid.

## 8. Character turnaround rules

Characters are the deliberate perspective exception.

For an eight-direction body sheet:

- exact order: `N | NE | E | SE | S | SW | W | NW`;
- all eight views are genuinely authored;
- N = clear back;
- S = clear front/personality;
- E/W = true narrow profiles;
- diagonals = meaningful front/rear three-quarter views;
- do not rotate one image;
- do not mirror four views and call them eight;
- neutral physical body art; allegiance stays a runtime layer;
- consistent apparent scale and ground contact across all views;
- transparent background;
- equal exact frame dimensions;
- no labels inside production frames.

For current standard PICO production, the final runtime strip is **8 × 96 px = 768 × 96 px**.

After extraction, inspect the full strip and each individual 96 × 96 cell.

## 9. Hero setpiece rules

Hero objects such as the Transfer apparatus are produced separately from ordinary floor/wall/prop sheets.

- strict top-down gameplay geometry;
- coherent multi-tile composition;
- named, recognizable machine with believable construction;
- source can be larger than runtime size, but production slicing must land on exact 64 px cells when tiled;
- do not bake global room illumination into the object;
- local emissive surfaces may be painted, while illumination of nearby floor/characters stays in `LightOverlay`;
- collision footprint remains separately authored from visual footprint.

Do not shrink a complex hero object into a single generic floor icon merely to fit an atlas cell.

## 10. FloorFX / decal rules

FloorFX is not lighting.

Allowed:

- painted registration marks;
- route lines;
- subtle projected/contact shadow where explicitly appropriate;
- non-light status markings;
- authored floor decals.

Not allowed:

- a floor background baked behind the FX;
- radial light pools;
- glow intended to illuminate characters;
- room lighting;
- hero machinery;
- props.

FloorFX production assets require transparency except where the runtime specifically treats the entire cell as a floor replacement.

## 11. Lighting rules

Scene lighting remains separate from source tile/prop art.

- use `LightOverlay` for illumination affecting the world and characters;
- do not fake scene illumination by painting orange/blue light pools into Floor or Props;
- emissive pixels may indicate a light source, but the light cast into the scene is runtime lighting;
- respect room clipping and wall occlusion;
- walls must not receive impossible top-painted overlay light;
- TS-01 remains calm; the Transfer apparatus is the dominant warm local source.

## 12. Palette validation

Before accepting a generated asset, compare its dominant read against the current art direction rather than judging it in isolation.

Transfer Ship hierarchy:

- **primary:** warm off-white / ceramic grey;
- **secondary:** graphite / dark mineral machinery;
- **system accent:** restrained teal/cyan;
- **CORE / Transfer focus:** warm amber;
- **family traces:** localized warmer personal colours;
- **allegiance colours:** runtime semantic layer, not baked indiscriminately into body art.

Reject attractive assets when their dominant language becomes generic dark-grey + cyan military sci-fi or orange hazard-industrial art.

## 13. Duplicate and similarity check

Generated sheets often contain several superficially different versions of the same idea. This wastes atlas space and weakens visual language.

Before extraction:

- identify visually near-identical candidates;
- keep the strongest representative;
- only retain additional variants when their difference has a named purpose;
- avoid mirrored/recoloured/rearranged duplicates pretending to be distinct content.

A useful test is: **Can the reason for this variant be stated in one short phrase?** If not, remove it.

## 14. Gameplay-scale check

Every accepted source must be tested at intended runtime size.

For each relevant asset:

- downscale/crop to final cell or sprite size;
- inspect at 100% pixel display;
- ensure silhouette and semantic features still read;
- make sure micro-detail does not turn into noise;
- make sure important accents are not thinner than practical display resolution;
- verify character direction remains obvious during movement.

Concept-art quality at 1500 px is irrelevant if the asset collapses at 52–96 px gameplay scale.

## 15. Integration gate

An asset may be integrated only after all applicable checks pass:

1. category check;
2. visual inspection of source;
3. perspective check;
4. palette/style check;
5. duplicate check;
6. transparency/background check;
7. exact dimensions/grid check;
8. production extraction;
9. visual inspection of final production file;
10. gameplay-scale check;
11. runtime integration;
12. in-game visual check;
13. tests/build.

If a problem is found at any stage, correct the asset before continuing to the next category.

## 16. Gold Slice working discipline

For the current Gold Slice, do not batch the remaining visual production into one giant image.

Work sequentially and finish/validate one category before moving on:

1. PICO;
2. Floor;
3. Walls;
4. Doors;
5. Transfer apparatus;
6. PRIMUS object;
7. Family props;
8. FloorFX / remaining accents.

This sequence is a production discipline, not merely a prompt preference. It prevents one failed generation from contaminating several asset classes and makes visual approval explicit at each step.
