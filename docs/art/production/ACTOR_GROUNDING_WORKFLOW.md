# Numberdroid — Actor Grounding Workflow

Status: **binding production workflow for directional character grounding**

This document defines how Artist / Technical Artist agents create, validate, calibrate and freeze physical character grounding for directional actors. It exists because PICO live QA exposed that grounding cannot be made reliable by repeatedly guessing CSS offsets from screenshots.

The goal is a reproducible production path:

```text
approved directional source
→ source-integrity analysis
→ deterministic runtime sanitation when required
→ connected body / foot geometry
→ actor grounding profile
→ generated runtime CSS
→ synthetic + real-browser QA
→ explicit human calibration deltas
→ live QA acceptance
→ freeze
```

Read together with:

- `ARTIST_AGENT_WORKFLOW.md`
- `ART_ASSET_VALIDATION_RULES.md`
- `ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`
- `LIVE_QA_ITERATION_CLASSIFICATION.md`
- `../../art-production-toolkit/CAPABILITY_INDEX.md`

For tasks that change runtime rendering, source materialization or reusable tooling, the Technical Artist + Engineering routes in `docs/agents/ROLE_ENTRYPOINTS.md` also apply.

---

## 1. Scope and terminology

This workflow applies to directional actors that need a physical floor read independent of faction/ownership rings, selection UI, LOS indicators or gameplay collision.

It distinguishes four different things that must not be collapsed into one parameter:

1. **Approved source art** — canonical authored/generated source; never silently repainted merely to fix a runtime shadow.
2. **Connected runtime body geometry** — the visible body component actually used for physical support after deterministic sanitation.
3. **Physical grounding** — ambient body shadow + one or two local contact shadows.
4. **Human QA calibration** — explicit direction-specific presentation corrections applied after geometry is known.

A shadow is presentation. It is not collision authority, navigation authority or actor footprint authority.

---

## 2. Required authority declaration

Before grounding work starts, record:

```text
ACTOR / ASSET ID
DIRECTION ORDER
SOURCE FRAME SIZE
AUTHORITATIVE SOURCE PATH
RUNTIME MATERIALIZATION PATH
BODY COMPONENT RULE
FOOT / SUPPORT GEOMETRY SOURCE
AMBIENT SHADOW RULE
CONTACT SHADOW RULE
MANUAL QA OVERRIDE POLICY
QA FIXTURE URL
REAL RUNTIME QA URL
```

For PICO the current source order is:

```text
0 N · 1 NE · 2 E · 3 SE · 4 S · 5 SW · 6 W · 7 NW
```

Do not assume another actor uses the same source size or support geometry simply because it also has eight directions.

---

## 3. Source integrity comes before shadow tuning

The most important PICO production lesson is:

> **Never use the lowest opaque/structural pixel as a foot plane until connected-component integrity has been checked.**

PICO NW contained a small detached structural fragment below the connected body. Earlier diagnostics interpreted that fragment as a second foot, which produced an incorrect `footY` and a permanently detached-looking contact shadow. Repeated x/y shadow tuning could not solve the real defect.

Current reusable tooling:

- `scripts/art/toolkit/directional-actor-source.mjs`
- `scripts/sanitize-materialized-actor-assets.mjs`
- `scripts/assert-directional-actor-source-integrity.mjs`

Required sequence:

```text
source frame
→ decode RGBA/indexed PNG
→ find connected structural components
→ identify main actor component
→ inspect detached components below main body
→ classify as intended geometry or source/runtime artefact
→ sanitize runtime derivative only when justified
→ recompute connected foot/support geometry
```

### Approved-source preservation rule

If an approved source contains a tiny artefact that is not intended actor anatomy:

- keep the approved source archive unchanged;
- remove the artefact deterministically during runtime materialization;
- document the sanitation rule;
- add regression coverage so future source changes cannot silently alter it.

Do **not** destructively edit the archived source merely to make the runtime shadow easier.

---

## 4. Connected body and foot geometry

The connected main body is the geometry basis for grounding.

For each direction determine:

- `footY`: connected physical foot/support plane in source coordinates;
- one or two support/contact positions;
- whether a far/rear support is actually visible and connected;
- whether the side view should use only one contact.

Do not invent a second contact because a biped has two legs conceptually. A pure side view may legitimately render one physical contact.

A contact must remain close to connected body geometry. The current PICO integrity gate rejects a contact more than two source pixels from the connected structural body.

The source-integrity analysis is a **geometry diagnostic**, not an art director. It prevents impossible/detached anchors; it does not guarantee that the most visually convincing final shadow requires zero presentation correction.

---

## 5. Grounding profile is the editable authority

Directional grounding data lives in:

`src/meta/characterGroundingProfiles.json`

Generated CSS lives in:

`src/meta/CharacterGrounding.generated.css`

Never hand-edit the generated CSS as the authoritative change. Edit the profile, run the generator, and commit the generated result.

Current profile concepts:

```text
sourceFrameSize
ambient.width / height
ambient.offsetYFromFoot
ambient opacity
contactDefaults radius / opacity
per direction:
  footY
  presentationOffsetY
  shadowOffsetY
  contacts[]
```

### Meaning of the two Y offsets

`presentationOffsetY`
: prior pose/contact presentation calibration. It is kept separate from measured `footY` so body geometry remains inspectable.

`shadowOffsetY`
: explicit human live-QA delta for the **whole physical shadow** in that direction.

The generator combines both for contact shadows. The ambient shadow remains based on `footY + ambient.offsetYFromFoot`, plus the explicit `shadowOffsetY`; it does not drift because of contact count or contact mean.

This distinction is binding. Do not bury human calibration by mutating `footY`.

---

## 6. Ambient shadow vs contact shadows

Physical grounding has two layers with different responsibilities.

### Ambient shadow

Purpose:

- visually connect the actor mass to the floor;
- remain soft and low-contrast;
- preserve roughly consistent actor-scale character across directions.

Rules:

- size/opacities are actor-level defaults;
- vertical anchor is based on the connected foot plane, not mean contact position;
- direction-specific movement is allowed only through explicit `shadowOffsetY` live-QA calibration;
- do not use ambient shadow as affiliation/faction communication.

### Contact shadows

Purpose:

- create local weight directly at visible support points;
- hide small pose/pixel ambiguities at foot contact;
- strengthen grounding without turning the entire actor base black.

Rules:

- contacts may differ by direction;
- one or two contacts are valid;
- rear/far contact may use lower opacity;
- side views may use one wider contact;
- local x/y changes must be stored in the profile;
- global size changes belong in `contactDefaults` unless a direction has an explicit exceptional radius.

PICO live QA accepted contact shadows 15% larger than the previous defaults. This is a PICO reference, not a universal percentage for every actor.

---

## 7. Runtime rendering contract

Physical grounding is a real DOM layer under the directional sprite:

- runtime CSS: `src/meta/RobotGrounding.css`
- profile-generated direction variables: `CharacterGrounding.generated.css`
- actor sprite remains above the physical shadow;
- affiliation ring remains a separate visual semantic layer.

Do not reintroduce negative-z pseudo-element hacks, baked floor shadows or faction rings as the physical grounding mechanism.

The runtime grounding layer is allowed to overflow the actor frame because a physically useful contact ellipse can extend beyond the sprite's transparent padding.

---

## 8. Required QA views

Grounding is not accepted from one screenshot.

### Eight-direction fixture

```text
?groundingFixture=1
```

Use this to compare all direction profiles side-by-side.

Debug variant:

```text
?groundingFixture=1&groundingDebug=1
```

Grounding disabled comparison:

```text
?groundingFixture=1&groundingOff=1
```

### Real scene QA

The automated scene fixture:

```text
?groundingScene=1
```

is intentionally paused for reproducible screenshot QA. Do not describe it as the playable TS-01.

Playable generated TS-01:

```text
?floor=ts01-generated
```

Final acceptance requires both fixture readability and believable grounding in the actual game context.

---

## 9. Automated QA responsibilities

Automation must answer objective questions, for example:

- source decodes correctly;
- expected frame count/order exists;
- detached structural fragments are detected;
- sanitized runtime geometry matches expected connected foot planes;
- contacts remain close to connected body geometry;
- generated CSS matches profile data;
- every direction produces visible dark grounding pixels;
- grounding exists in the real TS-01 rendering path;
- tests/build remain green.

Automation does **not** decide:

- whether the shadow feels 2 px too high;
- whether a far contact should move 3 px inward;
- whether contact size should increase 15%;
- whether the actor feels heavy, floating or visually balanced.

Those are Human Live QA decisions.

---

## 10. Human Live QA calibration is a first-class production stage

The PICO process proved that geometry automation is necessary but not sufficient. Once objective source/runtime errors are removed, a human art-direction pass may specify exact deltas.

Correct workflow:

```text
objective geometry valid
→ render all 8 directions
→ human reviews one shared screenshot
→ record exact deltas by direction
→ apply once as profile data
→ regenerate
→ browser QA
→ live QA
→ accept/freeze
```

Wrong workflow:

```text
look at one direction
→ guess x/y
→ deploy
→ guess again
→ alter footY
→ add another CSS transform
→ repeat
```

Human calibration must be explicit and reproducible. Store it in fields such as `shadowOffsetY` or contact x/y, not in undocumented CSS patches.

### Calibration coordinate convention

All manual calibration values are authored in **source-frame pixels**, not runtime CSS pixels, unless a task explicitly declares otherwise.

When a reviewer gives a runtime-looking instruction such as "3 px up", confirm which coordinate system the current QA fixture represents before encoding it. For PICO PR #121 the approved pass was encoded as source-space profile deltas against the current fixture and locked by tests.

---

## 11. PICO accepted reference — 2026-08-19

PICO physical grounding is **LIVE_ACCEPTED** after PR #121.

Current connected foot planes:

```text
N  86
NE 86
E  87
SE 87
S  89
SW 92
W  92
NW 92
```

Current manual whole-shadow QA deltas:

```text
N   0
NE  0
E  -3
SE -2
S  -2
SW -3
W  -3
NW +2
```

Additional accepted calibration:

- NE left contact moved 3 source px right;
- PICO contact shadow radii increased by 15%;
- NW detached source fragment is removed from the runtime derivative;
- NW uses one connected support rather than a fabricated second contact;
- ambient actor shadow remains 92 × 23 source px with `offsetYFromFoot = -5`.

These exact values are a **regression reference for PICO**, not a template to copy numerically onto another actor.

---

## 12. New actor onboarding procedure

For every new directional actor:

1. **Confirm source contract**
   - frame dimensions;
   - direction order;
   - alpha/background;
   - approved source provenance.

2. **Run source-integrity analysis**
   - connected components;
   - detached fragments;
   - main body bounds;
   - connected foot planes.

3. **Decide runtime sanitation**
   - none by default;
   - deterministic only for proven source artefacts;
   - archive stays unchanged.

4. **Create grounding profile**
   - actor-level ambient defaults;
   - actor-level contact defaults;
   - per-direction foot/support geometry;
   - zero human QA deltas initially unless inherited from an explicitly approved prior version.

5. **Generate CSS and preview**
   - never edit generated CSS as source of truth.

6. **Run automated integrity/tests/build**
   - detached-contact gate;
   - generated-file consistency;
   - browser grounding presence.

7. **Human 8-direction QA**
   - one combined screenshot preferred;
   - list exact per-direction deltas;
   - note local contact adjustments separately.

8. **Apply one bounded calibration pass**
   - `shadowOffsetY` for whole-shadow vertical movement;
   - contact x/y for local support placement;
   - actor-level defaults for shared size/opacity changes.

9. **Re-run automated QA and real scene QA**.

10. **Explicit Live Acceptance**
    - mark actor grounding LIVE_ACCEPTED;
    - update recipe/status/index;
    - freeze unless a concrete defect is later demonstrated.

---

## 13. Failure classification

Before changing values, classify the failure.

### SOURCE INTEGRITY FAIL

Symptoms:

- isolated pixels/components below actor;
- impossible foot plane;
- detached contact consistently follows a source artefact.

Fix:

- source-integrity/sanitation layer first.

### GEOMETRY FAIL

Symptoms:

- contact is objectively far from connected body;
- wrong support selected;
- side view invents a second unsupported foot.

Fix:

- contact/foot geometry.

### PRESENTATION FAIL

Symptoms:

- source and contact geometry valid, but actor reads slightly floating/heavy;
- one direction needs a small whole-shadow vertical correction.

Fix:

- explicit `shadowOffsetY` or local contact calibration.

### SHAPE / INTENSITY FAIL

Symptoms:

- contacts too small/large;
- ambient too weak/strong;
- all directions share the same visual deficiency.

Fix:

- actor-level shadow defaults, not eight independent tweaks.

### RUNTIME / LAYERING FAIL

Symptoms:

- shadow exists in fixture but disappears behind Floor/Actor;
- affiliation ring and physical shadow interfere;
- clipping/z-index issue.

Fix:

- runtime rendering layer, then regression-test it.

Do not use image generation for any of these unless the actual actor source design itself is wrong and source generation is deliberately reopened.

---

## 14. Acceptance and freeze rule

A directional actor grounding pass is complete only when:

```text
source integrity PASS
+ runtime sanitation PASS where required
+ connected foot/support geometry PASS
+ profile-generated CSS consistent
+ unit/regression tests PASS
+ 8-direction browser render PASS
+ real-scene grounding render PASS
+ Human Live QA explicitly approved
```

After explicit approval:

> **Freeze the grounding profile. Do not refactor or normalize accepted per-direction calibration merely because another mathematical rule looks cleaner.**

The accepted visual result is the product authority. Geometry analysis and shared defaults should minimize manual work, but they do not overrule final human art direction.

---

## 15. Durable lesson

The production lesson is not "manual tuning beats automation" and not "automation can solve visual grounding alone".

The durable pipeline is:

> **automation establishes trustworthy geometry and prevents impossible states; human QA supplies the final perceptual calibration; both are stored as explicit reproducible data.**

That is the required standard for all future Numberdroid directional actors.
