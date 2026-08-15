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
type DoorStyle = CSSProperties & { "--door-key-color"?: string };

const KEY_COLORS: Record<string, string> = {
  BLUE: "#4f9de8",
  RED: "#d45555",
  GREEN: "#53c984",
  AMBER: "#d7a349",
  YELLOW: "#d7a349",
  COMMAND: "#d7a349",
  VIOLET: "#9a77d6",
  PURPLE: "#9a77d6",
};

function doorKeyColor(label?: string) {
  const key = label?.trim().toUpperCase() ?? "";
  return KEY_COLORS[key] ?? "#d7a349";
}

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
  const leafClipStyle: CSSProperties | undefined = floor.id === "transfer-hall"
    ? { overflow: "hidden" }
    : undefined;
  const showStatusText = floor.id !== "transfer-hall";

  return (
    <>
      {floor.doors.map((door) => {
        const open = openDoorIds.has(door.id);
        const accessible = hasDoorAccess({ accessKeyIds: [...accessKeyIds] }, door);
        const keyed = door.mode === "locked" && Boolean(door.keyId);
        const accessName = door.label ?? "ACCESS";
        const status = open
          ? "OPEN"
          : door.mode === "locked" && !accessible
            ? `LOCK ${accessName}`
            : door.mode === "locked"
              ? `ACCESS ${accessName}`
              : door.label ?? "AUTO";
        const style: DoorStyle = {
          left: door.x,
          top: door.y,
          width: door.w,
          height: door.h,
          ...(keyed ? { "--door-key-color": doorKeyColor(door.label) } : {}),
        };
        return (
          <div
            key={door.id}
            className={`zk-door ${door.orientation} ${door.size} ${door.mode} ${keyed ? "keyed" : ""} ${accessible ? "accessible" : "denied"} ${open ? "open" : "closed"}`}
            style={style}
            aria-hidden="true"
          >
            <i className="frame" style={frameStyle} />
            <div className="leaf-clip" style={leafClipStyle}>
              <i className="panel panel-a" style={leafStyle} />
              <i className="panel panel-b" style={leafStyle} />
            </div>
            {showStatusText && <span>{status}</span>}
          </div>
        );
      })}
    </>
  );
}
