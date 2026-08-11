import type { FloorDefinition } from "../game/types";
import "./DoorLayer.css";

type Props = {
  floor: FloorDefinition;
  openDoorIds: ReadonlySet<string>;
};

export function DoorLayer({ floor, openDoorIds }: Props) {
  return (
    <>
      {floor.doors.map((door) => {
        const open = openDoorIds.has(door.id);
        return (
          <div
            key={door.id}
            className={`zk-door ${door.orientation} ${open ? "open" : "closed"}`}
            style={{ left: door.x, top: door.y, width: door.w, height: door.h }}
            aria-hidden="true"
          >
            <i className="frame" />
            <i className="panel panel-a" />
            <i className="panel panel-b" />
            <span>{open ? "OPEN" : "AUTO"}</span>
          </div>
        );
      })}
    </>
  );
}
