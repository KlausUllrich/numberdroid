# Numberdroid — Approved Source Archive Contract

Status: **binding production-preservation contract for approved visual sources**

This document defines what happens immediately after an image/source is explicitly approved and before destructive or downscaling production work begins.

Its purpose is to preserve the highest-quality approved source so later retouching, animation, rigging, alternate exports or tool migrations can restart from the original rather than from a runtime derivative.

Repository location/naming is also summarized in `art-source/approved/README.md`.

Manual user upload behavior is owned by `APPROVED_SOURCE_UPLOAD_HANDOFF.md`.

---

## 1. Binding state transition

For generated/painted Props, Hero assets and other revisitable visual sources:

```text
SOURCE APPROVED
→ APPROVED SOURCE ARCHIVE PREPARED
→ APPROVED SOURCE ARCHIVED
→ PRODUCTION EXTRACTION / NORMALIZATION
```

`SOURCE APPROVED` and `APPROVED SOURCE ARCHIVED` are different states.

A source is not archived merely because it is visible in chat, returned by `image_gen`, mounted under `/mnt/data`, or referenced by a recipe.

The actual approved binary/source file must be durably reachable in the repository archive.

If automatic real-file publication is unavailable, the required branch is:

```text
SOURCE_APPROVED
→ ARCHIVE_PENDING
→ USER_UPLOAD_REQUIRED
→ Klaus uploads the exact prepared file
→ `hochgeladen`
→ USER_UPLOAD_VERIFIED
→ APPROVED_SOURCE_ARCHIVED
→ PRODUCTION EXTRACTION / NORMALIZATION
```

The full user-facing handoff and verification contract is defined in `APPROVED_SOURCE_UPLOAD_HANDOFF.md`.

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

Before any manual upload handoff, the Agent prepares a byte-identical local/mounted copy under this exact canonical filename. Renaming/copying bytes is allowed; re-encoding the image is not.

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
GIT BLOB SHA-1 WHEN AVAILABLE
RECIPE PATH(S)
ARCHIVE PATH(S)
PRODUCTION DERIVATIVES / RELATIONSHIP
CURRENT / SUPERSEDED STATE
```

This manifest is descriptive metadata. It is not a substitute for the actual original file.

---

## 7. Manual upload preparation — mandatory when automatic binary transport is unavailable

If `docs/agents/BINARY_ASSET_TRANSPORT.md` determines that no safe real-file publication route is available, the Agent must not merely state that Klaus has to upload something manually.

The Agent must prepare the handoff completely according to `APPROVED_SOURCE_UPLOAD_HANDOFF.md`.

At minimum the Agent must provide:

```text
DOWNLOADABLE PREPARED ORIGINAL
EXACT FILENAME
EXACT GITHUB BRANCH
EXACT TARGET FOLDER
EXACT TARGET PATH
RAW BYTE SIZE
SHA-256
GIT BLOB SHA-1
SHORT GITHUB UPLOAD STEPS
REPLY TRIGGER: `hochgeladen`
```

The Agent computes upload identity with:

```bash
npm run repo:approved-source-handoff -- \
  --file <prepared-byte-identical-file> \
  --target <art-source/approved/.../exact-filename> \
  --branch <focused-branch>
```

The prepared local filename must exactly match the target archive filename.

State:

```text
ARCHIVE_PENDING
→ USER_UPLOAD_REQUIRED
```

This is a blocking production gate by default.

---

## 8. Manual upload verification after `hochgeladen`

When Klaus replies `hochgeladen` for the active handoff, do not ask him to prove the upload manually and do not immediately continue production.

The Agent verifies repository metadata for the exact target file:

1. exact filename;
2. raw byte size;
3. GitHub blob SHA against the expected **Git blob SHA-1** computed from the local approved source.

Matching Git blob SHA verifies byte identity without downloading/re-serializing the binary through the model text channel.

If verification fails:

```text
USER_UPLOAD_VERIFICATION_FAILED
```

Report the mismatch and keep the archive gate open.

If verification succeeds:

```text
USER_UPLOAD_VERIFIED
→ APPROVED_SOURCE_ARCHIVED
```

Then update the family manifest and only then proceed to Production Extraction / Normalization.

---

## 9. Production traceability

Every production derivative should remain traceable to:

1. Asset Family;
2. approved original;
3. relevant recipe/settings;
4. processing stage.

Runtime files in `public/` are outputs, not archival authority.

A later animation workflow should start from `art-source/approved/.../source/` or family source-quality FX, not from a 64/128/192px runtime derivative when a higher-quality approved original exists.

---

## 10. Binary transport gate

Approved visual originals are usually binary and may be large.

Before repository publication, follow `docs/agents/BINARY_ASSET_TRANSPORT.md`.

Current invariant:

> Repository binary bytes must not be serialized through the model/tool text channel as inline Base64.

If a real file-aware connector action or existing authenticated local checkout is available, use it and verify the resulting repository file.

If neither is available:

```text
BINARY_TRANSPORT_BLOCKED
→ ARCHIVE_PENDING
→ USER_UPLOAD_REQUIRED
```

`BINARY_TRANSPORT_BLOCKED` is therefore a transport limitation, not the end of the workflow. The required next action is the prepared manual upload handoff to Klaus.

---

## 11. Current Transfer System example

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
