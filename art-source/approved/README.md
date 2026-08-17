# Numberdroid — Approved Source Archive

Status: **binding art-source archive contract**

This directory stores the **highest-quality approved authoring sources** for visual assets after Art-Director approval and before destructive production processing.

It is intentionally separate from:

- `art-source/recipes/` — reproducibility, prompts, processing settings and asset-specific production contracts;
- `public/` — runtime/deploy outputs;
- `art-source/archive/` — superseded/historical authoring material.

Detailed process authority:

- `docs/art/production/APPROVED_SOURCE_ARCHIVE.md`
- `docs/art/production/APPROVED_SOURCE_UPLOAD_HANDOFF.md` when Klaus must upload the binary manually.

## Canonical hierarchy

Approved sources are grouped first by **Campaign Area**, then by **Asset Family**.

```text
art-source/approved/
├─ area-01-transfer-ship/
├─ area-02-deep-ocean/
├─ area-03-extreme-industry/
├─ area-04-moon-vacuum/
└─ area-05-bio-ark-primus/
```

An **Asset Family** is the smallest useful bundle of visual assets that share one gameplay/story object, system or future animation workflow.

Examples:

- `family-table/` — one simple asset family;
- `transfer-system/` — Transfer Apparatus + yellow Core + Transfer FX + later animation sources;
- a multipart machine whose components animate together should remain one family rather than being split only because runtime files are separate.

## Asset Family structure

Default family layout:

```text
<campaign-area>/<asset-family>/
├─ README.md        # family manifest, provenance, approval and file relationships
├─ source/          # immutable large approved originals
├─ production/      # deterministic processed derivatives / runtime-source masters
├─ fx/              # related effect/source elements such as Core or transfer energy
└─ animation/       # later animation source files, turnarounds, layered exports, etc.
```

Create only additional subfolders that have a real authoring purpose.

## `source/` rule — immutable approved originals

Every approved generated/painted source must be preserved here **byte-for-byte as approved** before Crop/Fit, resizing, alpha cleanup, compositing, shadow generation or other production transformations.

Do not:

- resize the archived original;
- crop it;
- recompress/re-encode it merely for neatness;
- overwrite it with a later production derivative;
- silently replace it when a new revision is approved.

If a later source supersedes it, preserve both with distinct revision/date names and update the family manifest to identify the current authority.

Recommended filename:

```text
<component>__approved-original__YYYY-MM-DD.<ext>
```

The family manifest records at least:

- component/semantic role;
- approval state/date;
- generator/source provenance when known;
- original dimensions;
- byte size;
- SHA-256 when available;
- Git blob SHA-1 when a manual upload may need verification;
- relevant recipe path;
- whether the file is current or superseded.

## Archive gate

For generated Prop / Hero work the intended state transition is:

```text
SOURCE APPROVED
→ APPROVED SOURCE ARCHIVED
→ PRODUCTION EXTRACTION / NORMALIZATION
```

Do not treat a chat attachment, image-generation tool result, temporary `/mnt/data` file or local working file as durable archive.

If automatic repository binary transport is unavailable, the flow is **not** simply “stop and ask Klaus to figure it out.” The Agent must prepare the manual handoff:

```text
SOURCE_APPROVED
→ ARCHIVE_PENDING
→ USER_UPLOAD_REQUIRED
→ Agent provides exact downloadable file + branch + target path + hashes + upload steps
→ Klaus uploads and replies `hochgeladen`
→ Agent verifies raw size + Git blob SHA
→ APPROVED_SOURCE_ARCHIVED
```

The Agent owns naming, Campaign Area, Asset Family, branch selection, target path, prepared download file and verification metadata. Klaus only performs the GitHub upload click-path and replies `hochgeladen`.

Follow `docs/agents/BINARY_ASSET_TRANSPORT.md`; never use inline Base64 to fake the archive step.

## Relationship to runtime assets

A runtime file may be much smaller or structurally different from its approved source. That is expected.

The archive exists so future work — especially animation, retouching, higher-resolution exports, alternate crops or tooling migrations — can restart from the approved high-quality source rather than from a downscaled runtime PNG.
