import type { CSSProperties } from "react";
import { publicAsset } from "../game/assets";
import type { FloorDefinition } from "../game/types";
import { hasDoorAccess } from "./doorRuntime";
import "./DoorLayer.css";

type Props = {
  floor: FloorDefinition;
  openDoorIds: ReadonlySet<string>;
  accessKeyIds: readonly string[];
};

type DoorFrameStyle = CSSProperties & { "--door-pocket-image"?: string };

export function DoorLayer({ floor, openDoorIds, accessKeyIds }: Props) {
  const transferHallDoorLeaf = floor.id === "transfer-hall"
    ? publicAsset("assets/deck/transfer-hall-door-leaf.png")
    : null;
  const transferHallPocket = floor.id === "transfer-hall"
    ? publicAsset("assets/deck/transfer-hall-door-pocket.png")
    : null;
  const leafStyle: CSSProperties | undefined = transferHallDoorLeaf
    ? { backgroundImage: `url(${transferHallDoorLeaf})` }
    : undefined;
  const frameStyle: DoorFrameStyle | undefined = transferHallPocket
    ? { "--door-pocket-image": `url(${transferHallPocket})` }
    : undefined;

  return (
    <>
      {floor.doors.map((door) => {
        const open = openDoorIds.has(door.id);
        const accessible = hasDoorAccess({ accessKeyIds: [...accessKeyIds] }, door);
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
            <i className="frame" style={frameStyle} />
            <i className="panel panel-a" style={leafStyle} />
            <i className="panel panel-b" style={leafStyle} />
            <span>{status}</span>
          </div>
        );
      })}
    </>
  );
}
