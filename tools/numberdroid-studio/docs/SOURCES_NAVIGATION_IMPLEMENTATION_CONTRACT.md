# Sources navigation — Production implementation contract

Status: **IMPLEMENTED CANDIDATE — LIVE ACCEPTANCE PENDING, 2026-09-16**.

This contract binds the production implementation of the user-approved
[Sources Navigation Design](SOURCES_NAVIGATION_DESIGN.md). It reorganizes the
existing source and atlas projections without changing their commands, schemas,
review authority, persistence, processing, or publication meaning.

## Bounded promise

The Sources workspace provides exactly two content views:

- **Source Images** lists original inputs and their real source-review lifecycle;
- **Image Workbench** lists actual persisted atlas/cut definitions and saved cut
  outputs.

**Needs review** is a status filter. Existing submitted shared Reviews appear as
a compact attention notice and open the same Review used by Library and Agent
tasks. They are not copied into a third process tab.

Source cards show whole-image preview, useful dimensions, plain-language status
and the next available action. Technical identity and provenance remain
available in a closed disclosure. Import is progressive disclosure, while
staged-intake recovery remains visible. An approved PNG opens the existing
Cutter under Image Workbench and returns there.

Workbench cards are projected only from saved atlas records. A saved definition
with no outputs says **Saved work · nothing running**; a record with output heads
reports the exact saved-cut count. The list does not infer active processing from
`latestPreviewJobId`; the opened Cutter owns exact queued/running/failure state.

## Preserved behavior and boundaries

- Original source bytes, provenance, lifecycle and owner review remain unchanged.
- Import/propose/approve/reject commands and idempotency remain unchanged.
- Atlas definitions, exact job controls, saved cuts and recut version rules remain
  unchanged.
- Saved cuts remain non-semantic outputs. Existing Asset/Animation authoring
  creates Library content from exact cuts and supplies the separate semantic
  identity and metadata.
- Existing shared Review groups remain Image/Animation/Assembly groups. This
  implementation does not invent an atomic source-plus-cut proposal.
- Disabled Sources actions expose a hover and keyboard-focusable reason when the
  control is rendered unavailable.
- No provider, generation, media expansion, MCP/HTTP authority, schema,
  materialization, runtime export, publication or release change is included.

## Implementation surfaces

- `apps/studio-server/public/sources-navigation-state.js` owns pure filtering and
  truthful status presentation;
- `apps/studio-server/public/app.js` renders the two views, attention filter,
  progressive import and compact technical disclosures;
- `apps/studio-server/public/cutter-editor-view.js` names the Image Workbench
  context and return destination;
- `apps/studio-server/src/server.js` serves the new browser module through the
  existing explicit static allowlist;
- focused state tests and a real-Chrome two-viewport check cover names, filtering,
  focus retention, actual saved atlas/output projection, closed disclosures,
  absence of a process-like Review tab and horizontal containment.

## Acceptance boundary

Automated checks, screenshots, reviews, integration and green CI do not accept
this screen. [VT-025](VACATION_TEST_BACKLOG.md#vt-025--source-images-and-image-workbench)
requires Klaus's explicit PASS or REVISE on a fresh test fixture. Earlier
Checkpoint 2A/2B acceptance remains intact and should be repeated only where this
navigation changed the visible route or explanation.
