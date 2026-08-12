# Numberdroid — Prompt for the next agent

You are continuing **Numberdroid** in repository:

```text
KlausUllrich/numberdroid
```

Branch:

```text
agent/integrate-metagame-architecture
```

Draft PR #1 targets `main`.

**Never merge PR #1 unless Klaus explicitly asks.**

## Read completely, in this order

1. `HANDOFF_2026-08-12.md`
2. `STORY_WORLD_FOUNDATION.md`
3. `CAMPAIGN_STORY_LEVEL_PROGRESSION.md`
4. `CODEX_HANDOFF.md`
5. `ENCOUNTER_ARCHETYPES.md`
6. `CAMPAIGN_PROGRESSION.md`
7. `LEARNING_PROFILES.md`
8. `MENU_HUB_FLOW.md`
9. `DEVELOPMENT_PLAN_NEXT.md`

The first three documents contain the newest creative/status decisions. Older status/roadmap text is historical when it conflicts with them. Preserve older binding runtime rules that are not superseded.

## Verify before changing anything

1. Verify the current branch HEAD.
2. Check the latest GitHub Actions test/build/Pages run.
3. Verify the public GitHub Pages deployment.
4. Check Draft PR #1 and keep it draft/unmerged.
5. Inspect actual current code where relevant rather than assuming the documents describe implementation perfectly.

Then **summarize what you understand to Klaus before changing code or assets**.

## Architecture boundary

Do not perform another broad migration/rewrite.

Preserve:
- local RAF movement/camera,
- physical body size and body-specific drive feel,
- Floor/Tiled authoring,
- hidden arithmetic correctness until explicit `REAKTOR AUSLÖSEN`,
- physical collision→scan,
- neutral/guard/patrol/aggressive distinctions,
- LOS/view cone/investigation behavior,
- profile-specific campaign/save/math state,
- shared story campaign for all math profiles,
- independent tactical challenge,
- title/profile/hub flow.

No prototype bridge techniques such as hidden DOM clicks, MutationObservers, reload transitions, DOM patching or localStorage message buses.

## Important corrected loss rule

Do **not** preserve the old “one lost duel resets the whole deck” behavior as design intent.

Binding desired behavior is:
- lose 1 HP,
- keep the active robot body,
- return that body to the authored level-start position,
- preserve already eliminated robots,
- preserve acquired keys/access and completed deck-local actions,
- preserve other current deck progress,
- if the lost encounter is a boss, that boss encounter restarts from **Phase 1**,
- only losing the final HP causes mission failure, hub return and a genuinely fresh future run.

The current code at the handoff checkpoint still reflects the old full-floor-reset misunderstanding. Treat this as a known contained implementation mismatch, **not** a new architecture direction.

Do not silently claim it is already fixed.

## Story foundation now established

The player is themselves, with their own name, and starts biologically human before the coming-of-age Transfer into a technical core/robot body.

Core fantasy: different robot bodies and digital transfer let the player reach impossible places such as deep ocean, volcanic environments and the Moon.

The deeper campaign is about finding one's own place rather than accepting an optimally assigned identity.

Key arcs:
- **Parents:** loving but ordinary/time-starved; learn that work they genuinely enjoy cannot replace choosing time for their child and each other. They must have individual viewpoints, not speak as one exposition voice.
- **Kayo:** genuinely brilliant assigner of people to tasks; “my competence is my value”; the unassignable player triggers overload and exposes that Kayo made everyone dependent on him. He matures into a leader who makes others capable and ultimately helps the player create a new role rather than assigning one.
- **PRIMUS:** order/optimisation antagonist; learns through self-organising nature that complex order does not require one manager, then discovers personal curiosity/passion and understands why passion cannot be assigned.
- **Player:** possibilities/abilities can be gained or downloaded, but personally meaningful competence requires practice. The player eventually creates a role that did not previously exist.

Tone: child-friendly comic adventure, a little robot horror/meanness but never truly frightening, humor throughout, plus short playable moments of awe.

## Campaign progression now established at v0.1

Intro + ~25 beats + Outro are coupled to gameplay across:

1. Transfer Ship (Beats 1–5)
2. Deep Ocean (6–10)
3. Volcanic / Extreme Industry (11–15)
4. Moon / Vacuum (16–20)
5. Bio-Ark / PRIMUS (21–25)

Read the exact beat functions in `CAMPAIGN_STORY_LEVEL_PROGRESSION.md` rather than improvising replacements.

Important open points:
- Beat 12 needs intelligent enemy/body ordering, but exact RPS mechanics are not locked.
- Beat 17 needs optional bonus core-conversion/strengthening, but the economy is not locked.
- Beat 16 is a candidate for first Treasure Golem/Beutedroide introduction, but that system is not currently implemented.
- Bio-Ark ecological mechanics remain design work for later.

## Your next major task

The next major milestone is **first Art Direction / Graphic Push for Intro + Beats 1–5 / Transfer Ship**.

Do not write the entire final story again and do not make final art for all 25 beats.

First propose a bounded art-direction slice that defines:
- visual language of biological childhood versus machine adulthood,
- the Transfer itself,
- player's first robot body,
- ship architecture/forms/materials,
- PRIMUS signage/order/UI language,
- Kayo/status robot visual language,
- lighting and palette principles,
- human/family traces inside a primarily robotic society,
- a small room/prop/robot asset set for the first graphical vertical slice,
- how Numberdroid avoids looking like generic sci-fi.

Use the story as the reason for the visuals, not as decoration applied after the fact.

Before implementing or generating assets, summarize your understanding and present the proposed first visual block to Klaus.

## Existing framework — do not restart

- Pages/CI pipeline,
- campaign catalog,
- B2 and C3 framework/progression proof,
- family profiles and isolated saves,
- math roles/envelopes,
- separate tactical challenge,
- hostile archetypes/LOS/investigation,
- menu/profile/hub/resume/archive screens,
- duel board core rules,
- player initiative on every ordinary new boss phase.

Current real math protocols are addition/subtraction only. Do not advertise multiplication/division as playable.

Current public preview:

```text
https://klausullrich.github.io/numberdroid/
```

Never merge PR #1 without explicit Klaus approval.
