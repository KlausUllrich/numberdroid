import { BODIES } from "../game/catalog";
import type { BodyId } from "../game/types";

function friendly(id: string) {
  return id.replace(/^family-/, "").replace(/-/g, " ").replace(/#/g, " ").toUpperCase();
}

/**
 * Human-facing Workbench Actor name.
 *
 * Semantic Encounter IDs deliberately remain stable when an Actor's robot type
 * changes. Visible labels must instead follow the effective compiled bodyId so
 * authoring feedback never looks stale after an Override.
 */
export function workbenchActorDisplayName(bodyId: BodyId | null | undefined, fallbackId: string) {
  return bodyId ? BODIES[bodyId].name : friendly(fallbackId);
}
