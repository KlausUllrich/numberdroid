import type { FloorDefinition } from "../game/types";
import { hasDoorAccess } from "./doorRuntime";
import "./DoorLayer.css";

type Props = {
  floor: FloorDefinition;
  openDoorIds: ReadonlySet<string>;
  collectedPickupIds: readonly string[];
};

export function DoorLayer({ floor, openDoorIds, collectedPickupIds }: Props) {
  return (
    <>
      {floor.doors.map((door) => {
        const open = openDoorIds.has(door.id);
        const accessible = hasDoorAccess(floor, { collectedPickupIds: [...collectedPickupIds] }, door);
        const accessName = door.label ?? "ACCESS";
        const status = open
          ? "OPEN"
          : door.mode === "locked" && !accessible
            ? `LOCK ${accessName}`
            : door.mode === "locked"
              ? `ACCESS ${accessName}`
              : door.label ?? "AUTO";
        return (
          <div
            key={door.id}
            className={`zk-door ${door.orientation} ${door.size} ${door.mode} ${accessible ? "accessible" : "denied"} ${open ? "open" : "closed"}`}
            style={{ left: door.x, top: door.y, width: door.w, height: door.h }}
            aria-hidden="true"
          >
            <i className="frame" />
            <i className="panel panel-a" />
            <i className="panel panel-b" />
            <span>{status}</span>
          </div>
        );
      })}
    </>
  );
}
