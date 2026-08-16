import { describe, expect, it } from "vitest";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";
import { TS01_LEVEL_SPEC } from "./specs/ts01";
import { compileWorkbenchPlan, setEncounterRobotType } from "./workbench";
import { clearWorkbenchDraft, loadWorkbenchDraft, saveWorkbenchDraft } from "./workbenchDraft";
import { workbenchActorDisplayName } from "./workbenchDisplay";
import { commitWorkbenchHistory, createWorkbenchHistory, redoWorkbenchHistory, undoWorkbenchHistory } from "./workbenchHistory";
import type { PlacementOverride } from "./types";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe("Workbench authoring state", () => {
  it("undoes and redoes accepted semantic override snapshots", () => {
    const first: PlacementOverride[] = [{ targetId: "living-memory", preferredWall: "east" }];
    const second: PlacementOverride[] = [{ targetId: "living-memory", preferredWall: "south" }];
    let history = createWorkbenchHistory();
    history = commitWorkbenchHistory(history, first);
    history = commitWorkbenchHistory(history, second);

    history = undoWorkbenchHistory(history);
    expect(history.present).toEqual(first);
    expect(history.future).toHaveLength(1);

    history = redoWorkbenchHistory(history);
    expect(history.present).toEqual(second);
  });

  it("saves, reloads and clears a level-specific browser draft", () => {
    const storage = memoryStorage();
    const overrides: PlacementOverride[] = [{ targetId: "living-memory", preferredWall: "east" }];
    const saved = saveWorkbenchDraft(TS01_LEVEL_SPEC, overrides, storage, new Date("2026-08-16T12:00:00.000Z"));
    expect(saved.savedAt).toBe("2026-08-16T12:00:00.000Z");
    expect(loadWorkbenchDraft(TS01_LEVEL_SPEC, storage)?.overrides).toEqual(overrides);

    clearWorkbenchDraft(TS01_LEVEL_SPEC, storage);
    expect(loadWorkbenchDraft(TS01_LEVEL_SPEC, storage)).toBeNull();
  });

  it("changes an Encounter robot type while preserving semantic Actor identity and updating the visible name", () => {
    const overrides = setEncounterRobotType([], "primus-sentry-4", "magnetar");
    expect(overrides).toEqual([{ targetId: "primus-sentry-4", robotType: "magnetar" }]);

    const plan = compileWorkbenchPlan(TS01_LEVEL_SPEC, NUMBERDROID_PROP_REGISTRY, overrides);
    const encounter = plan.actors.props.navigation.geometry.semantic.encounters.find((entry) => entry.id === "primus-sentry-4")!;
    const actor = plan.actors.actors.find((entry) => entry.id === "primus-sentry-4")!;
    expect(encounter.enemyId).toBe("magnetar");
    expect(encounter.bodyId).toBe("magnetar");
    expect(encounter.behavior).toBe("patrol");
    expect(actor.patrolRouteId).toBe("primus-sentry-patrol");
    expect(workbenchActorDisplayName(encounter.bodyId, encounter.id)).toBe("MAGNETAR 742");
  });
});
