# Numberdroid — Approved Source Archive Contract

Status: **binding production-preservation contract for approved visual sources**

This document defines what happens immediately after an image/source is explicitly approved and before destructive or downscaling production work begins.

Its purpose is to preserve the highest-quality approved source so later retouching, animation, rigging, alternate exports or tool migrations can restart from the original rather than from a runtime derivative.

Repository location/naming is also summarized in `art-source/approved/README.md`.

---

## 1. Binding state transition

For generated/painted Props, Hero assets and other revisitable visual sources:

```text
SOURCE APPROVED
→ APPROVED SOURCE ARCHIVED
→ PRODUCTION EXTRACTION / NORMALIZATION
```

`SOURCE APPROVED` and `APPROVED SOURCE ARCHIVED` are different states.

A source is not archived merely because it is visible in chat, returned by `image_gen`, mounted under `/mnt/data`, or referenced by a recipe.

The actual approved binary/source file must be durably reachable in the repository archive.

If that cannot yet be done, use:

```text
SOURCE_APPROVED / ARCHIVE_PENDING
```

and follow `docs/agents/BINARY_ASSET_TRANSPORT.md`.

Do not fake archive completion with Base64, data URIs or lower-resolution reconstruction.

---

## 2. Campaign Area naming

The five top-level game sections are called **Campaign Areas** for approved-source organization.

Canonical folders:

```text
area-01-transfer-ship
area-02-deep-ocean
area-03-extreme-industry
area-04-moon-vacuum
area-05-bio-ark-primus
```

This is an authoring/archive taxonomy. It does not rename story canon inside narrative documents.

---

## 3. Asset Family — grouping rule

Below each Campaign Area, sources are grouped by **Asset Family**.

An Asset Family is the smallest useful group that should stay together for future authoring, retouching or animation.

Use one family folder when components:

- represent one gameplay/story system;
- visually depend on one another;
- are likely to be animated/edited together;
- share one approved design language and production lineage.

Examples:

```text
family-table/
transfer-system/     # Transfer Apparatus + yellow Core + Transfer FX
```

Do not split related components merely because runtime registration uses several files.

Likewise, do not put unrelated room props into one family merely because they were approved in the same session.

---

## 4. Default family structure

```text
art-source/approved/<campaign-area>/<asset-family>/
├─ README.md
├─ source/
├─ production/
├─ fx/
└─ animation/
```

### `source/`

Immutable, highest-quality approved primary originals.

### `production/`

Deterministic crop/fit/downscale/cleanup masters and other processed derivatives.

### `fx/`

Related source-quality effects/components such as the yellow Core or Transfer-energy elements when they belong to the family.

### `animation/`

Later layered editor projects, rig inputs, animation-specific composites, turnarounds and exports.

Only create extra folders when a real authoring need exists.

---

## 5. Approved Original — preservation rule

The approved original is stored **byte-for-byte as approved** whenever the source format permits that.

Do not:

- crop it;
- resize it;
- re-encode/recompress it for convenience;
- remove alpha or add a background;
- overwrite it with a production master;
- silently replace it after approving a later revision.

Recommended filename:

```text
<component>__approved-original__YYYY-MM-DD.<ext>
```

If another revision becomes authoritative, preserve both and mark the current authority in the family manifest.

---

## 6. Family manifest — mandatory

Every Asset Family has a top-level `README.md` recording at least:

```text
CAMPAIGN AREA
ASSET FAMILY
COMPONENTS / RELATIONSHIPS
CURRENT APPROVED SOURCE(S)
APPROVAL DATE / STATE
SOURCE PROVENANCE / GENERATION ID WHEN KNOWN
ORIGINAL DIMENSIONS
RAW BYTE SIZE
SHA-256 WHEN AVAILABLE
RECIPE PATH(S)
ARCHIVE PATH(S)
PRODUCTION DERIVATIVES / RELATIONSHIP
CURRENT / SUPERSEDED STATE
```

This manifest is descriptive metadata. It is not a substitute for the actual original file.

---

## 7. Production traceability

Every production derivative should remain traceable to:

1. Asset Family;
2. approved original;
3. relevant recipe/settings;
4. processing stage.

Runtime files in `public/` are outputs, not archival authority.

A later animation workflow should start from `art-source/approved/.../source/` or family source-quality FX, not from a 64/128/192px runtime derivative when a higher-quality approved original exists.

---

## 8. Binary transport gate

Approved visual originals are usually binary and may be large.

Before repository publication, follow `docs/agents/BINARY_ASSET_TRANSPORT.md`.

Current invariant:

> Repository binary bytes must not be serialized through the model/tool text channel as inline Base64.

If no real file-aware connector action and no existing authenticated local checkout is available:

```text
BINARY_TRANSPORT_BLOCKED
→ ARCHIVE_PENDING
```

Keep the truthful state and stop before claiming the source is archived.

---

## 9. Current Transfer System example

Current intended family:

```text
art-source/approved/
└─ area-01-transfer-ship/
   └─ transfer-system/
      ├─ source/
      │  └─ transfer-apparatus__approved-original__2026-08-17.png
      ├─ production/
      ├─ fx/
      │  └─ yellow-core__approved-original__<date>.png   # after separate approval
      └─ animation/
```

The Transfer Apparatus and yellow Core belong together as an authoring family because the Core is visually and narratively part of the same Transfer system and future animation work will likely combine them.

PICO remains a separate Character asset because it has an independent character/body production lifecycle even when staged in the Transfer Body Dock.
