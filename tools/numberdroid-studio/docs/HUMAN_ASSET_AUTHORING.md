# Human Asset authoring

Status: **USER ACCEPTED — VT-020 PASS**, 2026-09-09.
The [Asset editor implementation contract](ASSET_EDITOR_IMPLEMENTATION_CONTRACT.md)
owns the current direct-Save and spatial semantics. It evolves the accepted
[Checkpoint 2C Asset core](CHECKPOINT_2C_CONTRACT.md).

From a saved cut, **Create asset from this slice** opens the contextual Asset
editor. The cut's name becomes the initial Asset name. **Inspect** on a Library
Asset opens the same editor for a new version of that saved Asset.

Use **Properties** for name, Surface/Prop/Item kind and existing placement choices.
Use **Placement & blocking** for independent placement bounds, anchor, scale and
named polygon, rectangle or oval regions. Existing metadata that the editor does
not expose remains intact. Existing Assets retain their legacy geometry until
explicit conversion; a name-only edit does not convert them.

**Save work** creates one DRAFT Asset version directly for the project owner.
The owner does not review a proposal representing their own edit. Agent proposals
remain isolated and retain explicit owner decision/application. No Save finalizes
content, authorizes runtime use, materializes files or publishes anything.

Editing retains the exact prior image binding even after recutting its source.
Existing Rooms continue to use their pinned Asset versions. Stale edits keep the
draft and require an explicit context recheck. An uncertain Save locks its exact
request for identical retry rather than inventing a second version. Raw numeric
edits remain visible; point removal and whole-region removal are distinct.

**Preview shapes** inspects the current draft without saving. It does not simulate
character movement or pathfinding. Returning preserves draft, tool, focus, zoom
and canvas/page scroll. The shared Activity history is available from its main
navigation page.

Native 1440/1060 workflow, replay, Room-pin and restart checks and a real-agent
semantic correction/review round have passed. CI/source integration is recorded
in the focused PR. [VT-020](VACATION_TEST_BACKLOG.md#vt-020--asset-placement-and-blocking-editor)
records Klaus's explicit **“all pass”** on clean main `93652c2`. The earlier
prepare/review/apply human form is superseded;
its historical implementation remains in Git history. VT-001 and A1.7 are not
accepted by this bounded Asset-editor decision.
