# Exact Asset versions used by a Room

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**.
Date: 2026-09-08.

## Problem and promise

Room placements already retain exact Asset and metadata versions. Backend Room
mutations and Studio Preview resolve those versions from immutable history.
The editor currently searches only current Asset heads, so an Asset revision
can make an old placement appear missing with an invented 1×1 footprint.

This candidate gives the editor the exact records needed by the selected Room.
It must preserve the saved image, name and footprint after a newer Asset head
exists and after restart. This is a prerequisite for safe Library editing. The separate human metadata
UI candidate must also be reconciled with the approved authoring design before
integration.

## Bounded read surface

```text
GET /api/projects/{projectId}/revisions/{projectRevision}/room-variants/{roomVariantId}/versions/{roomVersion}/pinned-assets
```

The route accepts no query parameters and no writes. Other methods fail with
405. Project and Room numbers must be positive safe integers. It reuses the
existing trusted Room Preview source query, including project read authority,
the current project revision, exact current Room head, and the Room's creation
revision cutoff for historical Asset lookup.

The schema-v1 `room-pinned-assets` response repeats project ID/revision and Room
ID/version. Its Asset array contains exactly the deduplicated version triples
used by that Room, bounded by the existing 256-placement limit. It exposes no
unused Assets, arbitrary historical revisions, grants or operational records.

Each record explicitly includes Asset ID/version, metadata version, name, kind,
lifecycle, validated typed metadata, exact native slice binding, deterministic
metadata findings and a project-scoped preview URL. Same-project identity,
binding digest/media/dimensions, metadata/image-fact equality, missing pins and
duplicate or unused records fail closed. Raw source objects are not forwarded.

No MCP catalog, grant, command, persistence schema, write authority or release capability
changes. Existing Room mutation semantics and asset-version references remain
unchanged.

## Editor behavior

Matching current Asset heads can satisfy a placement without another request.
Missing historical versions load under a key containing project ID/revision and
Room ID/version. Cancellation, timeout and stale-response guards prevent a
late result from entering another editor context. Multiple versions of one
Asset are distinguished by the full Asset/version/metadata triple.

While records are loading or unavailable, the Room remains identifiable, shows
truthful status and permits navigation/retry. Affected edits must not use
unknown geometry. The editor neither substitutes the latest head nor invents
a 1×1 footprint. Restart fetches the records again; an in-memory cache is not
a persistence substitute.

## Required verification

Use fresh fixtures to prove A1 rendering after A2 exists, two versions of one
Asset in one Room, exact old-pin move/resize behavior, stale/foreign/missing
reference rejection, unused-record exclusion and zero read-side writes. Test
delayed responses during Room/project switching and native 1440/1060 rendering
plus restart. Run selected full/core/platform/HTTP security gates and independent
reviews. CI/source identities belong in the focused PR.

The human decision is deferred and remains separate from automated proof and
the existing VT-001 REVISE state. No production Asset selection, image
generation, materialization or publication is authorized by this read path.

## Local candidate verification

The full local Studio run passed 802 tests with five expected skips, and the
build checked 262 JavaScript files. Public-read and evidence reviews passed.
A later navigation review found and corrected a pending-read cancellation gap;
the affected focused and real-browser tests passed after that repair.

Fresh 1440/1060 evidence verifies old and mixed Asset versions, saved geometry,
move/resize behavior, ignored late Room replies, normal workspace exit/return,
and unchanged restart fingerprints. This is local candidate proof. Remote CI,
source integration and human acceptance remain separate outstanding gates.

The 2026-09-08 refresh retains the exact read/cache behavior and combines its
browser evidence with the current Room-creation lane. The earlier local results
above are historical candidate evidence; refreshed-head results belong in the PR.
