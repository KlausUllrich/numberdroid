# A1.7 visual review and correction state contract

Status: **D0 CONTRACT FROZEN — READ PROJECTION AND VISUAL IMPLEMENTED CANDIDATES, NOT USER ACCEPTED**

Implementation state: the separately classified human-safe read projection and
the dependent bounded A1.7 browser surface are **implemented candidates — not
user accepted**. Their implementation records are
[`A1_7_READ_PROJECTION_STATUS.md`](A1_7_READ_PROJECTION_STATUS.md) and
[`A1_7_UI_CANDIDATE_STATUS.md`](A1_7_UI_CANDIDATE_STATUS.md). This document
continues to freeze the implementation-grounded states and the visual contract.
Automated tests, browser evidence, source integration, and CI cannot change the
deferred Klaus acceptance gate.

## Promise and finish boundary

A1.7 will make one branch-local processing-result adoption understandable in
the selected **Agent task** without making it a Main Asset. The ordinary
successful path is:

```text
authorized immutable image input
→ reproducible processing result
→ branch-local semantic DRAFT Asset
→ Waiting for your review
```

The A1.7 surface is read-only with respect to processing adoption. It adds no
browser adoption, retry, metadata mutation, task submission, owner decision,
merge, lifecycle promotion, finalization, materialization, publication, or
release action. Existing generic owner-only task review controls retain their
existing authority and are not part of the A1.7 success path or evidence
fixture. Current code has no compatible owner merge or warning-disposition path
for this private processing-adoption command.

The successful visible result must remain labelled
**implemented candidate — not user accepted** after implementation. A1 remains
incomplete because additional deterministic processing operations and Klaus's
live review remain separate gates.

## Current implementation trace

The frozen state map follows these current facts rather than status prose:

1. A1.3 preflight returns `PREFLIGHT_PASSED` or `PREFLIGHT_BLOCKED`. It is
   always `READ_ONLY`, `NOT_GRANTED`, and requires mutation-time revalidation.
   A ProcessingResult `ERROR` short-circuits every read; a `WARNING` remains
   unresolved but does not alone block adoption.
2. A1.4 planning returns `READY` or `BLOCKED`. It has no effect, persistence,
   commit, or replay. A plan is only `READY_FOR_ATOMIC_UNIT_OF_WORK`; it is not
   authority.
3. A1.5 commit returns only `COMMITTED` and atomically stores one task-branch
   revision, one branch-local `DRAFT` processing Asset, immutable lineage,
   exactly two artifact-retention roles, one task timeline event, and one
   command-budget charge. Main and the project Asset Library do not advance.
4. A create adoption deliberately starts with explicit empty authored metadata
   and eight deterministic Asset metadata `ERROR` findings. Those findings
   mean the committed DRAFT needs correction; they do not mean the adoption
   commit failed. A ProcessingResult `ERROR`, by contrast, blocks before a
   DRAFT can be created.
5. Authoring-v2 surface negotiation returns `READY` with `AVAILABLE` or
   `REPLAY_ONLY`. `REPLAY_ONLY` permits lost-response recovery only; it does not
   identify a particular invocation as replayed or authorize new work.
6. A same-key semantic retry returns the original CommitResult without a
   second effect or charge. The CommitResult intentionally has no `replayed`
   field. A browser must never infer or display a replay claim from a durable
   adoption alone.
7. Attributable Authoring-v2 denials and failures are already persisted as
   redacted attempts and reach project Activity. Successful adoption reaches
   the task timeline, not Main Activity. A successful or blocked dry-run is
   effect-free and is not persisted for later browser projection.

### Source-of-truth map

| Fact | Current authoritative source |
| --- | --- |
| ProcessingResult severities, path-safe explanation/remediation, exact selected-output descriptors | `packages/domain/src/processing-result.js` |
| Preflight status, deterministic blocker derivation, unresolved warnings, nonauthorizing receipt | `packages/domain/src/processing-adoption-preflight.js` |
| `READY`/`BLOCKED` planning, DRAFT target, eight initial findings, idempotency/recovery policy | `packages/domain/src/processing-result-adoption.js` |
| `COMMITTED` CommitResult, DRAFT Asset, findings, selected-output binding, unresolved warnings | `packages/domain/src/processing-result-adoption-commit.js` |
| Fresh admission, `AVAILABLE`/`REPLAY_ONLY`, and ledger-first commit entry | `packages/application/src/authoring-v2-admission.js` and `packages/application/src/authoring-v2-execution-session.js` |
| Immutable adoption/role tables | `packages/persistence/src/sqlite/migrations/0013_processing_result_adoptions.sql` |
| Branch snapshot/head, Activity, budget charge, Aggregate/result/roles, replay | `packages/persistence/src/sqlite/sqlite-processing-result-adoption-store.js` |
| Private opt-in transport and unchanged 31/six surface | `packages/mcp-server/src/authoring-v2.js` and `apps/studio-server/src/server.js` |
| Current human project preview rules and Main-reference authority | `apps/studio-server/src/http-projections.js` and the artifact GET in `apps/studio-server/src/server.js` |
| Current task response gap (`task`, `timeline`, `review` only) | `packages/application/src/agent-task-service.js` and the task GET in `apps/studio-server/src/server.js` |
| Existing task list/detail/current-step/review hierarchy and refresh behavior | `apps/studio-server/public/app.js`, `index.html`, and `styles.css` |
| Durable outcomes, rollback, lost response, redaction, discovery, and protected UI evidence | processing-adoption, Authoring-v2, HTTP, UI, and evidence tests under `tests/` plus the existing evidence scripts |

## Placement and information hierarchy

A processing adoption belongs in the selected **Agent task** detail. It must
not appear in the authoritative Asset Library unless and until a separately
implemented, owner-authorized compatible path later puts the Asset into Main.

The bounded hierarchy is:

1. existing task list with task state and next actor;
2. selected task summary and existing **Current step**;
3. additive **Processed asset draft** section;
4. exact visual preview and plain-language quality/correction facts;
5. existing task controls, progress, and review surface;
6. optional closed **Technical details**.

This hierarchy applies only when the selected task carries the exact private
`asset.processing-result.adopt` capability. Unrelated source, room, Candidate,
and ordinary task reviews neither request nor render the processing-adoption
projection. For a task with that exact capability, every state below—including
`NO_DRAFT`—remains required and must not be hidden merely because the adoption
list is empty.

The section sits after **Current step** and before the general task facts. It
does not create a new workspace, replace the persistent room canvas, turn the
task detail into a wizard, or add `asset.processing-result.adopt` to the human
task composer. The capability may receive a plain-language display label only.

## Low-fidelity state map

The state is a composition of a trusted task/adoption projection and existing
redacted Activity. State precedence is mandatory: a durable adoption wins over
an uncertain or later failed delivery attempt; a later denial/failure may be a
secondary notice but must not erase or relabel the saved DRAFT.

| Contract state | Exact source fact | Primary human copy | Next actor and consequence |
| --- | --- | --- | --- |
| `PROJECTION_UNAVAILABLE` | The bounded task/adoption read is unavailable or fails closed. Absence is not treated as a failed adoption. | **Processed asset details are unavailable.** The task is still available; try loading it again. | Existing task next actor. No browser mutation and no fabricated candidate. |
| `NO_DRAFT` | The read succeeds and returns no durable adoption for this task. | **No processed asset draft has been saved yet.** | For an active task, the assigned agent may continue through authorized semantic commands. Do not show an indefinite processing spinner. |
| `ATTEMPT_DENIED` | A redacted attributable attempt has this exact `taskId`, `commandType` `asset.processing-result.adopt`, and durable status `DENIED`; no adoption at the same or later time supersedes it. Handshake/capability attempts do not qualify. | **The agent was blocked before a draft could be saved.** Show one allowlisted reason and state that no DRAFT was created by that attempt. | Existing task next actor. A1.7 adds no retry or authority-widening action. |
| `ATTEMPT_FAILED` | A redacted attributable attempt has this exact `taskId`, `commandType` `asset.processing-result.adopt`, and durable status `FAILED`; no adoption at the same or later time supersedes it. Handshake/capability attempts do not qualify. | **Preparing the draft failed.** No processing DRAFT was created by that attempt. | Assigned agent or service operator follows the existing task/activity path. No browser retry. |
| `WAITING_FOR_YOUR_REVIEW` | A durable adoption exists, CommitResult is `COMMITTED`, and its Asset lifecycle is `DRAFT`. | **Waiting for your review.** This exact image is saved in this task only. It is not part of Main or the project Asset Library. | The human may inspect it. There is currently no compatible Main merge path for this private command; any later one requires a separately implemented owner-authorized contract. |
| `CORRECTION_REQUIRED` | `WAITING_FOR_YOUR_REVIEW` plus one or more persisted Asset findings with severity `ERROR`. | **Details still need correction.** List the missing or inconsistent semantic details in plain language. | Keep the task open. Correction requires a separately authorized semantic path; A1.7 supplies no metadata button or command. |
| `WARNINGS_UNRESOLVED` | `WAITING_FOR_YOUR_REVIEW` plus persisted unresolved ProcessingResult warnings. | **Review these warnings.** Show explanation and remediation; do not imply warning acceptance. | Human inspects. Warning disposition requires a separately implemented and authorized later path. |
| `PREVIEW_UNAVAILABLE` | A durable DRAFT exists but its exact selected-output stream cannot be served or loaded safely. | **The exact image preview is unavailable.** The DRAFT facts remain inspectable. | Reload/inspection remains possible; preview failure never substitutes another image or approves/rejects the DRAFT. |

`CORRECTION_REQUIRED`, `WARNINGS_UNRESOLVED`, and `PREVIEW_UNAVAILABLE` are
orthogonal substates of `WAITING_FOR_YOUR_REVIEW`, not competing lifecycle states.
They may appear together.

### States that must not be fabricated

| Domain/transport outcome | Projection decision |
| --- | --- |
| Dry-run `READY` / `PREFLIGHT_PASSED` | Transient, nonauthorizing, and not persisted. The first A1.7 browser candidate does not display it after refresh. |
| Dry-run `BLOCKED` / `PREFLIGHT_BLOCKED` | Transient and not persisted. Do not turn absence or a generic failed attempt into a preflight-blocker claim. Persisting it would be a separate semantic block. |
| Handshake `REPLAY_ONLY` | Private MCP startup evidence, not a browser fact. Do not expose it through A1.7. |
| Replayed invocation | No durable replay marker exists. Show the one original saved DRAFT without duplication or a replay badge. |
| Task `IN_REVIEW` | A separate persisted task state. `Waiting for your review` on the DRAFT does not claim that task submission occurred. Existing task state copy remains authoritative. |
| Owner accepted, merged, validated, final, materialized, published, released | Not created by processing adoption or A1.7. Never derive these states from a DRAFT, preview, browser selection, screenshot, test, or CI result. |

## Human copy and correction vocabulary

The default view shows display name, kind, exact pixel dimensions, create or
update meaning, quality summary, and consequence. Raw rule IDs are not the
primary labels. The eight current create-DRAFT findings use this fixed human
vocabulary when present:

| Finding subject | Human label |
| --- | --- |
| role | Asset role |
| span tiles | Tile footprint |
| placement confirmation | Placement confirmation |
| wall safety | Wall placement safety |
| collision | Collision behavior |
| navigation | Navigation effect |
| runtime eligibility | Runtime eligibility |
| visual weight | Visual weight |

The authoritative finding explanation and remediation may follow the label.
Unknown future findings use a bounded generic **Asset detail needs attention**
label plus their already path-safe explanation/remediation; they never expose a
raw internal code as the only actionable copy.

## Required read-projection block

The separately reviewed L3 read-only projection now supplies this prerequisite
for the visual block. It remains task/branch-local and adds no command, grant
scope, MCP tool/resource, discovery count, migration, or Main projection.

The bounded owner-facing shape is:

```json
{
  "schemaVersion": 1,
  "projectId": "project-id",
  "taskId": "task-id",
  "availability": "AVAILABLE",
  "adoptions": [
    {
      "branchRevision": 2,
      "committedAt": "2026-08-29T00:00:00.000Z",
      "operation": "create",
      "displayState": "WAITING_FOR_YOUR_REVIEW",
      "asset": {
        "assetId": "asset-id",
        "name": "Display name",
        "kind": "prop",
        "lifecycle": "DRAFT",
        "assetVersion": 1,
        "metadataVersion": 1,
        "pixelSize": { "width": 32, "height": 48 },
        "preview": {
          "state": "READY",
          "resourceUri": "/api/projects/project-id/tasks/task-id/processing-result-adoptions/2/selected-output",
          "mediaType": "image/png",
          "width": 32,
          "height": 48,
          "alt": "Display name processed asset preview"
        }
      },
      "quality": {
        "correctionRequired": true,
        "correctionItems": [],
        "unresolvedWarnings": []
      }
    }
  ]
}
```

The exact implementation may use an equivalent exact-key schema, but it must
retain these semantics and versioning. `adoptions` are ordered by branch
revision; the latest is primary and earlier entries form read-only history.
An empty array means `NO_DRAFT`, not failure.

The projection allowlist may include:

- project/task identity already present in the route;
- branch revision and commit time under technical disclosure;
- create/update, Asset ID, name, kind, `DRAFT`, Asset/metadata versions;
- selected-output pixel dimensions and a generated same-origin preview URL;
- allowlisted human correction labels plus persisted path-safe explanation and
  remediation;
- unresolved ProcessingResult warning explanation and remediation.

It must exclude:

- Grant or HostBinding ID/token, authority binding, actor execution context,
  correlation identity, and private admission evidence;
- command ID, idempotency key, complete command/preflight/result documents,
  raw ledger JSON, raw attempt details, and warning disposition authority;
- raw CAS URI, digest, filesystem path, stack, secret, and unsanitized error;
- fingerprints and validator/processor internals from the normal browser DTO.

The exact-preview resource must be a separate task/adoption-scoped GET. It
checks project, task, adoption branch revision, the exact `selected-output`
reference, matching adoption lineage, `LIVE` metadata, and physical CAS bytes
before streaming `image/png`. It must not broaden the existing Main-project
`hasProjectReference` rule. GET is read-only and needs no CSRF token; the local
service remains loopback-only.

## Preview and fallback contract

- Use only the server-generated same-origin task/adoption preview URL.
- Display the exact authorized selected-output pixels with `object-fit: contain`,
  centered, with no crop, stretch, replacement pixels, or source-atlas fallback.
- Preserve transparency with a bounded checker/stage treatment.
- The image has a useful alt name; visible caption includes kind and dimensions.
- Loading failure becomes the explicit `PREVIEW_UNAVAILABLE` fallback and
  leaves all text, findings, history, and task navigation usable.
- A committed DRAFT has no truthful `PROCESSING` preview state. Do not show a
  spinner merely because there is no adoption.

## Accessibility, responsive, and passive-refresh contract

- Task, state, next actor, consequence, quality summary, and preview fallback
  are expressed in text and never by color alone.
- The additive section follows the existing heading hierarchy. Lists are real
  lists; definitions are real description lists; useful status/alert semantics
  are applied without turning static copy into a noisy live region.
- Every interactive existing control remains keyboard reachable with visible
  focus. **Technical details** is a native disclosure, closed by default, with
  an accessible name.
- At 1440×900 and 1060×900 the task detail remains inside the protected shell
  with no horizontal page overflow. The preview and facts stack rather than
  forcing a new minimum width.
- Passive refresh preserves the selected task, focused node where compatible,
  text selection, task/page scroll, open disclosures, and unsaved existing
  review choices. An unchanged projection must preserve the existing adoption
  DOM node. A changed projection updates only the bounded section or restores
  the protected task context; it must not replace the room canvas or interrupt
  active pointer work elsewhere.
- The existing task-composer retention path and accepted Asset/Room/Cutter
  focus, dirty-draft, scroll, canvas, layer, and pointer protections remain
  regression inputs.

## Compatibility and authority exclusions

The two implementation blocks must preserve exactly:

- legacy command definitions/grant scopes at 33/30;
- legacy MCP discovery at 19 tools/four templates normally and 30/five for a
  matching task;
- explicit Authoring-v2 discovery at 31/six, with only the existing one-tool/
  one-template delta;
- Numberdroid capability profiles v1/v2 and their current fingerprints;
- SQLite schema v13, portable bundle v1-v3, one authoritative writer, and
  existing retention/backup/recovery rules;
- accepted Main Asset, task review/merge, activity, preview, room/canvas, and
  responsive contracts.

A1.7 adds no new pixel operation, processing recipe/result semantics, artifact
retention root, migration, project/Main mutation, owner decision, task merge,
warning acceptance, lifecycle transition, finalization, materialization,
repository write, publication, release, or user-acceptance claim.

## Split implementation and acceptance criteria

### L3 read-projection block

Implemented candidate evidence now proves:

- exact project/task/adoption association and ordered immutable read results;
- empty, durable DRAFT, correction, warning, and preview-unavailable facts;
- selected-output-only authorized streaming without widening Main references;
- cross-project/task/revision denial and redaction of every excluded field;
- read-only behavior, no startup semantic write, no Main/schema/bundle change;
- exact unchanged 19/4, 30/5, and 31/6 discovery.

### L3 visual block

The implemented candidate and its dedicated evidence lane must keep proving at
1440×900 and 1060×900:

- additive placement in selected Agent task detail and the state precedence
  above;
- the successful headline **Waiting for your review** and visible
  **implemented candidate — not user accepted** label;
- exact preview contain/fallback, plain-language correction/warning copy, and
  closed technical disclosure;
- keyboard/focus/non-color/narrow-layout behavior and passive-refresh DOM,
  selection, scroll, disclosure, and existing review-draft preservation;
- absence of any new adoption/retry/review/merge/finalize/materialize/publish/
  release browser control;
- browser fixture stops at the branch-local DRAFT and performs no owner review
  or task submission.

The dedicated `a1-7` capture and assertion are evidence only. The final state
after source integration is **implemented candidate — not user accepted** and
**Waiting for your review**. Klaus alone may accept or revise the visual and
correction experience later.
