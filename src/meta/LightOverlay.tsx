import type { CSSProperties } from "react";
import { lightingForFloor } from "../game/lighting";
import "./LightOverlay.css";

type Props = { floorId: string };
type LightStyle = CSSProperties & { "--nd-light-rgb"?: string; "--nd-light-intensity"?: number };

export function LightOverlay({ floorId }: Props) {
  const lighting = lightingForFloor(floorId);
  if (!lighting) return null;
  return <div className="zk-light-overlay" aria-hidden="true">
    {lighting.zones.map((zone) => {
      const lights = lighting.lights.filter((light) => light.zoneId === zone.id);
      if (!lights.length) return null;
      return <div key={zone.id} className="zk-light-zone" data-light-zone={zone.id} style={{ left: zone.x, top: zone.y, width: zone.w, height: zone.h }}>
        {lights.map((light) => {
          const style: LightStyle = {
            left: light.x - zone.x,
            top: light.y - zone.y,
            width: light.radiusX * 2,
            height: light.radiusY * 2,
            "--nd-light-rgb": light.rgb,
            "--nd-light-intensity": light.intensity,
          };
          return <i key={light.id} className={`zk-light-source ${light.pulse ? "pulse" : ""}`} data-light-id={light.id} style={style} />;
        })}
      </div>;
    })}
  </div>;
}
