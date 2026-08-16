import type { PlacementOverride } from "./types";
import { validatePlacementOverrides } from "./overrides";
import type { LevelSpec } from "./types";

const PREFIX = "numberdroid.level-workbench.v1";

export type WorkbenchDraft = {
  version: 1;
  levelId: string;
  savedAt: string;
  overrides: PlacementOverride[];
};

function key(levelId: string) {
  return `${PREFIX}:${levelId}`;
}

export function loadWorkbenchDraft(baseSpec: LevelSpec, storage: Pick<Storage, "getItem"> = window.localStorage): WorkbenchDraft | null {
  try {
    const raw = storage.getItem(key(baseSpec.id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkbenchDraft>;
    if (parsed.version !== 1 || parsed.levelId !== baseSpec.id || !Array.isArray(parsed.overrides)) return null;
    const spec = { ...baseSpec, overrides: parsed.overrides };
    validatePlacementOverrides(spec);
    return {
      version: 1,
      levelId: baseSpec.id,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
      overrides: parsed.overrides,
    };
  } catch {
    return null;
  }
}

export function saveWorkbenchDraft(
  baseSpec: LevelSpec,
  overrides: PlacementOverride[],
  storage: Pick<Storage, "setItem"> = window.localStorage,
  now = new Date(),
): WorkbenchDraft {
  validatePlacementOverrides({ ...baseSpec, overrides });
  const draft: WorkbenchDraft = {
    version: 1,
    levelId: baseSpec.id,
    savedAt: now.toISOString(),
    overrides,
  };
  storage.setItem(key(baseSpec.id), JSON.stringify(draft));
  return draft;
}

export function clearWorkbenchDraft(baseSpec: LevelSpec, storage: Pick<Storage, "removeItem"> = window.localStorage) {
  storage.removeItem(key(baseSpec.id));
}
